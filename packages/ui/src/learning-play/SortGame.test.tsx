// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SortActivity } from "@pieai/university-core";
import { SortGame } from "./SortGame.js";

const ACTIVITY: SortActivity = {
  kind: "sort",
  id: "is-it-a-component",
  title: "这算不算一个组件",
  brief: "把每一样放进它真正属于的那一格。",
  goal: "说得出组件不等于功能。",
  takeaway: "组件是样子和反应住在同一个文件里的那一块。",
  hint: "先问：它有没有自己的样子？",
  question: "下面这些，哪些是组件？",
  source: { label: "React 官方文档", url: "https://react.dev/learn/your-first-component" },
  buckets: [
    { id: "component", label: "是组件", note: "样子和反应住在一个文件里" },
    { id: "not", label: "不是组件", note: "它是别的东西" },
  ],
  items: [
    {
      id: "upload-button",
      label: "那个上传按钮",
      detail: "自己画样子，也自己处理被点。",
      bucketId: "component",
      why: "样子和反应都在它自己那份文件里。",
    },
    {
      id: "remove-background",
      label: "「去掉背景」这件事",
      detail: "点了之后会发生的那一串。",
      bucketId: "not",
      why: "这是一个功能，不是屏幕上的一块。",
      tempting: { bucketId: "component", whyNot: "它没有自己的样子——你指不出它在屏幕的哪儿。" },
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

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

async function render(onAttempt = vi.fn()) {
  await act(async () => {
    root.render(<SortGame activity={ACTIVITY} disabled={false} onAttempt={onAttempt} guided />);
  });
  return onAttempt;
}

const items = () => [...container.querySelectorAll<HTMLButtonElement>(".play-sort__item")];
const buckets = () => [...container.querySelectorAll<HTMLButtonElement>(".play-sort__bucket-head")];
const note = () => container.querySelector(".play-sort__note")?.textContent ?? "";

async function put(itemLabel: string, bucketLabel: string) {
  const item = items().find((button) => button.textContent?.includes(itemLabel));
  await act(async () => item?.click());
  const bucket = buckets().find((button) => button.textContent?.includes(bucketLabel));
  await act(async () => bucket?.click());
}

describe("the sorting bench", () => {
  it("will not accept a bucket until something is in hand", async () => {
    await render();
    // Every bucket starts disabled, so a reader cannot press one and wonder why
    // nothing happened — the first move is picking a thing.
    expect(buckets().every((button) => button.disabled)).toBe(true);
  });

  it("keeps the item and names the reason when the tempting bucket is chosen", async () => {
    await render();
    await put("去掉背景", "是组件");
    expect(note()).toContain("没有自己的样子");
    expect(items().some((button) => button.textContent?.includes("去掉背景"))).toBe(true);
    expect(container.querySelector(".play-sort__placed")).toBeNull();
  });

  it("moves the item and gives its own reason when the bucket is right", async () => {
    await render();
    await put("上传按钮", "是组件");
    expect(note()).toContain("自己那份文件");
    expect(container.querySelector(".play-sort__placed")?.textContent).toContain("上传按钮");
  });

  /*
    Completion is reported once, by the host's contract, and only when every
    item sits where it belongs. Reporting per correct placement would let a
    half-finished board count as evidence.
  */
  it("reports completion only after the last item lands", async () => {
    const onAttempt = await render();
    await put("上传按钮", "是组件");
    expect(onAttempt).not.toHaveBeenCalled();
    await put("去掉背景", "不是组件");
    expect(onAttempt).toHaveBeenCalledOnce();
    expect(onAttempt.mock.calls[0]?.[0]).toBe(true);
  });
});
