import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { describe, expect, it } from "vitest";

import { emptyProgress } from "./document.js";
import { answerStatsForAttempts, answerStatsOf } from "./answer-stats.js";

const LOCATOR = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
} as const;

function attempt(
  commandId: string,
  options: {
    readonly exerciseId: string;
    readonly occurredAt: string;
    readonly passed: boolean | null;
    readonly contentRevision?: number;
    readonly locator?: Partial<typeof LOCATOR>;
  },
): ExerciseAttemptRecord {
  const hostGrade =
    options.passed === null
      ? null
      : {
          passed: options.passed,
          evaluation: options.passed ? "答对了" : "再想想",
          extensions: [],
          host: "test",
          learnerAnswer: "answer",
          occurredAt: options.occurredAt,
        };
  return {
    commandId,
    locator: { ...LOCATOR, ...options.locator },
    exerciseId: options.exerciseId,
    contentRevision: options.contentRevision ?? 3,
    answer: "answer",
    score: options.passed === true ? 1 : 0,
    maxScore: 1,
    hostGrade,
    occurredAt: options.occurredAt,
  };
}

function documentOf(...records: readonly ExerciseAttemptRecord[]): ProgressDocument {
  const document = emptyProgress();
  document.exerciseAttempts = Object.fromEntries(
    records.map((record) => [record.commandId, record]),
  );
  return document;
}

describe("answerStatsOf", () => {
  it("counts only the requested lesson revision and keeps retries out of first-pass rate", () => {
    const stats = answerStatsOf(
      documentOf(
        attempt("a-first", {
          exerciseId: "a",
          occurredAt: "2026-08-30T09:00:00.000Z",
          passed: false,
        }),
        attempt("a-retry", {
          exerciseId: "a",
          occurredAt: "2026-08-30T09:01:00.000Z",
          passed: true,
        }),
        attempt("b-first", {
          exerciseId: "b",
          occurredAt: "2026-08-30T09:02:00.000Z",
          passed: true,
        }),
        attempt("c-pending", {
          exerciseId: "c",
          occurredAt: "2026-08-30T09:03:00.000Z",
          passed: null,
        }),
        attempt("old-revision", {
          exerciseId: "old",
          occurredAt: "2026-08-30T08:00:00.000Z",
          passed: true,
          contentRevision: 2,
        }),
        attempt("other-lesson", {
          exerciseId: "other",
          occurredAt: "2026-08-30T08:30:00.000Z",
          passed: true,
          locator: { lessonId: "other-lesson" },
        }),
      ),
      LOCATOR,
      3,
      4,
    );

    expect(stats).toEqual({
      exerciseCount: 4,
      firstAttemptCount: 3,
      firstPassCount: 1,
      firstPassRate: null,
      totalAttempts: 4,
      pendingFirstAttemptCount: 1,
    });
  });

  it("uses a deterministic timestamp tie-break and reports a complete rate once graded", () => {
    const sameTime = "2026-08-30T09:00:00.000Z";
    const stats = answerStatsForAttempts(
      [
        attempt("z-command", { exerciseId: "a", occurredAt: sameTime, passed: true }),
        attempt("a-command", { exerciseId: "a", occurredAt: sameTime, passed: false }),
        attempt("b-command", {
          exerciseId: "b",
          occurredAt: "2026-08-30T09:01:00.000Z",
          passed: true,
        }),
      ],
      2,
    );

    expect(stats.firstAttemptCount).toBe(2);
    expect(stats.firstPassCount).toBe(1);
    expect(stats.firstPassRate).toBe(0.5);
    expect(stats.totalAttempts).toBe(3);
    expect(stats.pendingFirstAttemptCount).toBe(0);
  });

  it("does not turn an empty or ungraded set into a fake percentage", () => {
    expect(answerStatsForAttempts([], 2)).toMatchObject({
      exerciseCount: 2,
      firstAttemptCount: 0,
      firstPassCount: 0,
      firstPassRate: null,
      totalAttempts: 0,
      pendingFirstAttemptCount: 0,
    });

    expect(
      answerStatsForAttempts(
        [
          attempt("pending", {
            exerciseId: "a",
            occurredAt: "2026-08-30T09:00:00.000Z",
            passed: null,
          }),
        ],
        1,
      ).firstPassRate,
    ).toBeNull();
  });
});
