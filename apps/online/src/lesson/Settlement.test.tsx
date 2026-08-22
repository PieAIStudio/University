// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Card } from "../content/library";
import { Settlement } from "./Settlement";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("@pieai/university-ui/sound/index.js", () => ({
  playSound,
}));

const CARD: Card = { id: "c1", kind: "basic", front: "幂等", back: "做一次和做两次结果一样。" };

const NEXT_LESSON = {
  title: "屏幕上的按钮，代码里能找到对应的哪几行？",
  content: "正文",
  exercises: [{}],
};

const NEXT_UNIT = {
  title: "你每天用的 App，拆开是什么",
  objective: "能说出使用和开发的差别。",
  lessons: [NEXT_LESSON],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  playSound.mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderSettle(props: Partial<Parameters<typeof Settlement>[0]> = {}): Promise<void> {
  const onMap = props.onMap ?? vi.fn();
  await act(async () => {
    root.render(
      <Settlement
        lessonTitle="会使用 App 和会开发 App，差在哪儿？"
        courseTitle="《在开始之前：App、代码、和你》"
        dropped={[{ card: CARD, dueAt: Date.now() + 86_400_000 }]}
        builtBefore={0}
        builtAfter={1}
        doneBefore={0}
        doneAfter={1}
        lessons={41}
        streakDays={1}
        unlocked={[]}
        nextLesson={NEXT_LESSON}
        nextUnit={NEXT_UNIT}
        onNext={vi.fn()}
        onMap={onMap}
        onStartUnit={vi.fn()}
        {...props}
      />,
    );
  });
}

describe("Settlement", () => {
  it("makes the moved progress the lead, not the remainder", async () => {
    await renderSettle();
    expect(container.textContent).toContain("读完了。");
    expect(container.textContent).toContain("1 / 41 关");
    expect(container.textContent).not.toContain("还剩");
    expect(container.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("1");
    expect(container.querySelector("[role=progressbar]")?.getAttribute("aria-valuemax")).toBe("41");
  });

  it("puts the next lesson on a node card rather than a title link", async () => {
    await renderSettle();
    expect(container.querySelector(".path-card--embedded")).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain(NEXT_LESSON.title);
    expect(container.textContent).not.toContain("下一关 · ");
  });

  it("prints an unlocked concept only when the catalogue actually has it", async () => {
    await renderSettle({
      unlocked: [{ id: "frontend", zh: "前端", tagline: "你在网页上看到、点到、填进去的那一层。" }],
    });
    expect(container.textContent).toContain("这一节记下的概念");
    expect(container.textContent).toContain("前端");
    expect(container.textContent).toContain("你在网页上看到、点到、填进去的那一层。");
  });

  it("does not invent an unlock section when the lesson named nothing", async () => {
    await renderSettle({ unlocked: [] });
    expect(container.textContent).not.toContain("这一节记下的概念");
  });

  it("does not render a leftover zero as the reward", async () => {
    await renderSettle({
      dropped: [],
      builtBefore: 0,
      builtAfter: 0,
      doneBefore: 0,
      doneAfter: 0,
      lessons: 0,
      streakDays: 0,
      nextLesson: null,
      nextUnit: null,
      onNext: null,
    });
    expect(container.textContent).not.toContain("还剩");
    expect(container.querySelector("[role=progressbar]")).toBeNull();
    expect(container.querySelector(".settle__gains")?.textContent?.trim()).toBe("");
  });

  it("still plays only the loudest true cue", async () => {
    await renderSettle();
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("reward.built");
  });
});
