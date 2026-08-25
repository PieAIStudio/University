import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CourseProgress } from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import { CourseIsland } from "./CourseIsland.js";

const COURSE = {
  id: "foundations-before-zero",
  title: "在开始之前",
  description: "",
  audience: "",
  objectives: [],
  status: "active",
  isDefault: true,
  units: [
    {
      id: "what-is-an-app",
      title: "App 是什么",
      objective: "",
      status: "active",
      lessons: [{ id: "you-already-know-apps", title: "你已经会用 App" }],
    },
  ],
} as unknown as CourseView;

const UNSTARTED: CourseProgress = {
  done: 0,
  total: 1,
  complete: false,
  next: null,
};

const BASE_PROPS = {
  course: COURSE,
  studyId: "turing-pact",
  pathUnit: COURSE.units[0],
  unitOverlayOpen: false,
  backToMapLabel: "← 回到 TuringPact 地图",
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
});
