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

  it("only offers itself for a course whose entry points are written down", () => {
    /*
      The table used to be three lesson ids with no course beside them, and the
      one caller looked 「在开始之前」 up by name before rendering. Any other
      course would have been routed into thirds by ids that are not in it, and
      `findIndex` returning -1 would have quietly sent every learner to lesson
      one — a recommendation that looks like a recommendation and is not one.
    */
    expect(hasRouteQuiz("foundations-before-zero")).toBe(true);
    expect(hasRouteQuiz("reading-a-repository")).toBe(false);
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
