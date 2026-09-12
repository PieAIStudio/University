import { describe, expect, it } from "vitest";
import { searchCatalogLessons } from "./catalog-search.js";
import type { CatalogListing } from "./CatalogSurface.js";

const listing: CatalogListing = {
  studies: [
    {
      id: "s",
      title: "认识 AI",
      flat: true,
      courses: [
        {
          id: "c",
          title: "从生活开始",
          searchText: "手机与模型",
          depth: 0,
          prerequisiteCourseIds: [],
          prerequisiteTitles: [],
          state: "live",
          done: 0,
          total: 2,
          units: [
            {
              id: "u",
              title: "试一试",
              lessons: [
                { id: "a", title: "手机怎样认出你", variant: null, state: "live" },
                { id: "b", title: "相册中的照片", variant: null, state: "idle" },
              ],
            },
          ],
        },
      ],
    },
  ],
  totals: { studies: 1, courses: 1, units: 1, lessons: 2 },
  nextLesson: null,
};

describe("catalog search", () => {
  it("C1 searches published titles and returns their full locator and context", () => {
    const [match] = searchCatalogLessons(listing, "  手机  认出  ");
    expect(match?.locator).toEqual({ studyId: "s", courseId: "c", unitId: "u", lessonId: "a" });
    expect(match?.courseTitle).toBe("从生活开始");
    expect(searchCatalogLessons(listing, "ＡＩ 模型")).toHaveLength(2);
  });
  it("C2 no matches and reset do not change the course catalog", () => {
    const original = JSON.stringify(listing);
    expect(searchCatalogLessons(listing, "不存在的课")).toEqual([]);
    expect(searchCatalogLessons(listing, "")).toHaveLength(2);
    expect(JSON.stringify(listing)).toBe(original);
  });
});
