import { describe, expect, it } from "vitest";

import { checkShelfData } from "./check-shelf.mjs";

const manifest = {
  studies: [{ studyId: "study", courses: [{ courseId: "course", lessons: 2 }] }],
};

function shelfWithLessonCount(count) {
  return {
    studies: [
      {
        id: "study",
        courses: [
          {
            id: "course",
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
});
