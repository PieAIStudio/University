import type { ProgressDocument } from "../ports/progress.js";
import { weeklyBossFlawlessEventId, weeklyBossWeek, weeklyBossWonEventId } from "./weekly-boss.js";

export interface WeeklyBossLocation {
  readonly studyId: string;
  readonly courseId: string;
  /** The arrival stone, not a mutable reconstruction from today's progress. */
  readonly lessonId: string;
}
export interface WeeklyBossWin {
  readonly week: string;
  readonly flawless: boolean;
  /** Older wins did not record a location. Their count is still real. */
  readonly location: WeeklyBossLocation | null;
}
export interface WeeklyBossHistory {
  readonly total: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** Latest first; every valid won week is retained, independently of the scene budget. */
  readonly weeks: readonly WeeklyBossWin[];
}

/** Calendar arithmetic in UTC is only an ordinal: the caller still selects its
 * week in local time. DST cannot turn adjacent Mondays into six/eight days. */
export function weeklyBossWeekOrdinal(week: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(week)) return null;
  const date = new Date(`${week}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== week ||
    date.getUTCDay() !== 1
  )
    return null;
  return Math.floor(date.getTime() / 604_800_000);
}

const locationPrefix = (week: string) => `${weeklyBossWonEventId(week)}:location:v1:`;
const validPart = (value: string) =>
  value.length > 0 && value.length <= 128 && !value.includes("/") && !/\p{Cc}/u.test(value);

/** Zero XP, written before the unchanged win event. This cannot award a win,
 * capacity or a pack; it only remembers which real island held the fight. */
export function weeklyBossLocationEventId(week: string, location: WeeklyBossLocation): string {
  const parts = [location.studyId, location.courseId, location.lessonId];
  if (weeklyBossWeekOrdinal(week) === null || !parts.every(validPart))
    throw new Error("Invalid weekly boss location");
  return locationPrefix(week) + parts.map(encodeURIComponent).join("/");
}

function readLocation(value: string): WeeklyBossLocation | null {
  try {
    const parts = value.split("/").map(decodeURIComponent);
    if (parts.length !== 3 || !parts.every(validPart)) return null;
    const [studyId, courseId, lessonId] = parts as [string, string, string];
    return { studyId, courseId, lessonId };
  } catch {
    return null;
  }
}

/** A read-only projection, using the existing XP set-union merge. Hits and
 * presentation witnesses never count as wins. Concurrent offline witnesses use
 * one canonical recorded location (lexical ID order), not a fabricated island. */
export function weeklyBossHistory(document: ProgressDocument, now: number): WeeklyBossHistory {
  const current = weeklyBossWeekOrdinal(weeklyBossWeek(now));
  const candidates: { win: WeeklyBossWin; ordinal: number }[] = [];
  const locations = new Map<string, { id: string; location: WeeklyBossLocation }>();
  for (const [id, amount] of Object.entries(document.xpEvents)) {
    if (amount !== 0) continue;
    const match = /^weekly-boss:(\d{4}-\d{2}-\d{2}):location:v1:(.+)$/u.exec(id);
    if (!match) continue;
    const location = readLocation(match[2]!);
    if (!location) continue;
    const known = locations.get(match[1]!);
    if (!known || id < known.id) locations.set(match[1]!, { id, location });
  }
  for (const [id, amount] of Object.entries(document.xpEvents)) {
    const match = /^weekly-boss:(\d{4}-\d{2}-\d{2})$/u.exec(id);
    if (!match || !Number.isSafeInteger(amount) || amount < 0) continue;
    const week = match[1]!,
      ordinal = weeklyBossWeekOrdinal(week);
    if (current === null || ordinal === null || ordinal > current) continue;
    candidates.push({
      ordinal,
      win: {
        week,
        flawless: document.xpEvents[weeklyBossFlawlessEventId(week)] === 0,
        location: locations.get(week)?.location ?? null,
      },
    });
  }
  candidates.sort((a, b) => b.ordinal - a.ordinal);
  let longestStreak = 0,
    currentStreak = 0,
    run = 0;
  let previous: number | null = null;
  const active =
    current !== null && candidates[0] !== undefined && candidates[0].ordinal >= current - 1;
  let firstRun = true;
  for (const entry of candidates) {
    if (previous !== null && previous - entry.ordinal !== 1) {
      run = 0;
      firstRun = false;
    }
    run++;
    longestStreak = Math.max(longestStreak, run);
    if (active && firstRun) currentStreak = run;
    previous = entry.ordinal;
  }
  return {
    total: candidates.length,
    currentStreak,
    longestStreak,
    weeks: candidates.map((entry) => entry.win),
  };
}
