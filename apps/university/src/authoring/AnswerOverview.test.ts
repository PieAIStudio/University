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
  it("renders every lesson and only counts attempts for its current revision", () => {
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
    expect(model.courses[0]?.lessons.map((lesson) => lesson.title)).toEqual(["第一节", "第二节"]);
    expect(model.courses[0]?.lessons[0]?.stats).toMatchObject({
      firstAttemptCount: 1,
      firstPassCount: 0,
      firstPassRate: 0,
      totalAttempts: 2,
    });
    expect(model.courses[0]?.lessons[1]?.stats).toMatchObject({
      exerciseCount: 1,
      firstAttemptCount: 0,
      firstPassRate: null,
      totalAttempts: 0,
    });
  });
});
