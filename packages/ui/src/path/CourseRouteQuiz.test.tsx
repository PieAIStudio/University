import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CourseRouteQuiz, classifyCourseRoute, hasRouteQuiz } from "./CourseRouteQuiz.js";
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
    const markup = renderToStaticMarkup(
      <CourseRouteQuiz studyId="turing-pact" course={COURSE} onOpenLesson={() => undefined} />,
    );

    expect(markup).toContain("先测测你的学习起点");
    expect(markup).toContain("第 1 / 3 题");
    expect(markup).toContain("如果 App 里的按钮文字不对");
  });
});
