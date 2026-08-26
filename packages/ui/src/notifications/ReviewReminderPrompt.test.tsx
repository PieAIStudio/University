// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewReminderPort, ReviewReminderStatus } from "@pieai/university-core";

import { ReviewReminderPrompt } from "./ReviewReminderPrompt";

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

function reminder(status: ReviewReminderStatus = { kind: "permission-default" }) {
  return {
    snapshot: () => status,
    subscribe: () => () => undefined,
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
  } satisfies ReviewReminderPort;
}

async function renderPrompt(reminders: ReviewReminderPort): Promise<void> {
  await act(async () => {
    root.render(<ReviewReminderPrompt dueTomorrow={3} eligible reminders={reminders} />);
  });
}

describe("ReviewReminderPrompt", () => {
  it("explains the value before either action can reach the browser port", async () => {
    const reminders = reminder();
    await renderPrompt(reminders);

    expect(container.textContent).toContain("明天有 3 张复习卡回来");
    expect(container.textContent).toContain("每天最多一条");
    expect(container.textContent).toContain("随时可以在设置里关掉");
    expect(reminders.enable).not.toHaveBeenCalled();

    const later = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("以后再说"),
    );
    await act(async () => later?.click());
    expect(reminders.enable).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("明天有 3 张复习卡回来");
  });

  it("calls enable only from the explicit 好 action", async () => {
    const reminders = reminder();
    await renderPrompt(reminders);

    const good = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("好"),
    );
    await act(async () => good?.click());
    expect(reminders.enable).toHaveBeenCalledTimes(1);
  });

  it("does not appear for a bookmarked settlement", async () => {
    const reminders = reminder();
    await act(async () => {
      root.render(<ReviewReminderPrompt dueTomorrow={3} eligible={false} reminders={reminders} />);
    });
    expect(container.textContent).toBe("");
  });
});
