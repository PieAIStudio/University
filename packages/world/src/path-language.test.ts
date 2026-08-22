import { describe, expect, it } from "vitest";

import { COURSE_HUE_SHIFTS, hueShiftForCourse, lockHsl, pathNodeKind } from "./path-language";

describe("hueShiftForCourse", () => {
  it("gives neighbouring spine courses different hues", () => {
    const first = hueShiftForCourse("turing-pact", "foundations-before-zero");
    const second = hueShiftForCourse("turing-pact", "foundations-terrain");
    expect(first).not.toBe(second);
    expect(COURSE_HUE_SHIFTS).toContain(first);
    expect(COURSE_HUE_SHIFTS).toContain(second);
  });

  it("does not reshuffle a course when asked twice", () => {
    expect(hueShiftForCourse("turing-pact", "foundations-ui")).toBe(
      hueShiftForCourse("turing-pact", "foundations-ui"),
    );
  });

  it("falls back to a stable hash when the course is not on the spine", () => {
    const a = hueShiftForCourse("unknown-study", "some-course");
    const b = hueShiftForCourse("unknown-study", "some-course");
    expect(a).toBe(b);
    expect(COURSE_HUE_SHIFTS).toContain(a);
  });
});

describe("pathNodeKind", () => {
  it("marks the last lesson of a multi-lesson unit as the unit test", () => {
    expect(pathNodeKind({ variant: "现象", exercises: 1, cards: 2, slot: 3, unitLength: 4 })).toBe(
      "quiz",
    );
  });

  it("does not force a one-lesson unit into a quiz", () => {
    expect(pathNodeKind({ variant: "现象", exercises: 1, cards: 2, slot: 0, unitLength: 1 })).toBe(
      "lesson",
    );
  });

  it("treats 术语 as a chest and two exercises as practice", () => {
    expect(pathNodeKind({ variant: "术语", exercises: 1, cards: 2, slot: 0, unitLength: 4 })).toBe(
      "chest",
    );
    expect(pathNodeKind({ variant: "决策", exercises: 2, cards: 2, slot: 1, unitLength: 4 })).toBe(
      "practice",
    );
  });

  it("treats a thicker card stack as review", () => {
    expect(pathNodeKind({ variant: "对比", exercises: 1, cards: 3, slot: 1, unitLength: 4 })).toBe(
      "review",
    );
  });
});

describe("lockHsl", () => {
  it("keeps about 15% saturation and drops lightness by 40%", () => {
    expect(lockHsl(0.8, 0.5)).toEqual({ saturation: 0.12, lightness: 0.3 });
  });
});
