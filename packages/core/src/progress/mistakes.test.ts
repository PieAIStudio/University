import { describe, expect, it } from "vitest";

import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { emptyProgress } from "./document.js";
import { mistakesOf } from "./mistakes.js";

const LOCATOR = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
} as const;

function attempt(
  commandId: string,
  options: {
    readonly occurredAt: string;
    readonly answer: string;
    readonly passed: boolean | null;
    readonly exerciseId?: string;
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
          learnerAnswer: options.answer,
          occurredAt: options.occurredAt,
        };
  return {
    commandId,
    locator: { ...LOCATOR, ...options.locator },
    exerciseId: options.exerciseId ?? "exercise",
    contentRevision: options.contentRevision ?? 1,
    answer: options.answer,
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

describe("mistakesOf", () => {
  it("keeps the latest wrong answer and counts every failed attempt", () => {
    expect(
      mistakesOf(
        documentOf(
          attempt("wrong-1", {
            occurredAt: "2026-08-26T09:00:00.000Z",
            answer: "第一次回答",
            passed: false,
          }),
          attempt("wrong-2", {
            occurredAt: "2026-08-26T10:00:00.000Z",
            answer: "第二次回答",
            passed: false,
          }),
        ),
      ),
    ).toEqual([
      {
        locator: LOCATOR,
        exerciseId: "exercise",
        contentRevision: 1,
        wrongAnswer: "第二次回答",
        wrongAt: "2026-08-26T10:00:00.000Z",
        wrongCount: 2,
        corrected: false,
      },
    ]);
  });

  it("marks a mistake corrected only when a pass follows the latest wrong answer", () => {
    const corrected = mistakesOf(
      documentOf(
        attempt("wrong", {
          occurredAt: "2026-08-26T09:00:00.000Z",
          answer: "错",
          passed: false,
        }),
        attempt("pass", {
          occurredAt: "2026-08-26T10:00:00.000Z",
          answer: "对",
          passed: true,
        }),
      ),
    )[0];
    expect(corrected).toMatchObject({
      corrected: true,
      correctedAt: "2026-08-26T10:00:00.000Z",
      wrongCount: 1,
    });

    const wrongAgain = mistakesOf(
      documentOf(
        attempt("wrong", {
          occurredAt: "2026-08-26T09:00:00.000Z",
          answer: "错",
          passed: false,
        }),
        attempt("pass", {
          occurredAt: "2026-08-26T10:00:00.000Z",
          answer: "对",
          passed: true,
        }),
        attempt("wrong-again", {
          occurredAt: "2026-08-26T11:00:00.000Z",
          answer: "又错",
          passed: false,
        }),
      ),
    )[0];
    expect(wrongAgain).toMatchObject({ corrected: false, wrongAnswer: "又错", wrongCount: 2 });
  });

  it("ignores attempts waiting for a verdict", () => {
    expect(
      mistakesOf(
        documentOf(
          attempt("pending", {
            occurredAt: "2026-08-26T09:00:00.000Z",
            answer: "还没判",
            passed: null,
          }),
        ),
      ),
    ).toEqual([]);
  });

  it("drops an older content revision and sorts uncorrected rows first", () => {
    const result = mistakesOf(
      documentOf(
        attempt("uncorrected-old", {
          occurredAt: "2026-08-26T11:00:00.000Z",
          answer: "还没修",
          passed: false,
          exerciseId: "uncorrected",
        }),
        attempt("corrected-wrong", {
          occurredAt: "2026-08-26T12:00:00.000Z",
          answer: "旧错",
          passed: false,
          exerciseId: "corrected",
        }),
        attempt("corrected-pass", {
          occurredAt: "2026-08-26T13:00:00.000Z",
          answer: "修好",
          passed: true,
          exerciseId: "corrected",
        }),
        attempt("old-revision", {
          occurredAt: "2026-08-26T14:00:00.000Z",
          answer: "旧版本错",
          passed: false,
          exerciseId: "revised",
          contentRevision: 1,
        }),
        attempt("new-revision", {
          occurredAt: "2026-08-26T15:00:00.000Z",
          answer: "新版本错",
          passed: false,
          exerciseId: "revised",
          contentRevision: 2,
        }),
      ),
    );

    expect(result.map((mistake) => [mistake.exerciseId, mistake.contentRevision])).toEqual([
      ["revised", 2],
      ["uncorrected", 1],
      ["corrected", 1],
    ]);
    expect(result[0]).toMatchObject({ wrongAnswer: "新版本错", wrongCount: 1 });
  });

  it("does not keep an old mistake when the newest known revision only passed", () => {
    expect(
      mistakesOf(
        documentOf(
          attempt("old-wrong", {
            occurredAt: "2026-08-26T09:00:00.000Z",
            answer: "旧版本错",
            passed: false,
            contentRevision: 1,
            exerciseId: "revised",
          }),
          attempt("new-pass", {
            occurredAt: "2026-08-26T10:00:00.000Z",
            answer: "新版本对",
            passed: true,
            contentRevision: 2,
            exerciseId: "revised",
          }),
        ),
      ),
    ).toEqual([]);
  });
});
