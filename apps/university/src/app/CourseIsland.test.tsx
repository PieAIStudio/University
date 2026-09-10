// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CourseProgress } from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import { CourseIsland } from "./CourseIsland.js";

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

const COURSE = {
  id: "foundations-before-zero",
  title: "在开始之前",
  description: "",
  audience: "",
  objectives: [],
  isDefault: true,
  units: [
    {
      id: "what-is-an-app",
      title: "App 是什么",
      objective: "",
      // Four lessons, because the route quiz only offers itself when there is
      // something worth skipping into. A one-lesson course was never a course
      // this question could be asked about; it passed before only because the
      // old hand-written table keyed on the course id and ignored its size.
      lessons: [
        { id: "you-already-know-apps", title: "你已经会用 App" },
        { id: "an-app-is-files", title: "App 其实是一堆文件" },
        { id: "code-is-text", title: "代码就是文字" },
        { id: "where-it-runs", title: "它跑在哪儿" },
      ],
    },
  ],
} as unknown as CourseView;

const UNSTARTED: CourseProgress = {
  done: 0,
  total: 1,
  complete: false,
  proven: false,
  next: null,
};

const BASE_PROPS = {
  course: COURSE,
  studyId: "turing-pact",
  pathUnit: COURSE.units[0],
  unitOverlayOpen: false,
  backToMapLabel: "← 回到 TuringPact 地图",
  /*
    The skip test never asks for a lesson here: nothing in these renders clicks
    「我会了」, so a port that rejects is the honest double. If one of them ever
    starts loading lessons on first paint, this fails loudly instead of quietly
    fanning out one request per lesson on every course island.
  */
  contentPort: { lesson: () => Promise.reject(new Error("not asked")) },
  provenLessonKeys: new Set<string>(),
  onProven: () => undefined,
  onOpenUnitOverlay: () => undefined,
  onBackToMap: () => undefined,
  onOpenLesson: () => undefined,
};

describe("CourseIsland", () => {
  it("keeps the accessible unit control and shows the route quiz before progress", () => {
    const markup = renderToStaticMarkup(
      <CourseIsland {...BASE_PROPS} viewedProgress={UNSTARTED} />,
    );

    expect(markup).toContain('aria-label="先看这一单元讲什么"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("先测测你的学习起点");
    expect(markup).toContain("← 回到 TuringPact 地图");
  });

  it("hides the route quiz after a course has started", () => {
    const markup = renderToStaticMarkup(
      <CourseIsland {...BASE_PROPS} viewedProgress={{ ...UNSTARTED, done: 1, complete: true }} />,
    );

    expect(markup).not.toContain("先测测你的学习起点");
  });

  it("starts collapsed, with the course name, progress, disclose control and map exit", () => {
    const markup = renderToStaticMarkup(
      <CourseIsland {...BASE_PROPS} viewedProgress={UNSTARTED} />,
    );

    expect(markup).toContain("在开始之前");
    expect(markup).toContain("1");
    expect(markup).toContain("单元 ·");
    expect(markup).toContain("学习路线");
    expect(markup).toContain("收起");
    expect(markup).toMatch(/<details class="picked__route">/);
    expect(markup).toContain('<summary class="picked__route-summary">');
    expect(markup).toContain('<details class="course-route-quiz"><summary>');
    expect(markup).not.toMatch(/<details class="picked__route" open/);
    expect(markup).not.toMatch(/<details class="course-route-quiz" open/);
    expect(markup).toContain("← 回到 TuringPact 地图");
    expect(markup.indexOf("picked__route-summary")).toBeLessThan(markup.indexOf("unit-strip"));
    expect(markup.indexOf("unit-strip")).toBeLessThan(markup.indexOf("course-route-quiz"));
    expect(markup.indexOf("</details>")).toBeLessThan(markup.indexOf("picked__exit"));
  });

  it("keeps a unit-only disclosure after the course has started", () => {
    const markup = renderToStaticMarkup(
      <CourseIsland {...BASE_PROPS} viewedProgress={{ ...UNSTARTED, done: 1, complete: true }} />,
    );

    expect(markup).toMatch(/<details class="picked__route">/);
    expect(markup).toContain("unit-strip");
    expect(markup).not.toContain("course-route-quiz");
  });

  it("omits the disclosure when there is no unit and no route quiz", () => {
    const markup = renderToStaticMarkup(
      <CourseIsland
        {...BASE_PROPS}
        course={{ ...COURSE, id: "other-course" }}
        pathUnit={undefined}
        viewedProgress={{ ...UNSTARTED, done: 1, complete: true }}
      />,
    );

    expect(markup).not.toContain("picked__route");
    expect(markup).toContain("在开始之前");
    expect(markup).toContain("← 回到 TuringPact 地图");
  });

  it("closes the disclosure when the course changes at runtime", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const anotherCourse = { ...COURSE, id: "another-course", title: "另一门课" };

    try {
      await act(async () => {
        root.render(<CourseIsland {...BASE_PROPS} viewedProgress={UNSTARTED} />);
      });

      const firstRoute = host.querySelector<HTMLDetailsElement>(".picked__route");
      expect(firstRoute).not.toBeNull();
      firstRoute!.open = true;

      await act(async () => {
        root.render(<CourseIsland {...BASE_PROPS} viewedProgress={UNSTARTED} />);
      });

      expect(host.querySelector<HTMLDetailsElement>(".picked__route")).toBe(firstRoute);
      expect(firstRoute!.open).toBe(true);

      await act(async () => {
        root.render(
          <CourseIsland {...BASE_PROPS} course={anotherCourse} viewedProgress={UNSTARTED} />,
        );
      });

      const nextRoute = host.querySelector<HTMLDetailsElement>(".picked__route");
      expect(nextRoute).not.toBeNull();
      expect(nextRoute).not.toBe(firstRoute);
      expect(nextRoute!.open).toBe(false);
      expect(host.textContent).toContain("另一门课");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
