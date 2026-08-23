import { describe, expect, it } from "vitest";

import { studyCounts, studyCourseList, type PlanetStudy } from "./planet-copy.js";

const TURING: PlanetStudy = {
  id: "turing-pact",
  title: "TuringPact",
  courseCount: 31,
  lessonCount: 41,
  lessonsDone: 1,
  courseTitles: ["开场", "地图", "镜头", "灯光", "材质", "后期"],
};

const BUZZ: PlanetStudy = {
  id: "buzz",
  title: "Buzz",
  courseCount: 5,
  lessonCount: 12,
  lessonsDone: 0,
  courseTitles: ["入门", "场景"],
};

describe("studyCounts", () => {
  it("reports real counts, and 没开始 before any lesson is done", () => {
    expect(studyCounts(TURING)).toBe("31 门课 · 41 节 · 学了 1/41 节");
    expect(studyCounts(BUZZ)).toBe("5 门课 · 12 节 · 没开始");
  });

  it("does not invent a slogan: every token is a number or a status word the data earned", () => {
    const text = studyCounts(TURING);
    expect(text).toContain("31");
    expect(text).toContain("41");
    expect(text).toContain("1/41");
    expect(text).not.toMatch(/探索|旅程|开启|精彩|沉浸|世界级|带你/);
  });
});

describe("studyCourseList", () => {
  it("shows the first few course titles and how many are left, never a blurb", () => {
    const listed = studyCourseList(TURING, 4);
    expect(listed.shown).toEqual(["开场", "地图", "镜头", "灯光"]);
    expect(listed.rest).toBe(2);
    expect(listed.restLabel).toBe("还有 2 门");
  });

  it("omits the remainder line when every course title is already on screen", () => {
    const listed = studyCourseList(BUZZ, 4);
    expect(listed.shown).toEqual(["入门", "场景"]);
    expect(listed.rest).toBe(0);
    expect(listed.restLabel).toBeNull();
  });
});
