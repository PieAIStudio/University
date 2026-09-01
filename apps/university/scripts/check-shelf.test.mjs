import { describe, expect, it } from "vitest";

import { checkShelfData } from "./check-shelf.mjs";

const manifest = {
  studies: [
    {
      studyId: "study",
      courses: [{ courseId: "course", isBeingRewritten: true, lessons: 2 }],
    },
  ],
};

function shelfWithLessonCount(count) {
  return {
    studies: [
      {
        id: "study",
        courses: [
          {
            id: "course",
            isBeingRewritten: true,
            units: [{ lessons: Array.from({ length: count }, () => ({ id: "lesson" })) }],
          },
        ],
      },
    ],
  };
}

describe("generated shelf check", () => {
  it("accepts a shelf whose course and lesson structure matches the manifest", () => {
    expect(checkShelfData(manifest, shelfWithLessonCount(2))).toEqual({
      studies: 1,
      courses: 1,
      lessons: 2,
    });
  });

  it("rejects a stale lesson count", () => {
    expect(() => checkShelfData(manifest, shelfWithLessonCount(1))).toThrow(/lesson count/);
  });

  it("rejects a shelf that loses the learner rewrite fact", () => {
    const shelf = shelfWithLessonCount(2);
    shelf.studies[0].courses[0].isBeingRewritten = false;
    expect(() => checkShelfData(manifest, shelf)).toThrow(/rewrite fact/);
  });
});
