/** Optional V7 preferences carried by the existing account document. No
 * subscription is sent by this module, and a daily goal never changes difficulty. */
export const DAILY_LESSON_GOALS = [1, 2, 3] as const;
export type DailyLessonGoal = (typeof DAILY_LESSON_GOALS)[number];
export function dailyLessonGoal(value: unknown): DailyLessonGoal {
  return value === 2 || value === 3 ? value : 1;
}

export interface DomainInterest {
  readonly enabled: boolean;
  readonly email: string | null;
  readonly changedAt: string;
}
export type DomainInterests = Readonly<Record<string, DomainInterest>>;
const validDomain = (id: string) => /^[a-z][a-z0-9-]{0,63}$/.test(id);
export function domainInterestEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 &&
    !Array.from(email).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
    ? email
    : null;
}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function parseDomainInterests(value: unknown): DomainInterests {
  if (!record(value)) return {};
  const result: Record<string, DomainInterest> = {};
  for (const [id, item] of Object.entries(value).slice(0, 32)) {
    if (
      !validDomain(id) ||
      !record(item) ||
      typeof item.changedAt !== "string" ||
      !Number.isFinite(Date.parse(item.changedAt)) ||
      typeof item.enabled !== "boolean"
    )
      continue;
    const email = item.enabled ? domainInterestEmail(item.email) : null;
    if (item.enabled && !email) continue;
    result[id] = {
      enabled: item.enabled,
      email,
      changedAt: new Date(item.changedAt).toISOString(),
    };
  }
  return result;
}

/** Per-domain clocks let two devices express interest in different topics.
 * Concurrent withdrawal wins and deletes the address from the current receipt. */
export function mergeDomainInterests(left: unknown, right: unknown): DomainInterests {
  const a = parseDomainInterests(left),
    b = parseDomainInterests(right);
  const result: Record<string, DomainInterest> = { ...a };
  for (const [id, incoming] of Object.entries(b)) {
    const previous = Object.hasOwn(result, id) ? result[id] : undefined;
    if (!previous) {
      result[id] = incoming;
      continue;
    }
    const difference = Date.parse(incoming.changedAt) - Date.parse(previous.changedAt);
    if (
      difference > 0 ||
      (difference === 0 &&
        (!incoming.enabled ||
          (previous.enabled && (incoming.email ?? "") < (previous.email ?? ""))))
    )
      result[id] = incoming;
  }
  return result;
}

export function setDomainInterest(
  current: unknown,
  id: string,
  enabled: boolean,
  email: unknown,
  now: number,
): DomainInterests | null {
  if (!validDomain(id) || !Number.isFinite(new Date(now).getTime())) return null;
  const address = enabled ? domainInterestEmail(email) : null;
  if (enabled && !address) return null;
  const parsed = parseDomainInterests(current);
  const before = Object.hasOwn(parsed, id) ? Date.parse(parsed[id]!.changedAt) : -Infinity;
  const changed = new Date(Math.max(now, before + 1));
  if (!Number.isFinite(changed.getTime())) return null;
  const changedAt = changed.toISOString();
  return { ...parsed, [id]: { enabled, email: address, changedAt } };
}
