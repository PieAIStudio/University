import { describe, expect, it } from "vitest";
import { emptyProgress, parseProgress } from "./document.js";
import { mergeProgress } from "./merge.js";
import {
  weeklyBossHistory,
  weeklyBossLocationEventId,
  weeklyBossWeekOrdinal,
} from "./weekly-boss-history.js";
import { weeklyBossWonEventId } from "./weekly-boss.js";

const NOW = new Date(2026, 9, 6, 12).getTime();
const location = { studyId: "s", courseId: "c", lessonId: "l" };
const wins = (...weeks: string[]) => {
  const doc = emptyProgress();
  for (const week of weeks) doc.xpEvents[weeklyBossWonEventId(week)] = 50;
  return doc;
};

describe("weekly boss history is a projection of wins, never another reward", () => {
  it("counts only real week identities, excluding hits, witnesses, invalid and future dates", () => {
    const doc = wins("2026-09-28", "2026-10-05", "2026-10-12", "2026-09-29", "2026-02-30");
    doc.xpEvents["weekly-boss:2026-09-21:flawless"] = 0;
    doc.xpEvents["weekly-boss:2026-09-21:hit:s/c/l#e"] = 10;
    doc.xpEvents[weeklyBossLocationEventId("2026-09-21", location)] = 0;
    const before = JSON.stringify(doc);
    const result = weeklyBossHistory(doc, NOW);
    expect(result.weeks.map((entry) => entry.week)).toEqual(["2026-10-05", "2026-09-28"]);
    expect(result.total).toBe(2);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("allows the current week to remain unfinished without erasing last week's run", () => {
    const doc = wins("2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28");
    expect(weeklyBossHistory(doc, NOW)).toMatchObject({
      total: 4,
      currentStreak: 4,
      longestStreak: 4,
    });
    expect(weeklyBossHistory(doc, new Date(2026, 9, 12, 12).getTime())).toMatchObject({
      currentStreak: 0,
      longestStreak: 4,
    });
  });

  it("never guesses a legacy win's island from the learner's current lessons", () => {
    const doc = wins("2026-09-28");
    expect(weeklyBossHistory(doc, NOW).weeks[0]!.location).toBeNull();
    doc.xpEvents[weeklyBossLocationEventId("2026-09-28", location)] = 0;
    const restored = parseProgress(JSON.stringify(doc));
    expect(weeklyBossHistory(restored, NOW).weeks[0]!.location).toEqual(location);
    expect(restored.totalXp).toBe(50);
  });

  it("resolves concurrent recorded locations deterministically without counting a week twice", () => {
    const a = wins("2026-09-28"),
      b = wins("2026-09-28");
    a.xpEvents[weeklyBossLocationEventId("2026-09-28", location)] = 0;
    b.xpEvents[weeklyBossLocationEventId("2026-09-28", { ...location, courseId: "z" })] = 0;
    expect(weeklyBossHistory(mergeProgress(a, b), NOW)).toEqual(
      weeklyBossHistory(mergeProgress(b, a), NOW),
    );
    expect(weeklyBossHistory(mergeProgress(a, b), NOW)).toMatchObject({
      total: 1,
      weeks: [{ location }],
    });
  });

  it("ignores malformed or nonzero location witnesses and does not mutate an account", () => {
    const doc = wins("2026-09-28");
    for (const suffix of ["%XX/c/l", "s/c", "s/c/l/extra", "s/c/%00"])
      doc.xpEvents[`weekly-boss:2026-09-28:location:v1:${suffix}`] = 0;
    doc.xpEvents[weeklyBossLocationEventId("2026-09-28", location)] = 7;
    expect(weeklyBossHistory(doc, NOW).weeks[0]!.location).toBeNull();
    expect(weeklyBossHistory(emptyProgress(), NOW)).toMatchObject({
      total: 0,
      currentStreak: 0,
      longestStreak: 0,
      weeks: [],
    });
  });

  it("uses calendar Mondays, not elapsed local hours or a rerolled seed", () => {
    expect(weeklyBossWeekOrdinal("2026-11-02")! - weeklyBossWeekOrdinal("2026-10-26")!).toBe(1);
    expect(weeklyBossWeekOrdinal("2026-09-28")).toBe(weeklyBossWeekOrdinal("2026-09-28"));
    expect(weeklyBossWeekOrdinal("2026-09-29")).toBeNull();
    expect(weeklyBossWeekOrdinal("not-a-week")).toBeNull();
  });
});
