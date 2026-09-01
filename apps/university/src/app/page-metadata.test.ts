import { describe, expect, it } from "vitest";

import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import { pageMetadataFor } from "./page-metadata.js";

const COURSE: CourseView = {
  id: "foundations-before-zero",
  title: "在开始之前：App、代码、和你",
  description: "从每天使用的 App 出发，读懂代码和产品之间的关系。",
  audience: "零基础学习者",
  objectives: [],
  isDefault: true,
  units: [
    {
      id: "what-is-an-app",
      title: "你每天用的 App，拆开是什么",
      objective: "",
      lessons: [
        {
          id: "you-already-know-apps",
          title: "会使用 App 和会开发 App，差在哪儿？",
          contentRevision: 1,
          cardCount: 0,
          exerciseCount: 0,
          exerciseIds: [],
          contentChars: 100,
          progress: null,
        },
        {
          id: "another-lesson",
          title: "另一节课",
          contentRevision: 1,
          cardCount: 0,
          exerciseCount: 0,
          exerciseIds: [],
          contentChars: 80,
          progress: null,
        },
      ],
    },
  ],
};

describe("page metadata", () => {
  it("names a course and uses its description", () => {
    const metadata = pageMetadataFor(
      { kind: "course", studyId: "turing-pact", courseId: COURSE.id },
      COURSE,
      "https://university.pieaistudio.com",
    );

    expect(metadata.title).toBe(COURSE.title);
    expect(metadata.description).toBe(COURSE.description);
    expect(metadata.type).toBe("article");
    expect(metadata.url).toBe(
      "https://university.pieaistudio.com/turing-pact/foundations-before-zero",
    );
  });

  it("makes two lesson cards different while retaining the course context", () => {
    const first = pageMetadataFor(
      {
        kind: "lesson",
        studyId: "turing-pact",
        courseId: COURSE.id,
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
      },
      COURSE,
      "https://university.pieaistudio.com",
    );
    const second = pageMetadataFor(
      {
        kind: "lesson",
        studyId: "turing-pact",
        courseId: COURSE.id,
        unitId: "what-is-an-app",
        lessonId: "another-lesson",
      },
      COURSE,
      "https://university.pieaistudio.com",
    );

    expect(first.title).toContain("会使用 App 和会开发 App，差在哪儿？");
    expect(first.description).toContain(COURSE.description);
    expect(first.url).toContain("you-already-know-apps");
    expect(second.title).toContain("另一节课");
    expect(first.title).not.toBe(second.title);
  });
});
