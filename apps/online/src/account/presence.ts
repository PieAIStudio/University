/**
 * UNWIRED. Do not import this from App.tsx.
 *
 * The protocol lives in `createRealtimePresencePort`: Presence `track()` for
 * who is online and which lesson they stopped on, Broadcast for the cursor.
 * This file would construct the Supabase channel that adapter talks to.
 *
 * It does not, today. `university.study_groups` (and
 * `study_group_members.shares_presence`) is written on SwimmerBackend
 * `work/university-schema` and has not been deployed. Opening a channel
 * against a missing table would fail at subscribe, and that failure would
 * look like "together-learning is broken" rather than "the table is not
 * there yet". Forging peers to hide the gap is the other way to lie; we
 * do not do that either. The running app uses `createBrowserPresencePort`,
 * an in-memory bus, until the steps below actually happen.
 *
 * To wire, after the schema is live:
 * 1. Register University as a SwimmerBackend consumer (owner).
 * 2. Deploy `university.study_groups` / `study_group_members` with RLS
 *    (a member may UPDATE only their own `shares_presence` row).
 * 3. Flip `presenceAdapterIsWired` to return true.
 * 4. Call `createOnlinePresencePort` from both shells once identity is
 *    signed in, passing the group id. Channel name `study-group:${id}`,
 *    presence key = `auth.uid()`.
 * 5. Persist the toggle to `study_group_members.shares_presence`.
 * 6. Friend / 学霸 relations come from a lighter table, not this channel —
 *    they must not see `lessonId` or the cursor.
 */
import { createClient } from "@supabase/supabase-js";
import {
  createRealtimePresencePort,
  type PresencePort,
  type PresenceRelation,
  type PresenceSelf,
} from "@pieai/university-core";

import { readSwimmerCorePublicEnv } from "./identity";

type BrowserEnv = Record<string, string | boolean | undefined>;

/** The switch that keeps this file from opening a channel. See the file comment. */
export function presenceAdapterIsWired(): boolean {
  return false;
}

export function createOnlinePresencePort(
  env: BrowserEnv,
  options: {
    readonly self: PresenceSelf;
    readonly groupId: string;
    readonly seeAs: (userId: string) => PresenceRelation | null;
  },
): PresencePort {
  if (!presenceAdapterIsWired()) return createRealtimePresencePort(null);

  const config = readSwimmerCorePublicEnv(env);
  if (!config) return createRealtimePresencePort(null);

  try {
    const client = createClient(config.url, config.publishableKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    const channel = client.channel(`study-group:${options.groupId}`, {
      config: {
        presence: { key: options.self.userId },
        broadcast: { ack: false, self: false },
      },
    });
    return createRealtimePresencePort({
      channel,
      self: options.self,
      seeAs: options.seeAs,
    });
  } catch {
    return createRealtimePresencePort(null);
  }
}
