-- University learner progress migration for SwimmerBackend.
--
-- This file contains no project URL, key, token, user id, or other secret.
-- Run it in the intended SwimmerBackend staging project first, as one
-- transaction. Do not run it against a project that already has a different
-- university.progress table without first comparing that table's shape.
--
-- Request contract proven by:
--   packages/backend/src/browser.ts:94-149
--   apps/university/src/account/progress-remote.test.ts:53-85
-- The browser currently sends user_id, document, and revision only. The XP
-- columns below are maintained by the trigger so this migration does not make
-- the client depend on an RPC it does not call.

begin;

create schema if not exists university;

create table if not exists university.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  -- Server-owned XP total. The client-supplied document.totalXp is a mirror.
  xp_total bigint not null default 0,
  -- event_id -> {"amount": integer, "accepted_at": timestamptz};
  -- entries older than the bounded idempotency window are pruned on write.
  xp_event_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_progress_document_object
    check (jsonb_typeof(document) = 'object'),
  constraint university_progress_revision_safe
    check (revision >= 0 and revision <= 9007199254740991),
  constraint university_progress_xp_total_safe
    check (xp_total >= 0 and xp_total <= 9007199254740991),
  constraint university_progress_xp_window_object
    check (jsonb_typeof(xp_event_window) = 'object')
);

-- The Data API needs schema/table grants in addition to RLS. There is no anon
-- read/write path: the browser binds progress only after Auth signs the user
-- in. service_role is for server-side administration only, never for a browser.
revoke all on schema university from public;
grant usage on schema university to authenticated, service_role;

revoke all on table university.progress from public;
grant select, insert, update on table university.progress to authenticated;
grant select, insert, update on table university.progress to service_role;
-- DELETE is intentionally not granted: the client has no delete operation.

alter table university.progress enable row level security;

drop policy if exists university_progress_select_own on university.progress;
create policy university_progress_select_own
  on university.progress
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists university_progress_insert_own on university.progress;
create policy university_progress_insert_own
  on university.progress
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists university_progress_update_own on university.progress;
create policy university_progress_update_own
  on university.progress
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Keep the amount inside the browser-safe integer range accepted by
-- packages/core/src/progress/document.ts:126-137.
create or replace function university.progress_xp_amount(raw jsonb)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  amount numeric;
begin
  if raw is null or jsonb_typeof(raw) <> 'number' then
    raise exception 'XP event amounts must be JSON numbers'
      using errcode = '22023';
  end if;

  amount := (raw::text)::numeric;
  if amount <> trunc(amount)
     or amount < 0
     or amount > 9007199254740991::numeric then
    raise exception 'XP event amounts must be non-negative safe integers'
      using errcode = '22023';
  end if;
  return amount::bigint;
end;
$function$;

-- Database-side compatibility bridge for the current document save protocol.
--
-- The client continues to submit document.xpEvents as event_id -> amount. The
-- trigger consumes IDs not already in the active window, increments xp_total,
-- prunes the window, and writes a compact document mirror back into NEW. The
-- incoming document.totalXp is never used as the server counter.
create or replace function university.progress_before_write()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  accepted_at timestamptz := clock_timestamp();
  active_window jsonb := '{}'::jsonb;
  canonical_events jsonb := '{}'::jsonb;
  incoming_events jsonb;
  total numeric := 0;
  amount bigint;
  event_entry record;
begin
  if new.document is null or jsonb_typeof(new.document) <> 'object' then
    raise exception 'progress.document must be a JSON object'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    if new.revision is distinct from 1 then
      raise exception 'new progress rows must start at revision 1'
        using errcode = '22023';
    end if;
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'progress.user_id is immutable'
        using errcode = '22023';
    end if;
    if new.revision is distinct from old.revision + 1 then
      raise exception 'progress revision must increase by exactly one'
        using errcode = '22023';
    end if;

    total := coalesce(old.xp_total, 0)::numeric;

    select coalesce(jsonb_object_agg(old_entry.key, old_entry.value), '{}'::jsonb)
      into active_window
      from jsonb_each(coalesce(old.xp_event_window, '{}'::jsonb)) as old_entry(key, value)
     where (old_entry.value ->> 'accepted_at')::timestamptz
             >= accepted_at - interval '30 days';
  end if;

  incoming_events := new.document -> 'xpEvents';
  if incoming_events is null or incoming_events = 'null'::jsonb then
    incoming_events := '{}'::jsonb;
  elsif jsonb_typeof(incoming_events) <> 'object' then
    raise exception 'progress.document.xpEvents must be a JSON object'
      using errcode = '22023';
  end if;

  -- parseProgress() creates this compatibility seed when a compact document's
  -- total is larger than the recent event window. It is accepted only while a
  -- row has no server total; on an established row it must not re-add the
  -- already-counted compacted history.
  if incoming_events ? '__legacy_total__' then
    amount := university.progress_xp_amount(incoming_events -> '__legacy_total__');
    if tg_op = 'INSERT' or total = 0 then
      total := total + amount;
    end if;
  end if;

  for event_entry in
    select key, value
      from jsonb_each(incoming_events)
  loop
    if event_entry.key = '__legacy_total__' then
      continue;
    end if;
    if length(btrim(event_entry.key)) = 0 then
      raise exception 'XP event IDs must not be empty'
        using errcode = '22023';
    end if;

    amount := university.progress_xp_amount(event_entry.value);
    if not (active_window ? event_entry.key) then
      total := total + amount;
      active_window := active_window || jsonb_build_object(
        event_entry.key,
        jsonb_build_object('amount', amount, 'accepted_at', accepted_at)
      );
    end if;
  end loop;

  if total <> trunc(total)
     or total < 0
     or total > 9007199254740991::numeric then
    raise exception 'progress XP total is outside the browser-safe integer range'
      using errcode = '22003';
  end if;

  select coalesce(
    jsonb_object_agg(window_entry.key, window_entry.value -> 'amount'),
    '{}'::jsonb
  )
    into canonical_events
    from jsonb_each(active_window) as window_entry(key, value);

  new.xp_total := total::bigint;
  new.xp_event_window := active_window;
  new.document := jsonb_set(
    jsonb_set(new.document, array['totalXp'], to_jsonb(total::bigint), true),
    array['xpEvents'],
    canonical_events,
    true
  );
  new.updated_at := accepted_at;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$function$;

drop trigger if exists progress_before_write on university.progress;
create trigger progress_before_write
  before insert or update on university.progress
  for each row
  execute function university.progress_before_write();

-- These are trigger/helper functions, not browser RPCs. Do not expose them as
-- a client API; only the table is part of the browser contract.
revoke execute on function university.progress_xp_amount(jsonb) from public;
revoke execute on function university.progress_before_write() from public;

commit;
