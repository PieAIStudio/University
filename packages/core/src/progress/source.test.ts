import { describe, expect, it } from "vitest";

import type { ExerciseAttemptRecord, LessonProgress, ProgressPort } from "../ports/progress.js";
import type { LessonProgressSnapshot, LessonRef } from "./contract.js";
import { lessonKeyOf } from "./document.js";
import { progressSourceOf } from "./source.js";

const REF: LessonRef = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
};

function port(
  state: LessonProgress,
  attempts: readonly ExerciseAttemptRecord[] = [],
): ProgressPort {
  return {
    lessonState: (key) => {
      expect(key).toBe(lessonKeyOf(REF));
      return state;
    },
    latestExerciseAttempt: (_locator, exerciseId, contentRevision) =>
      attempts.find(
        (attempt) =>
          attempt.exerciseId === exerciseId && attempt.contentRevision === contentRevision,
      ) ?? null,
  } as unknown as ProgressPort;
}

function snapshot(
  contentRevision: number,
  exerciseIds: readonly string[] = [],
): LessonProgressSnapshot {
  return { contentRevision, exerciseIds };
}

function passed(exerciseId: string, contentRevision: number): ExerciseAttemptRecord {
  return {
    commandId: `${exerciseId}-${contentRevision}`,
    locator: REF,
    exerciseId,
    contentRevision,
    answer: "answer",
    score: 1,
    maxScore: 1,
    hostGrade: {
      passed: true,
      evaluation: "通过",
      extensions: [],
      host: "test",
      learnerAnswer: "answer",
      occurredAt: "2026-08-26T00:00:00.000Z",
    },
    occurredAt: "2026-08-26T00:00:00.000Z",
  };
}

describe("progressSourceOf", () => {
  it("returns NOT_STARTED when neither independent fact exists", () => {
    expect(
      progressSourceOf(port({ progress: 0, completedAt: null, attempts: 0 })).completionOf(
        REF,
        snapshot(8, ["exercise"]),
      ),
    ).toEqual({ exercisesPassed: false, readConfirmed: false });
  });

  it("derives exercise completion from every current-version host grade", () => {
    const current = snapshot(8, ["first", "second"]);
    const source = progressSourceOf(
      port(
        {
          progress: 1,
          completedAt: null,
          attempts: 2,
          readConfirmed: true,
          readConfirmedRevision: 8,
        },
        [passed("first", 8)],
      ),
    );

    expect(source.completionOf(REF, current)).toEqual({
      exercisesPassed: false,
      readConfirmed: true,
    });
  });

  it("does not reuse a passing attempt from an older content revision", () => {
    const source = progressSourceOf(
      port(
        {
          progress: 1,
          completedAt: null,
          attempts: 1,
          readConfirmed: true,
          readConfirmedRevision: 8,
        },
        [passed("exercise", 7)],
      ),
    );

    expect(source.completionOf(REF, snapshot(8, ["exercise"]))).toEqual({
      exercisesPassed: false,
      readConfirmed: true,
    });
  });

  it("accepts a read confirmation from the caller's current revision", () => {
    const source = progressSourceOf(
      port({
        progress: 0,
        completedAt: null,
        attempts: 0,
        readConfirmed: true,
        readConfirmedRevision: 8,
      }),
    );

    expect(source.completionOf(REF, snapshot(8, ["exercise"]))).toEqual({
      exercisesPassed: false,
      readConfirmed: true,
    });
  });

  it("does not accept a read confirmation from another revision", () => {
    const source = progressSourceOf(
      port({
        progress: 0,
        completedAt: null,
        attempts: 0,
        readConfirmed: true,
        readConfirmedRevision: 7,
      }),
    );

    expect(source.completionOf(REF, snapshot(8))).toEqual({
      exercisesPassed: true,
      readConfirmed: false,
    });
  });

  it("counts a lesson with no exercises as passed after the current read confirmation", () => {
    const source = progressSourceOf(
      port({
        progress: 0,
        completedAt: null,
        attempts: 0,
        readConfirmed: true,
        readConfirmedRevision: 8,
      }),
    );

    expect(source.completionOf(REF, snapshot(8))).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });

  it("does not treat an incomplete exercise list as an empty lesson", () => {
    const source = progressSourceOf(
      port({
        progress: 0,
        completedAt: null,
        attempts: 0,
        readConfirmed: true,
        readConfirmedRevision: 8,
      }),
    );

    expect(
      source.completionOf(REF, {
        contentRevision: 8,
        exerciseIds: [],
        exerciseIdsComplete: false,
      }),
    ).toEqual({
      exercisesPassed: false,
      readConfirmed: true,
    });
  });

  it("keeps legacy progress-1 records complete without exercise attempts", () => {
    const source = progressSourceOf(
      port({ progress: 1, completedAt: null, attempts: 1, readConfirmed: undefined }),
    );

    expect(source.completionOf(REF, snapshot(8, ["exercise"]))).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });
});
