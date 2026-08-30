import { describe, expect, it } from "vitest";

import {
  STUDY_STAGE_LABEL,
  studyCounts,
  studyCourseList,
  studyClusterStyle,
  studyMarkerColor,
  studyPercent,
  studyStage,
  type PlanetStudy,
} from "./planet-copy.js";

const TURING: PlanetStudy = {
  id: "turing-pact",
  title: "TuringPact",
  courseCount: 31,
  lessonCount: 41,
  lessonsDone: 1,
  courses: [
    { id: "turing-1", title: "开场", lessonCount: 8, depth: 0 },
    { id: "turing-2", title: "地图", lessonCount: 8, depth: 1 },
    { id: "turing-3", title: "镜头", lessonCount: 8, depth: 2 },
    { id: "turing-4", title: "灯光", lessonCount: 8, depth: 3 },
    { id: "turing-5", title: "材质", lessonCount: 9, depth: 4 },
    { id: "turing-6", title: "后期", lessonCount: 0, depth: 5 },
  ],
  courseTitles: ["开场", "地图", "镜头", "灯光", "材质", "后期"],
};

const BUZZ: PlanetStudy = {
  id: "buzz",
  title: "Buzz",
  courseCount: 5,
  lessonCount: 12,
  lessonsDone: 0,
  courses: [
    { id: "buzz-1", title: "入门", lessonCount: 6, depth: 0 },
    { id: "buzz-2", title: "场景", lessonCount: 6, depth: 1 },
  ],
  courseTitles: ["入门", "场景"],
};

describe("studyCounts", () => {
  it("reports how big a series is, and nothing about where you stand in it", () => {
    /*
      Size only. The row carries a stage chip and a progress bar now, so a
      third statement of the same fact in a third shape was noise — see
      `studyCounts`. Where you stand is `studyStage` and `studyPercent`.
    */
    expect(studyCounts(TURING)).toBe("31 门课 · 41 节");
    expect(studyCounts(BUZZ)).toBe("5 门课 · 12 节");
  });

  it("does not invent a slogan: every token is a number the data earned", () => {
    const text = studyCounts(TURING);
    expect(text).toContain("31");
    expect(text).toContain("41");
    expect(text).not.toMatch(/探索|旅程|开启|精彩|沉浸|世界级|带你/);
  });
});

describe("studyStage", () => {
  it("separates not started, underway and finished", () => {
    expect(studyStage(BUZZ)).toBe("not-started");
    expect(studyStage(TURING)).toBe("learning");
    expect(studyStage({ ...TURING, lessonsDone: 41 })).toBe("done");
  });

  it("calls an empty series not started rather than finished", () => {
    // 0 of 0 is arithmetically complete and is not a series anybody finished.
    expect(studyStage({ ...BUZZ, lessonCount: 0, lessonsDone: 0 })).toBe("not-started");
  });

  it("names each stage in the learner's words", () => {
    expect(STUDY_STAGE_LABEL[studyStage(TURING)]).toBe("学习中");
  });
});

describe("studyPercent", () => {
  it("floors, so a nearly finished series never reads as finished", () => {
    expect(studyPercent({ ...TURING, lessonsDone: 40, lessonCount: 41 })).toBe(97);
    expect(studyPercent(TURING)).toBe(2);
  });

  it("is zero rather than NaN for a series with no lessons yet", () => {
    expect(studyPercent({ ...BUZZ, lessonCount: 0 })).toBe(0);
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

describe("studyMarkerColor", () => {
  it("keeps the canvas beacon and DOM swatch on one project colour", () => {
    expect(studyMarkerColor("turing-pact").css).toBe("#d49a62");
    expect(studyMarkerColor("buzz").css).toBe("#7d9a62");
    expect(studyMarkerColor("turing-pact")).not.toEqual(studyMarkerColor("buzz"));
  });

  it("assigns an unknown series a deterministic palette entry", () => {
    expect(studyMarkerColor("new-series")).toEqual(studyMarkerColor("new-series"));
  });

  it("covers the fifth real study without reusing one of the four legacy hues", () => {
    const ids = ["general", "buzz", "supaluv", "turing-pact", "university-local"];
    const colours = ids.map((id) => studyMarkerColor(id).hex);
    expect(new Set(colours).size).toBe(ids.length);
    expect(studyMarkerColor("general")).toEqual(studyMarkerColor("general"));
  });
});

describe("studyClusterStyle", () => {
  it("gives the five real studies stable, distinct silhouette cues", () => {
    const ids = ["general", "buzz", "supaluv", "turing-pact", "university-local"];
    const styles = ids.map(studyClusterStyle);
    expect(new Set(styles.map((style) => style.profile)).size).toBe(ids.length);
    expect(styles.map((style) => style.shape)).toEqual([
      "wide",
      "compact",
      "elongated",
      "faceted",
      "tall",
    ]);
  });

  it("does not let catalogue order decide an unlisted study's shape", () => {
    expect(studyClusterStyle("future-study")).toEqual(studyClusterStyle("future-study"));
  });
});
