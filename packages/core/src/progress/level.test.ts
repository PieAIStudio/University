import { describe, expect, it } from "vitest";

import { XP_EXERCISE_FIRST_TRY, XP_READ_LESSON } from "./xp.js";
import { levelOf, totalXpForLevel } from "./level.js";

const FIRST_LEVEL = 1;
const NEXT_LEVEL = FIRST_LEVEL + 1;
const FIRST_LESSON_XP = XP_READ_LESSON + XP_EXERCISE_FIRST_TRY;

describe("levelOf", () => {
  it("starts at level one without producing a NaN fraction", () => {
    expect(levelOf(0)).toEqual({
      level: FIRST_LEVEL,
      xpIntoLevel: 0,
      xpForNextLevel: totalXpForLevel(NEXT_LEVEL) - totalXpForLevel(FIRST_LEVEL),
      fraction: 0,
      totalXp: 0,
    });
  });

  it("puts the first lesson's combined XP at the first upgrade", () => {
    expect(levelOf(FIRST_LESSON_XP).level).toBe(NEXT_LEVEL);
  });

  it("keeps every sampled total inside its reported level", () => {
    const samples = [
      0,
      FIRST_LESSON_XP,
      totalXpForLevel(FIRST_LEVEL + 2),
      totalXpForLevel(FIRST_LEVEL + 9),
      totalXpForLevel(FIRST_LEVEL + 19),
      totalXpForLevel(FIRST_LEVEL + 20),
    ];

    for (const totalXp of samples) {
      const result = levelOf(totalXp);
      expect(totalXpForLevel(result.level)).toBeLessThanOrEqual(totalXp);
      expect(totalXp).toBeLessThan(totalXpForLevel(result.level + 1));
      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(result.fraction).toBeLessThanOrEqual(1);
    }
  });

  it("is monotonic at thresholds and between thresholds", () => {
    let previousLevel = FIRST_LEVEL;
    for (let level = FIRST_LEVEL; level <= FIRST_LEVEL + 20; level += 1) {
      const threshold = totalXpForLevel(level);
      const atThreshold = levelOf(threshold);
      expect(atThreshold.level).toBeGreaterThanOrEqual(previousLevel);
      expect(atThreshold.fraction).toBe(0);
      previousLevel = atThreshold.level;

      const nextThreshold = totalXpForLevel(level + 1);
      const beforeNext = levelOf(nextThreshold - 1);
      expect(beforeNext.level).toBe(level);
      expect(beforeNext.fraction).toBeGreaterThanOrEqual(0);
      expect(beforeNext.fraction).toBeLessThanOrEqual(1);
    }
  });
});
