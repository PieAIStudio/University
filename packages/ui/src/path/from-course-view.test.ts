import { describe, expect, it } from "vitest";

import type { CourseView } from "../view/lesson-view.js";
import { lessonCostLine, startButtonLabel } from "./path-stats.js";
import { pathLessonOf, pathUnitOf } from "./from-course-view.js";

function summary(extra: Partial<CourseView["units"][number]["lessons"][number]> = {}) {
  return {
    id: "you-already-know-apps",
    title: "你已经会用 App 了",
    status: "active",
    contentRevision: 1,
    cardCount: 1,
    exerciseCount: 2,
    contentChars: 800,
    progress: null,
    ...extra,
  };
}

describe("a shelf's lesson, as the path cards read it", () => {
  it("keeps the counts a card prints, and drops the ones it does not", () => {
    const lesson = pathLessonOf(summary({ evidenceCount: 3, unlockCount: 2 }));
    expect(lessonCostLine(lesson)).toBe("读 2 分钟 · 2 道题 · 3 条真实代码引用");
    expect(startButtonLabel(lesson.unlockCount)).toBe("开始 · 学完解锁 2 个词条");
  });

  it("says nothing about citations when the shelf could not count them", () => {
    // The authoring API sends a summary and not a body. The card used to be
    // handed a synthesised string of the right length, which measured the
    // reading time correctly and reported 「0 条真实代码引用」 — a number that
    // is wrong rather than absent, on the card that sells the lesson.
    const lesson = pathLessonOf(summary());
    expect(lesson.evidenceCount).toBeNull();
    expect(lessonCostLine(lesson)).toBe("读 2 分钟 · 2 道题");
    expect(lessonCostLine(lesson)).not.toContain("0 条");
    expect(startButtonLabel(lesson.unlockCount)).toBe("开始");
  });

  it("carries a unit across whole, so the card and the settlement quote one cost", () => {
    const unit = pathUnitOf({
      id: "what-is-an-app",
      title: "你每天用的 App，拆开是什么",
      objective: "能说出使用和开发的差别。",
      status: "active",
      lessons: [summary(), summary({ id: "second", contentChars: 1200 })],
    });
    expect(unit.title).toBe("你每天用的 App，拆开是什么");
    expect(unit.objective).toBe("能说出使用和开发的差别。");
    expect(unit.lessons).toHaveLength(2);
    // No prose on the way through: a private repository's source cannot reach
    // a card a paying learner screenshots if the card never receives it.
    expect(Object.keys(unit.lessons[0]!)).not.toContain("content");
  });
});
