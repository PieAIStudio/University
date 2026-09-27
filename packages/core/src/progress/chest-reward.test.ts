import { describe, expect, it } from "vitest";

import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { allFirstTry, chestBaseline, chestReward } from "./chest-reward.js";
import { emptyProgress } from "./document.js";

const LESSON = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l1" } as const;

function attempt(
  exerciseId: string,
  score: number,
  occurredAt: string,
  lessonId = LESSON.lessonId,
): ExerciseAttemptRecord {
  return {
    commandId: `${exerciseId}:${occurredAt}`,
    locator: { ...LESSON, lessonId },
    exerciseId,
    contentRevision: 1,
    answer: "a",
    score,
    maxScore: 1,
    hostGrade: null,
    occurredAt,
  };
}

function withAttempts(...records: ExerciseAttemptRecord[]): ProgressDocument {
  const document = emptyProgress();
  for (const record of records) document.exerciseAttempts[record.commandId] = record;
  return document;
}

describe("a lesson's chest", () => {
  it("upgrades only when every exercise was right on its first attempt", () => {
    expect(
      allFirstTry(
        withAttempts(
          attempt("e1", 1, "2026-09-27T01:00:00Z"),
          attempt("e2", 1, "2026-09-27T01:01:00Z"),
        ),
        LESSON,
      ),
    ).toBe(true);
    // Wrong first, right later: no upgrade, however it ended.
    expect(
      allFirstTry(
        withAttempts(
          attempt("e1", 0, "2026-09-27T01:00:00Z"),
          attempt("e1", 1, "2026-09-27T01:02:00Z"),
        ),
        LESSON,
      ),
    ).toBe(false);
    // Another lesson's perfect answers do not count here.
    expect(allFirstTry(withAttempts(attempt("e1", 1, "2026-09-27T01:00:00Z", "l2")), LESSON)).toBe(
      false,
    );
    // A lesson with nothing to answer never upgrades.
    expect(allFirstTry(emptyProgress(), LESSON)).toBe(false);
  });

  it("holds exactly what the record gained during the lesson", () => {
    const before = emptyProgress();
    const baseline = chestBaseline(before);
    const after = emptyProgress();
    after.totalXp = 40;
    after.streak = { days: 1, lastDay: "2026-09-27" };
    after.lessons["s/c/l1"] = {
      completedAt: 1,
      readAt: 1,
    } as unknown as ProgressDocument["lessons"][string];
    const reward = chestReward({
      baseline,
      after,
      locator: LESSON,
      reviewCards: 2,
      knowledgeCards: 1,
    });
    expect(reward).toMatchObject({
      xp: 40,
      levelBefore: 1,
      levelAfter: 2,
      reviewCards: 2,
      knowledgeCards: 1,
      streakDay: 1,
    });
    expect(reward.badges.map((badge) => badge.id)).toEqual(["first-lesson"]);
  });

  it("never announces a badge the learner already had", () => {
    const before = emptyProgress();
    before.lessons["s/c/l0"] = {
      completedAt: 1,
      readAt: 1,
    } as unknown as ProgressDocument["lessons"][string];
    const baseline = chestBaseline(before);
    const after = structuredClone(before);
    after.lessons["s/c/l1"] = {
      completedAt: 2,
      readAt: 2,
    } as unknown as ProgressDocument["lessons"][string];
    const reward = chestReward({
      baseline,
      after,
      locator: LESSON,
      reviewCards: 0,
      knowledgeCards: 0,
    });
    expect(reward.badges).toEqual([]);
    expect(reward.xp).toBe(0);
  });
});
