// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  account: "guest-first-learner",
  active: [] as { commandId: string; goal: string; status: string; stage: string }[],
  snapshot: {},
  t: (key: string) => key,
}));
vi.mock("@pieai/university-ui/i18n.js", () => ({
  useI18n: () => ({ t: state.t, locale: "zh-CN" }),
}));
vi.mock("@pieai/university-ui/lesson/LessonReader.js", () => ({ LessonReader: () => null }));
vi.mock("../ports/index.js", () => ({
  contentPort: {},
  gradingPort: {},
  readerPort: {},
  sourceAccessPort: {},
}));
vi.mock("../progress/store.js", () => ({
  progressPort: {
    subscribe: () => () => {},
    snapshot: () => state.snapshot,
  },
}));
vi.mock("./api.js", () => ({
  personalAccountScope: () => state.account,
  PersonalHttpError: class extends Error {},
  readPersonalJson: async (path: string) =>
    path.startsWith("/jobs/") ? state.active[0] : { lessons: [], active: state.active },
}));
import { PersonalLessonPanel } from "./PersonalLessonPanel.js";

const scope = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonIds: ["one", "two", "three"],
};
let root: Root | null = null;
let host: HTMLDivElement;
async function mount(lessonIds = scope.lessonIds) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () =>
    root!.render(<PersonalLessonPanel scope={{ ...scope, lessonIds }} onClose={() => {}} />),
  );
}
async function unmount() {
  if (root) await act(async () => root!.unmount());
  root = null;
  host?.remove();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  state.account = "guest-first-learner";
  state.active = [];
});
afterEach(async () => {
  await unmount();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("personal task recovery", () => {
  it("restores an unfinished need in the same segment, but never in a different account or segment", async () => {
    await mount();
    const text = "把活动通知整理成出门提醒，保留时间、地点和要带的东西。";
    const textarea = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        text,
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await unmount();
    await mount();
    expect(host.querySelector("textarea")!.value).toBe(text);
    await unmount();
    await mount(["four", "five", "six"]);
    expect(host.querySelector("textarea")!.value).toBe("");
    await unmount();
    state.account = "guest-another-learner";
    await mount();
    expect(host.querySelector("textarea")!.value).toBe("");
  });

  it("shows the actual need of a reopened generation instead of an empty disabled field", async () => {
    state.active = [
      { commandId: "job", goal: "写一条不会漏掉时间的提醒", status: "working", stage: "writing" },
    ];
    await mount();
    expect(host.querySelector("textarea")!.value).toBe(state.active[0]!.goal);
    expect(host.querySelector("textarea")!.disabled).toBe(true);
  });
});
