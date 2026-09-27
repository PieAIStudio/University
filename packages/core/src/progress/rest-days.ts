/**
 * Rest-day tickets (V7 station 6): a missed day the learner held a ticket for
 * does not break the streak. The streak is meant to encourage, and one missed
 * Tuesday wiping out forty days turns it into a new source of worry.
 *
 * A ticket is granted once a week, the first time the learner shows up that
 * week, and once more each time the streak reaches another seven days. When
 * the learner comes back after missing days and holds enough tickets, the
 * missed days are covered and the streak carries on; covered days do not add
 * to the count, they only keep it.
 *
 * What is stored is two sets of names — the grants (`week:2026-09-28`,
 * `streak:2026-10-05`) and the covered days — never a running balance, so two
 * devices merge by union and a grant made on both is still one ticket. The
 * cost of that choice: if two offline devices each spend the last ticket on a
 * different day, both days stay covered and the balance reads zero, not
 * negative.
 */
import type { ProgressDocument } from "../ports/progress.js";
import { calendarDay, startOfWeek } from "./goals.js";

export type Streak = ProgressDocument["streak"];
export type RestDays = NonNullable<Streak["rest"]>;

/** A grant is named after the day it was earned, so granting twice is granting once. */
const weeklyGrant = (day: string) => `week:${calendarDay(startOfWeek(dayStart(day)))}`;
const streakGrant = (day: string) => `streak:${day}`;
/** The streak earns a ticket at every multiple of this many days. */
export const STREAK_TICKET_EVERY = 7;

/** Local midnight at the start of a `YYYY-MM-DD` day. */
function dayStart(day: string): number {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, date).getTime();
}

/** The day `count` days after `day`, stepping calendar days so a DST change cannot skip one. */
function addDays(day: string, count: number): string {
  const date = new Date(dayStart(day));
  date.setDate(date.getDate() + count);
  return calendarDay(date.getTime());
}

/** Whole days missed strictly between `from` and `to`. */
function missedBetween(from: string, to: string): string[] {
  const missed: string[] = [];
  for (let day = addDays(from, 1); day < to; day = addDays(day, 1)) missed.push(day);
  return missed;
}

export function restTicketBalance(streak: Streak): number {
  const rest = streak.rest;
  return rest ? Math.max(0, rest.granted.length - rest.covered.length) : 0;
}

/**
 * The streak after the learner does something on the day containing `now`.
 * Pure: `touchStreak` in the progress port stores what this returns.
 */
export function advanceStreak(streak: Streak, now: number): Streak {
  const today = calendarDay(now);
  if (streak.lastDay === today) return streak;
  const granted = new Set(streak.rest?.granted ?? []);
  const covered = new Set(streak.rest?.covered ?? []);
  granted.add(weeklyGrant(today));

  let days = 1;
  if (streak.lastDay !== null && streak.lastDay < today) {
    const missed = missedBetween(streak.lastDay, today);
    const balance = granted.size - covered.size;
    if (missed.length === 0) days = streak.days + 1;
    else if (missed.length <= balance) {
      for (const day of missed) covered.add(day);
      days = streak.days + 1;
    }
  }
  if (days % STREAK_TICKET_EVERY === 0) granted.add(streakGrant(today));
  return {
    days,
    lastDay: today,
    rest: { granted: [...granted].sort(), covered: [...covered].sort() },
  };
}

/** Both devices' grants and covered days survive a merge. */
export function mergeRestDays(a: Streak["rest"], b: Streak["rest"]): RestDays | undefined {
  if (!a && !b) return undefined;
  const union = (x: readonly string[] = [], y: readonly string[] = []) =>
    [...new Set([...x, ...y])].sort();
  return { granted: union(a?.granted, b?.granted), covered: union(a?.covered, b?.covered) };
}
