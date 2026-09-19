// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { primmFixture } from "../../../core/src/learning-play/fixtures/primm.js";
import { I18nProvider } from "../i18n/index.js";
import { PrimmLesson } from "./PrimmLesson.js";
import { restorePrimmSession, initialPrimmSession } from "./primm-session.js";
import type { PrimmLessonProps, PrimmOutput, RunPrimm } from "./primm-types.js";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
async function click(text: string) {
  const button = buttons().find(
    (b) => b.textContent === text || b.getAttribute("aria-label") === text,
  );
  expect(button, text).toBeTruthy();
  expect(button!.disabled, text).toBe(false);
  await act(async () => button!.click());
}
async function type(text: string, selector = "textarea") {
  const field = container.querySelector<HTMLTextAreaElement>(selector)!;
  expect(field).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const stage = () => container.querySelector("[data-primm-stage]")?.getAttribute("data-primm-stage");

it("introduces the learner need before the supporting case, once", async () => {
  const activity = { ...structuredClone(primmFixture), experienceVersion: 2 as const };
  await render({ activity });
  const situation = container.querySelector(".primm__situation")!;
  const caseNote = container.querySelector(".primm__case")!;
  expect(situation.textContent).toBe(activity.intro.situation);
  expect(
    situation.compareDocumentPosition(caseNote) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(container.textContent!.split(activity.intro.situation)).toHaveLength(2);
});
async function render(extra: Partial<PrimmLessonProps> = {}) {
  const run = vi.fn<RunPrimm>(async (request) => ({
    kind: "live",
    prompt: request.prompt,
    text: "本次模型实际输出的测试内容",
    requestId: crypto.randomUUID(),
    model: "test",
    createdAt: new Date().toISOString(),
    sourceIds: ["button-source"],
  }));
  const grade = vi.fn<NonNullable<PrimmLessonProps["evaluatePrimm"]>>(async () => ({
    outcome: "pass" as const,
    explanation: "这次任务已完成",
  }));
  const complete = vi.fn(async () => {});
  await act(async () =>
    root.render(
      <I18nProvider locale="zh-CN">
        <PrimmLesson
          activity={primmFixture}
          lessonRef={{ studyId: "s", courseId: "c", unitId: "u", lessonId: "l" }}
          contentRevision={2}
          runPrimm={run}
          evaluatePrimm={grade}
          onPrimmComplete={complete}
          {...extra}
        />
      </I18nProvider>,
    ),
  );
  return { run, grade, complete };
}
async function toInvestigate() {
  await click("一段更宽泛的按钮介绍");
  await click("继续");
  await click("运行这段请求");
  await click("继续");
}
async function sortCards() {
  const game = primmFixture.investigate.game;
  if (game.kind !== "sort") throw Error();
  for (const c of game.cards) {
    await click(c.text);
    await click(game.buckets.find((b) => b.id === c.bucketId)!.label);
  }
  await click("继续");
}
describe("one linear PRIMM journey", () => {
  it("uses attachment, investigation, editable construction and independent creation as different actions", async () => {
    const activity = structuredClone(primmFixture);
    activity.experienceVersion = 2;
    activity.run.attachmentLabel = "把材料放进对话";
    activity.modify.workbench = {
      instruction: "补充一句用途，再改成自己的话。",
      pieces: [
        { id: "reader", label: "读者", text: "写给新手看。" },
        { id: "format", label: "排法", text: "分行列出。" },
      ],
    };
    activity.make.artifactLabel = "我的提示卡";
    const { run } = await render({ activity });
    await click("一段更宽泛的按钮介绍");
    await click("继续");
    expect(buttons().find((button) => button.textContent === "发送材料和这句请求")?.disabled).toBe(
      true,
    );
    await click("把材料放进对话");
    await click("发送材料和这句请求");
    expect(run.mock.calls[0]![0].prompt).toBe(activity.starter.prompt);
    await click("继续");
    await sortCards();
    expect(container.querySelector('[data-primm-operation="build-request"]')).not.toBeNull();
    await click("加上：读者");
    await type("写给第一次使用键盘的人看。", '[data-fragment-id="reader"] textarea');
    const assembled = `${activity.starter.prompt}\n写给第一次使用键盘的人看。`;
    expect(container.querySelector(".primm-workbench__preview")?.textContent).toContain(assembled);
    await click("按新请求再试一次");
    expect(run.mock.calls[1]![0].prompt).toBe(assembled);
    await click("继续");
    expect(container.querySelector('[data-primm-operation="build-request"]')).toBeNull();
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
    await type("请为第一次预约图书馆的人写两条提示。");
    await click("让 AI 帮我写一份初稿");
    expect(container.querySelector('[data-primm-operation="make-artifact"]')).not.toBeNull();
  });
  it("restores the visible fragment text as the only executable modified request", () => {
    const activity = structuredClone(primmFixture);
    activity.modify.workbench = {
      instruction: "补充用途",
      pieces: [
        { id: "a", label: "读者", text: "给新手看" },
        { id: "b", label: "格式", text: "分行" },
      ],
    };
    const saved = {
      ...initialPrimmSession(activity),
      fragments: [{ id: "starter", text: "Visible request" }],
      modifyPrompt: "Hidden stale request",
    };
    expect(restorePrimmSession(activity, JSON.stringify(saved)).modifyPrompt).toBe(
      "Visible request",
    );
    expect(
      restorePrimmSession(
        activity,
        JSON.stringify({
          ...saved,
          fragments: [
            { id: "x", text: "a" },
            { id: "x", text: "b" },
          ],
        }),
      ).modifyPrompt,
    ).toBe(activity.starter.prompt);
  });
  it("lets any prediction reach actual Run and never reveals later panels early", async () => {
    const { run } = await render();
    expect(stage()).toBe("predict");
    expect(container.querySelector("textarea")).toBeNull();
    for (const copy of ["本次练习记录", "先去独立练习", "这一版学过了", "按需查看完整讲解"])
      expect(container.textContent).not.toContain(copy);
    await click("一段更宽泛的按钮介绍");
    await click("继续");
    expect(stage()).toBe("run");
    expect(run).not.toHaveBeenCalled();
    await click("运行这段请求");
    expect(run.mock.calls[0]![0].prompt).toBe(primmFixture.starter.prompt);
    await click("继续");
    expect(stage()).toBe("investigate");
  });
  it("requires manipulation, a changed execution, and independent graded work before completion", async () => {
    const { run, grade, complete } = await render();
    await toInvestigate();
    expect(buttons().find((b) => b.textContent === "继续")?.disabled).toBe(true);
    await sortCards();
    expect(stage()).toBe("modify");
    expect(buttons().find((b) => b.textContent === "运行这段请求")?.disabled).toBe(true);
    await type("改成给初次使用键盘的人看的说明");
    await click("运行这段请求");
    await click("继续");
    expect(stage()).toBe("make");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("");
    await type("独立写出图书馆预约提示");
    await click("运行这段请求");
    await type("我自己检查并修好的作品", "[data-final-work]");
    await click("看看这次做得怎样");
    expect(grade.mock.calls[0]![0]).toMatchObject({ finalWork: "我自己检查并修好的作品" });
    expect(complete).not.toHaveBeenCalled();
    await click("查看我的作品");
    await click("完成，回到地图");
    expect(complete).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledTimes(3);
  });
  it("lets the teacher speak only after the learner has acted", async () => {
    const activity = structuredClone(primmFixture);
    activity.run.debrief = "对照你的预想：它说到了哪一步？";
    activity.modify.debrief = "看看改过的那句话换来了什么。";
    await render({ activity });
    await click("一段更宽泛的按钮介绍");
    await click("继续");
    expect(container.textContent).not.toContain(activity.run.debrief);
    await click("运行这段请求");
    expect(container.textContent).toContain(activity.run.debrief);
    await click("继续");
    expect(container.textContent).not.toContain(activity.investigate.explanation);
    const game = activity.investigate.game;
    if (game.kind !== "sort") throw Error();
    for (const c of game.cards) {
      await click(c.text);
      await click(game.buckets.find((b) => b.id === c.bucketId)!.label);
    }
    expect(container.textContent).toContain(activity.investigate.explanation);
    await click("继续");
    expect(container.textContent).toContain("先改动原请求，再运行比较。");
    expect(container.textContent).not.toContain(activity.modify.debrief);
    await type("改成给初次使用键盘的人看的说明");
    await click("运行这段请求");
    expect(container.textContent).toContain(activity.modify.debrief);
  });
  it("lets the learner check the actual result item by item before any explanation", async () => {
    const activity = structuredClone(primmFixture);
    activity.investigate.game = {
      kind: "check-result",
      instruction: "对照刚才的结果，逐项看它保住了没有",
      items: [
        { id: "keys", label: "要按的键", expected: "Enter 或空格", why: "按错键不会响应" },
        { id: "focus", label: "先做什么", expected: "先让按钮获得焦点", why: "没有焦点按键无效" },
      ],
    };
    await render({ activity });
    await toInvestigate();
    // The actual run result is on screen to compare against; nothing is revealed yet.
    expect(container.textContent).toContain("本次模型实际输出的测试内容");
    expect(container.textContent).not.toContain("Enter 或空格");
    expect(container.textContent).not.toContain(activity.investigate.explanation);
    await click("要按的键：结果里没有");
    expect(container.textContent).toContain("原材料里：Enter 或空格");
    expect(buttons().find((b) => b.textContent === "继续")?.disabled).toBe(true);
    await click("先做什么：结果里有，没变");
    expect(container.textContent).toContain(activity.investigate.explanation);
    // Two judgments inside one task (fast keyboard) must both be kept.
    const byLabel = (label: string) =>
      buttons().find((b) => b.getAttribute("aria-label") === label)!;
    await act(async () => {
      byLabel("要按的键：结果里有，但变了").click();
      byLabel("先做什么：结果里没有").click();
    });
    expect(byLabel("要按的键：结果里有，但变了").getAttribute("aria-pressed")).toBe("true");
    expect(byLabel("先做什么：结果里没有").getAttribute("aria-pressed")).toBe("true");
    expect(buttons().find((b) => b.textContent === "继续")?.disabled).toBe(false);
  });
  it("does not replace failed execution with a canned answer", async () => {
    await render({
      runPrimm: async () => {
        throw Error("private provider error");
      },
    });
    await click("两条键盘操作提示");
    await click("继续");
    await click("运行这段请求");
    expect(stage()).toBe("run");
    expect(container.textContent).toContain("这次没有拿到结果");
    expect(container.textContent).not.toContain("private provider");
    expect(buttons().find((b) => b.textContent === "继续")?.disabled).toBe(true);
  });
  it("ignores a late response after cancellation", async () => {
    let finish: (value: PrimmOutput) => void = () => {};
    let request: Parameters<RunPrimm>[0];
    await render({
      runPrimm: (input) => {
        request = input;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    await click("两条键盘操作提示");
    await click("继续");
    await click("运行这段请求");
    await click("取消这次运行");
    await act(async () =>
      finish({
        kind: "live",
        text: "stale result",
        prompt: request!.prompt,
        requestId: "old",
        model: "test",
        createdAt: "now",
        sourceIds: [],
      }),
    );
    expect(container.textContent).not.toContain("stale result");
    expect(stage()).toBe("run");
  });
  it("never trusts a saved final stage or cached pass as current independent evidence", () => {
    const saved = {
      ...initialPrimmSession(primmFixture),
      stage: 5,
      evaluation: { outcome: "pass", explanation: "forged" },
    };
    expect(restorePrimmSession(primmFixture, JSON.stringify(saved)).stage).toBe(0);
  });
  it("rejects a corrupt cached layout rather than dereferencing unknown source items", () => {
    const activity: PrimmLessonProps["activity"] = {
      ...primmFixture,
      investigate: {
        ...primmFixture.investigate,
        game: {
          kind: "layout",
          instruction: "Arrange the facts",
          items: [
            { id: "a", label: "A", text: "First fact" },
            { id: "b", label: "B", text: "Second fact" },
          ],
          formats: [
            { id: "list", label: "List" },
            { id: "paragraph", label: "Paragraph" },
          ],
        },
      },
    };
    const initial = initialPrimmSession(activity);
    for (const order of [["missing", "b"], ["a", "a"], ["a"], [123, "b"]]) {
      const saved = { ...initial, investigation: { ...initial.investigation, order } };
      expect(restorePrimmSession(activity, JSON.stringify(saved))).toEqual(initial);
    }
  });
});
