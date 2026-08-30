import type { ExerciseAttemptRecord, LessonRef } from "@pieai/university-core";
import { describe, expect, it } from "vitest";
import type { StudyView } from "@pieai/university-ui/view/lesson-view.js";

import { buildAnswerOverview } from "./AnswerOverview";

const studyView = {
  study: {
    id: "study",
    title: "示例课",
    description: "",
    goals: [],
    defaultCourseId: "course",
  },
  courses: [
    {
      id: "course",
      title: "第一门课",
      description: "",
      audience: "",
      objectives: [],
      status: "active",
      isDefault: true,
      units: [
        {
          id: "unit",
          title: "第一单元",
          objective: "",
          status: "active",
          lessons: [
            {
              id: "first",
              title: "第一节",
              status: "active",
              contentRevision: 3,
              cardCount: 0,
              exerciseCount: 2,
              exerciseIds: ["one", "two"],
              contentChars: 10,
              progress: null,
            },
            {
              id: "second",
              title: "第二节",
              status: "active",
              contentRevision: 4,
              cardCount: 0,
              exerciseCount: 1,
              exerciseIds: ["three"],
              contentChars: 10,
              progress: null,
            },
          ],
        },
      ],
    },
  ],
  notes: [],
} satisfies StudyView;

const firstLesson: LessonRef = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "first",
};

/** A study of one course whose lessons all sit at revision 3 with one exercise. */
function viewOf(lessons: readonly { readonly id: string; readonly title: string }[]): StudyView {
  return {
    ...studyView,
    courses: [
      {
        ...studyView.courses[0]!,
        units: [
          {
            ...studyView.courses[0]!.units[0]!,
            lessons: lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              status: "active" as const,
              contentRevision: 3,
              cardCount: 0,
              exerciseCount: 1,
              exerciseIds: ["one"],
              contentChars: 10,
              progress: null,
            })),
          },
        ],
      },
    ],
  } satisfies StudyView;
}

function attempt(
  commandId: string,
  locator: LessonRef,
  options: {
    readonly exerciseId: string;
    readonly occurredAt: string;
    readonly passed: boolean;
    readonly contentRevision: number;
  },
): ExerciseAttemptRecord {
  return {
    commandId,
    locator,
    exerciseId: options.exerciseId,
    contentRevision: options.contentRevision,
    answer: "answer",
    score: options.passed ? 1 : 0,
    maxScore: 1,
    hostGrade: {
      passed: options.passed,
      evaluation: options.passed ? "答对了" : "再想想",
      extensions: [],
      host: "test",
      learnerAnswer: "answer",
      occurredAt: options.occurredAt,
    },
    occurredAt: options.occurredAt,
  };
}

describe("answer overview", () => {
  it("lists the answered lessons and only counts attempts for its current revision", () => {
    const secondLesson = { ...firstLesson, lessonId: "second" };
    const model = buildAnswerOverview(studyView, {
      exerciseAttempts: Object.fromEntries([
        [
          "first-failed",
          attempt("first-failed", firstLesson, {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:00:00.000Z",
            passed: false,
            contentRevision: 3,
          }),
        ],
        [
          "first-retry",
          attempt("first-retry", firstLesson, {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:01:00.000Z",
            passed: true,
            contentRevision: 3,
          }),
        ],
        [
          "second-old-revision",
          attempt("second-old-revision", secondLesson, {
            exerciseId: "three",
            occurredAt: "2026-08-30T09:02:00.000Z",
            passed: true,
            contentRevision: 3,
          }),
        ],
      ]),
    });

    expect(model.courses).toHaveLength(1);
    // 第二节's only attempt belongs to an older revision, so this revision has
    // no first answer for it. A lesson with nothing recorded is counted, not
    // ranked: giving it a row would be giving it a verdict it did not earn.
    expect(model.courses[0]?.lessons.map((lesson) => lesson.title)).toEqual(["第一节"]);
    expect(model.courses[0]?.lessonCount).toBe(2);
    expect(model.courses[0]?.unansweredCount).toBe(1);
    expect(model.empty).toBe(false);
    expect(model.courses[0]?.lessons[0]?.stats).toMatchObject({
      firstAttemptCount: 1,
      firstPassCount: 0,
      firstPassRate: 0,
      totalAttempts: 2,
    });
  });

  it("puts the most stuck lesson first, because that is what the heading asks", () => {
    const studyView = viewOf([
      { id: "easy", title: "轻松那节" },
      { id: "hard", title: "卡住那节" },
      { id: "medium", title: "中间那节" },
    ]);
    const at = (lessonId: string) => ({ ...firstLesson, lessonId });
    const model = buildAnswerOverview(studyView, {
      exerciseAttempts: Object.fromEntries([
        // Passed on the first try.
        [
          "e1",
          attempt("e1", at("easy"), {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:00:00.000Z",
            passed: true,
            contentRevision: 3,
          }),
        ],
        // Failed first, and kept costing attempts after that.
        [
          "h1",
          attempt("h1", at("hard"), {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:00:00.000Z",
            passed: false,
            contentRevision: 3,
          }),
        ],
        [
          "h2",
          attempt("h2", at("hard"), {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:01:00.000Z",
            passed: false,
            contentRevision: 3,
          }),
        ],
        [
          "h3",
          attempt("h3", at("hard"), {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:02:00.000Z",
            passed: true,
            contentRevision: 3,
          }),
        ],
        // Failed first, but was not fought over.
        [
          "m1",
          attempt("m1", at("medium"), {
            exerciseId: "one",
            occurredAt: "2026-08-30T09:00:00.000Z",
            passed: false,
            contentRevision: 3,
          }),
        ],
      ]),
    });

    expect(model.courses[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "卡住那节",
      "中间那节",
      "轻松那节",
    ]);
  });

  it("reports an untouched study once rather than once per lesson", () => {
    const studyView = viewOf([
      { id: "first", title: "第一节" },
      { id: "second", title: "第二节" },
    ]);
    const model = buildAnswerOverview(studyView, { exerciseAttempts: {} });

    expect(model.empty).toBe(true);
    expect(model.courses[0]?.lessons).toEqual([]);
    expect(model.courses[0]?.unansweredCount).toBe(2);
  });
});
