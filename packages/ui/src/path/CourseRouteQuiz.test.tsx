import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CourseRouteQuiz,
  classifyCourseRoute,
  hasRouteQuiz,
  recommendedSkipUnitCount,
} from "./CourseRouteQuiz.js";
import type { CourseView } from "../view/lesson-view.js";

const COURSE = {
  id: "foundations-before-zero",
  title: "在开始之前",
  units: [
    {
      id: "what-is-an-app",
      title: "App 是什么",
      lessons: [{ id: "you-already-know-apps", title: "你已经会用 App" }],
    },
    {
      id: "what-is-code",
      title: "代码是什么",
      lessons: [{ id: "code-is-text", title: "代码就是文本" }],
    },
    {
      id: "files-and-folders",
      title: "文件与文件夹",
      lessons: [{ id: "file-vs-folder", title: "文件和文件夹" }],
    },
  ],
} as unknown as CourseView;

const NOTHING_LOADED = { lesson: () => Promise.reject(new Error("not asked")) };

/**
 * The code, without the prose about the code.
 *
 * Both source checks below read this file, and the first version of them read
 * it whole — so the paragraph explaining *why* the three level names were
 * retired failed the assertion that the three level names are gone. A guard
 * that a correct explanation can turn red is a guard people delete the
 * explanation to satisfy.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function render(course: CourseView = COURSE) {
  return renderToStaticMarkup(
    <CourseRouteQuiz
      studyId="turing-pact"
      course={course}
      content={NOTHING_LOADED}
      proven={new Set()}
      onProven={() => undefined}
      onOpenLesson={() => undefined}
    />,
  );
}

describe("course route quiz", () => {
  it("turns answers into an automatic learning starting point", () => {
    expect(classifyCourseRoute(0)).toBe("beginner");
    expect(classifyCourseRoute(3)).toBe("familiar");
    expect(classifyCourseRoute(6)).toBe("builder");
  });

  it("only offers itself when there is something worth skipping into", () => {
    /*
      Entry points used to come from a hand-written table of three lesson ids,
      and it held one course. Every other course fell through `findIndex`
      returning -1 and was quietly routed to lesson one — a recommendation that
      looks like a recommendation and is not one. Entry points now come from the
      course's own units, so the remaining question is only whether the course
      is long enough for the offer to mean anything.
    */
    const unitOf = (count: number) => ({ lessons: Array.from({ length: count }, () => ({})) });
    expect(hasRouteQuiz({ units: [unitOf(3), unitOf(3)] })).toBe(true);
    expect(hasRouteQuiz({ units: [unitOf(4)] })).toBe(true);
    expect(hasRouteQuiz({ units: [unitOf(3)] })).toBe(false);
    expect(hasRouteQuiz({ units: [] })).toBe(false);
  });

  it("asks its first question before it has an answer", () => {
    const markup = render();

    expect(markup).toContain("先测测你的学习起点");
    expect(markup).toContain("第 1 / 3 题");
    expect(markup).toContain("如果 App 里的按钮文字不对");
  });

  /*
    V5 §12 决定 G, as a shape rather than as a behaviour, because the behaviour
    it forbids is the one this component used to have: three self-reported
    answers picked a lesson and opened it. The design's whole argument is that
    「自报家门不是能力证明。一个高估自己的人会被自己的答案推到接不住的地方。」

    The quiz is therefore given no way to write a proof — no progress port, no
    `onProven` of its own beyond forwarding one from a test it does not grade —
    and this asserts the absence: the props it accepts do not include anything
    that could mark a lesson skipped. A behaviour test would only prove that
    today's code path does not; this proves there is no path to write.
  */
  it("has no way to write a proof, and therefore cannot become one again", () => {
    const code = withoutComments(
      readFileSync(new URL("./CourseRouteQuiz.tsx", import.meta.url), "utf8"),
    );
    for (const write of ["markLessonsProven", "advanceLesson", "dropCards", "ProgressPort"]) {
      expect(code).not.toContain(write);
    }
    /*
      And the only thing it may hand a unit to is the shared test. A second
      component here would be a second way to be let past a unit, which is the
      thing 决定 G forbids however carefully the second one was written.
    */
    expect(code).toContain("UnitSkipTest");
  });

  it("recommends units to test rather than a lesson to land on", () => {
    expect(recommendedSkipUnitCount(COURSE, "beginner")).toBe(0);
    expect(recommendedSkipUnitCount(COURSE, "familiar")).toBe(1);
    expect(recommendedSkipUnitCount(COURSE, "builder")).toBe(2);
  });

  /*
    A one-unit course has no seam to offer, so it is offered none. Its single
    unit still carries 「我会了」 on its own entry — 决定 D — which is reached
    without any recommendation at all.
  */
  it("offers no unit to skip in a course written as one unit", () => {
    const single = { ...COURSE, units: [COURSE.units[0]!] } as CourseView;
    expect(recommendedSkipUnitCount(single, "builder")).toBe(0);
  });

  /*
    决定 A: 「判断落在『从哪一节开始』，不落在一个称号上。」 These three strings
    were the result headline until this change, and a learner labelled 「有开发
    经验」 carries that label into every moment they get stuck.
  */
  it("prints no level name anywhere", () => {
    /*
      Read from the file rather than from one render, because the names lived in
      the *result* branch and a render of the unanswered branch would have gone
      green with all three still in the component. The catalog keys are gone
      too, so re-adopting one is a compile error rather than a paste.
    */
    const code = withoutComments(
      readFileSync(new URL("./CourseRouteQuiz.tsx", import.meta.url), "utf8"),
    );
    for (const title of ["从零开始", "有一点基础", "有开发经验", "初级", "中级", "高级"]) {
      expect(code).not.toContain(title);
    }
    expect(render()).not.toContain("有开发经验");
  });
});
