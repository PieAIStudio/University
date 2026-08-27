import { describe, expect, it } from "vitest";

import { checkShelfData } from "./check-shelf.mjs";
import { buildSiteIndex, lessonRefsForShelf } from "./site-index.mjs";

const SHELF = {
  studies: [
    {
      id: "study&one",
      courses: [
        {
          id: "course",
          units: [{ id: "unit", lessons: [{ id: "first" }, { id: "second" }] }],
        },
      ],
    },
  ],
};

const MANIFEST = {
  studies: [{ studyId: "study&one", courses: [{ courseId: "course", lessons: 2 }] }],
};

const pathForLesson = ({ studyId, courseId, unitId, lessonId }) =>
  `/${studyId}/${courseId}/${unitId}/${lessonId}`;

const publishedLessonCount = checkShelfData(MANIFEST, SHELF).lessons;

describe("site index", () => {
  it("flattens the generated shelf and emits one sitemap URL per lesson", () => {
    expect(lessonRefsForShelf(SHELF)).toHaveLength(2);
    const result = buildSiteIndex(SHELF, {
      publicOrigin: "https://university.pieaistudio.com/ignored",
      pathForLesson,
      expectedLessonCount: publishedLessonCount,
    });

    expect(result.lessonCount).toBe(2);
    expect(result.locations).toEqual([
      "https://university.pieaistudio.com/study&one/course/unit/first",
      "https://university.pieaistudio.com/study&one/course/unit/second",
    ]);
    expect(result.sitemap.match(/<url>/gu)).toHaveLength(2);
    expect(result.sitemap).toContain("study&amp;one");
    expect(result.robots).toContain("Sitemap: https://university.pieaistudio.com/sitemap.xml");
    expect(result.robots).toContain("Disallow: /api/");
  });

  it("rejects a duplicate or hash-shaped public URL", () => {
    expect(() =>
      buildSiteIndex(SHELF, {
        publicOrigin: "https://university.pieaistudio.com",
        pathForLesson: () => "/same",
        expectedLessonCount: publishedLessonCount,
      }),
    ).toThrow("duplicate lesson URL");
    expect(() =>
      buildSiteIndex(SHELF, {
        publicOrigin: "https://university.pieaistudio.com",
        pathForLesson: () => "#/same",
        expectedLessonCount: publishedLessonCount,
      }),
    ).toThrow("not canonical");
  });

  it("rejects a sitemap whose lesson count is not the published count", () => {
    expect(() =>
      buildSiteIndex(SHELF, {
        publicOrigin: "https://university.pieaistudio.com",
        pathForLesson,
        expectedLessonCount: 579,
      }),
    ).toThrow("sitemap lesson count 2 != published lesson count 579");
  });
});
