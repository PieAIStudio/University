// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileChoiceAnswerKey, type CheckpointLesson } from "@pieai/university-core";
import { MapCheckpoint } from "./MapCheckpoint.js";
import { MapChallenge } from "./MapChallenge.js";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
const locator = { studyId: "test", courseId: "course", unitId: "unit", lessonId: "two" };
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((node) => node.textContent?.includes(text))!;
const click = async (node: Element) => {
  expect(node).toBeTruthy();
  await act(async () => (node as HTMLElement).click());
};
const lessons: CheckpointLesson[] = ["one", "two"].map((id) => ({
  id,
  title: id,
  contentRevision: 1,
  exercises: [
    {
      id: `${id}-test`,
      prompt: `Question ${id}`,
      answerKey: compileChoiceAnswerKey("right"),
      options: [
        { id: "right", text: "Right option" },
        { id: "wrong", text: "Wrong option" },
      ],
    },
  ],
}));

describe("map node sessions", () => {
  it("retains first answers and settles only after complete coverage", async () => {
    const commit = vi.fn<Parameters<typeof MapCheckpoint>[0]["onCommit"]>(async () => {});
    await act(async () =>
      root.render(
        <MapCheckpoint
          lessons={lessons}
          locator={locator}
          accountScope="test-user-one"
          onClose={() => {}}
          onOpenLesson={() => {}}
          onCommit={commit}
        />,
      ),
    );
    await click(button("开始检查"));
    await click(button("Wrong option"));
    await click(button("交这一题"));
    expect(commit).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("可以跳过");
    await click(button("Right option"));
    await click(button("查看结果"));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![1]).toMatchObject([
      { lessonId: "one", answer: "wrong" },
      { lessonId: "two", answer: "right" },
    ]);
    expect(host.textContent).toContain("可以跳过 1 节");
    expect(host.textContent).toContain("这些还值得学一遍");
  });
  it("retains answers on a failed commit and supports a safe retry", async () => {
    const commit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    await act(async () =>
      root.render(
        <MapCheckpoint
          lessons={lessons.slice(0, 1)}
          locator={locator}
          accountScope="test-user-one"
          onClose={() => {}}
          onOpenLesson={() => {}}
          onCommit={commit}
        />,
      ),
    );
    await click(button("开始检查"));
    await click(button("Right option"));
    await click(button("查看结果"));
    expect(host.textContent).toContain("结果还没保存好");
    await click(button("查看结果"));
    expect(commit).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("这一段检查通过");
  });
  it("does not expose a quiz that would skip unassessed practical work", async () => {
    const commit = vi.fn();
    await act(async () =>
      root.render(
        <MapCheckpoint
          lessons={[
            {
              id: "make",
              title: "Practical task",
              contentRevision: 1,
              exercises: [{ id: "make", prompt: "Create something" }],
            },
          ]}
          locator={locator}
          accountScope="test-user-one"
          onClose={() => {}}
          onOpenLesson={() => {}}
          onCommit={commit}
        />,
      ),
    );
    expect(host.textContent).toContain("不能用简短答题来跳过");
    expect(button("开始检查")).toBeUndefined();
    expect(commit).not.toHaveBeenCalled();
  });
  it("matches native cards, pauses, restores and reports only practice", async () => {
    const played = vi.fn();
    const cards = Array.from({ length: 3 }, (_, i) => ({
      id: `card${i}`,
      front: `Question ${i}`,
      back: `Answer ${i}`,
      lessonId: "one",
      lessonTitle: "Learned lesson",
      contentRevision: 1,
    }));
    const render = (items = cards) => (
      <MapChallenge
        cards={items}
        locator={locator}
        accountScope="test-user-one"
        onClose={() => {}}
        onPlayed={played}
      />
    );
    await act(async () => root.render(render()));
    await click(button("慢慢玩"));
    await click(button("开始配对"));
    expect((host.querySelector('[data-match-back="card1"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
    await click(host.querySelector('[data-match-front="card0"]')!);
    await click(host.querySelector('[data-match-back="card1"]')!);
    expect(host.textContent).toContain("这两张不是一组");
    await click(host.querySelector('[data-match-front="card0"]')!);
    await click(host.querySelector('[data-match-back="card0"]')!);
    await click(button("暂停"));
    expect(host.querySelector("[data-match-front]")).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(render([...cards].reverse())));
    expect(host.textContent).toContain("已暂停");
    await click(button("接着玩"));
    expect((host.querySelector('[data-match-front="card0"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    for (const id of ["card1", "card2"]) {
      await click(host.querySelector(`[data-match-back="${id}"]`)!);
      await click(host.querySelector(`[data-match-front="${id}"]`)!);
    }
    await click(button("结束这一轮"));
    expect(played).toHaveBeenCalledWith(["card0", "card1", "card2"]);
    expect(host.textContent).toContain("复习安排和跳级记录没有改变");
  });
});
