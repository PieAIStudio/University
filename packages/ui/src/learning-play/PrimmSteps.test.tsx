// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { primmStepsFixture } from "../../../core/src/learning-play/fixtures/primm-steps.js";
import { I18nProvider } from "../i18n/index.js";
import { PrimmLesson } from "./PrimmLesson.js";
import { initialStepsSession, restoreStepsSession } from "./primm-steps-session.js";
import type { PrimmLessonProps, RunPrimm } from "./primm-types.js";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // Every demonstration has already been seen: these tests drive the controls.
  localStorage.setItem(
    "university.primm.coach",
    JSON.stringify(["send", "match", "sort", "build"]),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

const lesson = primmStepsFixture;
const step = <K extends string>(id: K) => lesson.steps.find((item) => item.id === id)!;
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
const text = () => container.textContent ?? "";
const title = () => container.querySelector("h2")?.textContent;
async function press(label: string) {
  const button = buttons().find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  expect(button, label).toBeTruthy();
  expect(button!.disabled, label).toBe(false);
  await act(async () => button!.click());
}
async function type(value: string) {
  const field = container.querySelector<HTMLTextAreaElement>("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/** Answers stand in for live output; the lesson must work for any of them. */
const answers: Record<string, string> = {
  "说说这张照片里有什么。": "照片里有一杯咖啡。旁边放着一把小勺子，靠近杯子。整体画面温暖。",
  "勺子在杯子的哪一边？": "勺子在杯子的右边。",
  "帮我看看这张照片。": "这是一杯放在碟子上的咖啡。",
  "杯子里有没有泡沫？": "有，咖啡表面有一层泡沫。",
  "猫的眼睛是什么颜色？": "猫的眼睛是绿色的。",
};
async function render(extra: Partial<PrimmLessonProps> = {}) {
  const run = vi.fn<RunPrimm>(async (request) => ({
    kind: "live",
    prompt: request.prompt,
    text: answers[request.prompt] ?? "测试输出",
    requestId: crypto.randomUUID(),
    model: "test",
    createdAt: new Date().toISOString(),
    sourceIds: [],
  }));
  const grade = vi.fn<NonNullable<PrimmLessonProps["evaluatePrimm"]>>(async () => ({
    outcome: "pass" as const,
    explanation: "只问了一处，备注对得上照片。",
  }));
  const complete = vi.fn(async () => {});
  const progress = vi.fn();
  await act(async () =>
    root.render(
      <I18nProvider locale="zh-CN">
        <PrimmLesson
          activity={lesson}
          assets={[
            {
              id: "everyday-coffee",
              kind: "authorized-external",
              mime: "image/png",
              url: "/coffee.png",
              alt: "咖啡",
            },
            {
              id: "everyday-cat",
              kind: "authorized-external",
              mime: "image/png",
              url: "/cat.png",
              alt: "猫",
            },
          ]}
          lessonRef={{ studyId: "s", courseId: "c", unitId: "u", lessonId: "l" }}
          contentRevision={2}
          runPrimm={run}
          evaluatePrimm={grade}
          onPrimmComplete={complete}
          onPathProgress={progress}
          {...extra}
        />
      </I18nProvider>,
    ),
  );
  return { run, grade, complete, progress };
}

describe("a step lesson: one action per screen, the teacher after it", () => {
  it("walks all five phases with real runs of the learner's own choices", async () => {
    const { run, grade, complete, progress } = await render();
    expect(
      container.querySelector("[data-primm-version]")?.getAttribute("data-primm-version"),
    ).toBe("3");
    expect(text()).toContain(lesson.goal);
    await press("开始");

    // Predict: a way of using AI, not a guess about its wording.
    expect(title()).toBe(step("guess-how").title);
    expect(buttons().find((b) => b.textContent === "就选这个")!.disabled).toBe(true);
    await press("勺子在杯子的哪一边？");
    expect(text()).not.toContain("记住你选的这句");
    await press("就选这个");
    expect(text()).toContain("记住你选的这句");
    await press("继续");

    // Run: the chosen request, and only after it answers does the teacher speak.
    expect(run).not.toHaveBeenCalled();
    expect(text()).not.toContain("你只问了勺子");
    await press("咖啡照片");
    await press("发送");
    expect(run).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: "run", prompt: "勺子在杯子的哪一边？" }),
      expect.anything(),
    );
    expect(text()).toContain("你只问了勺子");
    await press("继续");

    // Find: the sentence that mentions the spoon in this live answer.
    await press("勺子在杯子的右边。");
    expect(text()).toContain("这句说没说是哪一边");
    await press("继续");

    // Match: the other two requests really run, then each answer finds its question.
    expect(run.mock.calls.map(([request]) => request.prompt)).toEqual([
      "勺子在杯子的哪一边？",
      "说说这张照片里有什么。",
      "帮我看看这张照片。",
    ]);
    expect(text()).not.toContain("问整张图，它就说整张图");
    const zone = (prompt: string) =>
      [...container.querySelectorAll<HTMLElement>(".primm-steps__question")]
        .find((item) => item.textContent?.includes(prompt))!
        .querySelector<HTMLButtonElement>("button")!;
    const answer = (fragment: string) =>
      [...container.querySelectorAll<HTMLButtonElement>(".primm-steps__answer")].find((item) =>
        item.textContent?.includes(fragment),
      )!;
    await act(async () => answer("右边").click());
    await act(async () => zone("帮我看看这张照片。").click());
    expect(container.querySelector(".primm-steps__toast")?.textContent).toBe("再读读这个问题");
    for (const [fragment, prompt] of [
      ["右边", "勺子在杯子的哪一边？"],
      ["碟子上", "帮我看看这张照片。"],
      ["照片里有一杯咖啡", "说说这张照片里有什么。"],
    ] as const) {
      await act(async () => answer(fragment).click());
      await act(async () => zone(prompt).click());
    }
    expect(text()).toContain("问整张图，它就说整张图");
    await press("继续");

    // Sort: six quick judgements.
    const sort = lesson.steps.find((item) => item.kind === "sort")!;
    if (sort.kind !== "sort") throw Error();
    for (const card of sort.cards) await press(card.bucketId === "yes" ? "答得出 →" : "← 答不出");
    expect(text()).toContain("6 张里对了 6 张");
    await press("继续");

    // Build: a stray piece names its own reason, order matters, then it passes.
    await press("杯子里");
    await press("写得越长越好");
    await press("检查");
    expect(text()).toContain("这块会让它说一大段");
    await press("再试试");
    await press("写得越长越好"); // take it back out of the line
    await press("杯子里");
    await press("有没有泡沫？");
    await press("杯子里");
    await press("检查");
    expect(text()).toContain("顺序调一调");
    await press("再试试");
    await press("有没有泡沫？");
    await press("有没有泡沫？");
    await press("检查");
    expect(text()).toContain("拼好了");
    await press("继续");

    // Send the built request in Modify.
    await press("咖啡照片");
    await press("发送");
    expect(run).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: "modify", prompt: "杯子里有没有泡沫？" }),
      expect.anything(),
    );
    await press("继续");

    // Point: a miss is a hint, the target settles it.
    await press("杯子右下");
    expect(container.querySelector(".primm-steps__toast")?.textContent).toBe(
      "这里不是。再看看杯子里面。",
    );
    await press("杯子中间");
    expect(text()).toContain("这是你亲眼看到的");
    await press("继续");

    // Make: the learner's own request, graded before moving on.
    expect(buttons().find((b) => b.textContent === "继续")!.disabled).toBe(true);
    await type("猫的眼睛是什么颜色？");
    await press("发送");
    expect(run).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: "make", prompt: "猫的眼睛是什么颜色？" }),
      expect.anything(),
    );
    await press("看看这次做得怎样");
    expect(grade).toHaveBeenCalledTimes(1);
    expect(text()).toContain("只问了一处");
    await press("继续");
    await press("看得到，对上了");
    await press("检查");
    await press("继续");

    expect(title()).toBe(lesson.finish.title);
    expect(progress).toHaveBeenLastCalledWith(5);
    await press("完成，回到地图");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("says so when the live answer did not mention what was asked", async () => {
    const { run } = await render();
    await press("开始");
    await press("帮我看看这张照片。");
    await press("就选这个");
    await press("继续");
    await press("咖啡照片");
    await press("发送");
    expect(run).toHaveBeenCalledTimes(1);
    expect(text()).toContain("它只能自己决定说什么");
    await press("继续");
    // This answer has no spoon: tapping a sentence is a miss, the honest button ends it.
    await press("这是一杯放在碟子上的咖啡。");
    expect(container.querySelector(".primm-steps__toast")?.textContent).toBe("这句不是，再找找");
    await press("这次它没提到");
    expect(text()).toContain("这次它没提勺子");
  });

  it("keeps the learner's words when a run fails and lets them retry", async () => {
    let fail = true;
    const { run } = await render({
      runPrimm: vi.fn<RunPrimm>(async (request) => {
        if (fail) throw new Error("unavailable");
        return {
          kind: "live",
          prompt: request.prompt,
          text: "勺子在杯子的右边。",
          requestId: crypto.randomUUID(),
          model: "test",
          createdAt: new Date().toISOString(),
          sourceIds: [],
        };
      }),
    });
    void run;
    await press("开始");
    await press("勺子在杯子的哪一边？");
    await press("就选这个");
    await press("继续");
    await press("咖啡照片");
    await press("发送");
    expect(text()).toContain("这次没有拿到结果。");
    fail = false;
    await press("再试一次");
    expect(text()).toContain("你只问了勺子");
  });
});

describe("a step session restores only what it can show", () => {
  it("never resumes past the first step that is not done", () => {
    const saved = { ...initialStepsSession(), index: 7, done: ["guess-how"] };
    expect(restoreStepsSession(lesson, JSON.stringify(saved)).index).toBe(2);
    expect(restoreStepsSession(lesson, "{not json").index).toBe(0);
    expect(restoreStepsSession(lesson, JSON.stringify({ ...saved, version: 2 })).index).toBe(0);
  });
  it("drops unknown steps and malformed runs", () => {
    const saved = {
      ...initialStepsSession(),
      done: ["guess-how", "invented"],
      runs: { starter: { request: { prompt: "a" }, result: { prompt: "b" } } },
    };
    const restored = restoreStepsSession(lesson, JSON.stringify(saved));
    expect(restored.done).toEqual(["guess-how"]);
    expect(restored.runs).toEqual({});
  });
});
