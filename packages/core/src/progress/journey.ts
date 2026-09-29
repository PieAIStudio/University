import { calendarDay, startOfWeek } from "./goals.js";

/** Presentation history, not learning, entitlement or permission to send mail. */
export interface JourneyHistory {
  readonly saveDays: readonly string[];
  readonly memberWeek?: string;
}

/** Explicit account-owned intent. A sender still needs its own verified backend. */
export interface ReviewEmailIntent {
  readonly enabled: boolean;
  readonly timezone: string;
  readonly schedule: "cards-due";
}

function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseJourneyHistory(value: unknown): JourneyHistory | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const saveDays = Array.isArray(raw.saveDays)
    ? [...new Set(raw.saveDays.filter(day))].sort().slice(0, 2)
    : [];
  return { saveDays, ...(day(raw.memberWeek) ? { memberWeek: raw.memberWeek } : {}) };
}

/** Union prevents a second device from resurrecting an already shown prompt. */
export function mergeJourneyHistory(
  left: JourneyHistory | undefined,
  right: JourneyHistory | undefined,
): JourneyHistory | undefined {
  if (!left && !right) return undefined;
  return parseJourneyHistory({
    saveDays: [...(left?.saveDays ?? []), ...(right?.saveDays ?? [])],
    memberWeek: [left?.memberWeek, right?.memberWeek].filter(day).sort().at(-1),
  });
}

/** Day 1 after a real completion, then once on/after day 3; never every day. */
export function shouldOfferEmailSave(
  history: JourneyHistory | undefined,
  now: number,
  completedLessons: number,
): boolean {
  if (completedLessons < 1 || !Number.isFinite(now)) return false;
  const today = calendarDay(now);
  const days = history?.saveDays ?? [];
  if (days.includes(today) || days.length >= 2) return false;
  if (days.length === 0) return true;
  // Compare calendar dates, not 48 elapsed hours across a daylight-saving change.
  return Date.parse(`${today}T00:00:00Z`) - Date.parse(`${days[0]}T00:00:00Z`) >= 2 * 86_400_000;
}

export function journeyWeek(now: number): string {
  return calendarDay(startOfWeek(now));
}

export function shouldOfferMemberLine(history: JourneyHistory | undefined, now: number): boolean {
  return Number.isFinite(now) && (history?.memberWeek ?? "") < journeyWeek(now);
}

export function recordJourneyShown(
  history: JourneyHistory | undefined,
  kind: "save" | "member",
  now: number,
): JourneyHistory {
  if (!Number.isFinite(now)) return history ?? { saveDays: [] };
  return mergeJourneyHistory(history, {
    saveDays: kind === "save" ? [calendarDay(now)] : [],
    ...(kind === "member" ? { memberWeek: journeyWeek(now) } : {}),
  })!;
}

export function parseReviewEmailIntent(value: unknown): ReviewEmailIntent | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.enabled !== "boolean" ||
    raw.schedule !== "cards-due" ||
    typeof raw.timezone !== "string" ||
    raw.timezone.length > 80
  )
    return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: raw.timezone }).format(0);
  } catch {
    return undefined;
  }
  return { enabled: raw.enabled, timezone: raw.timezone, schedule: "cards-due" };
}
