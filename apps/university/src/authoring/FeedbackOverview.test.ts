import type { FeedbackRecord } from "@pieai/university-core";
import { describe, expect, it } from "vitest";
import type { StudyView } from "@pieai/university-ui/view/lesson-view.js";

import { buildFeedbackOverview } from "./FeedbackOverview";

const locator = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
} as const;

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
              id: "lesson",
              title: "第一节",
              status: "active",
              contentRevision: 3,
              cardCount: 0,
              exerciseCount: 2,
              exerciseIds: ["one", "two"],
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

function record(id: string, message: string, contentRevision = 3): FeedbackRecord {
  return {
    id,
    message,
    createdAt: `2026-08-27T06:0${id}Z`,
    context: {
      locator,
      contentRevision,
      exerciseAttemptCount: 2,
      signedIn: false,
      route: "#/lesson/study/course/unit/lesson",
      viewport: [390, 844],
    },
  };
}

describe("feedback overview", () => {
  it("groups by lesson and authored revision", () => {
    const model = buildFeedbackOverview(
      [record("1", "没看懂"), record("2", "例子太少"), record("3", "旧版本意见", 2)],
      studyView,
    );

    expect(model.courses).toHaveLength(1);
    expect(model.courses[0]?.revisions.map((revision) => revision.contentRevision)).toEqual([3, 2]);
    expect(model.courses[0]?.revisions[0]?.feedbackCount).toBe(2);
  });
});
