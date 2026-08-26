// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewReminderPort, ReviewReminderStatus } from "@pieai/university-core";

import { ReviewReminderSettings } from "../navigation/empty/ReviewReminderSettings";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(),
    });
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function reminder(status: ReviewReminderStatus): ReviewReminderPort {
  return {
    snapshot: () => status,
    subscribe: () => () => undefined,
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
  };
}

describe("ReviewReminderSettings", () => {
  it("reads status without asking, then enables only after the settings action", async () => {
    const reminders = reminder({ kind: "permission-default" });
    await act(async () => root.render(<ReviewReminderSettings reminders={reminders} />));

    expect(reminders.refresh).toHaveBeenCalledTimes(1);
    expect(reminders.enable).not.toHaveBeenCalled();
    expect(container.textContent).toContain("未开启");

    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("明天有卡时提醒我"),
    );
    await act(async () => toggle?.click());
    expect(reminders.enable).toHaveBeenCalledTimes(1);
  });

  it("keeps a denied browser state visible without trying to request again", async () => {
    const reminders = reminder({ kind: "permission-denied" });
    await act(async () => root.render(<ReviewReminderSettings reminders={reminders} />));

    expect(container.textContent).toContain("浏览器已拒绝");
    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("明天有卡时提醒我"),
    );
    await act(async () => toggle?.click());
    expect(reminders.enable).not.toHaveBeenCalled();
    expect(container.textContent).toContain("这里不会反复弹窗");
  });

  it("does not imply that an active subscription can deliver before the server exists", async () => {
    const reminders = reminder({
      kind: "subscribed",
      endpoint: "https://push.example/device",
      serverConnected: false,
    });
    await act(async () => root.render(<ReviewReminderSettings reminders={reminders} />));

    expect(container.textContent).toContain("已订阅，但服务端还没接上，暂时不会真的收到提醒");
  });
});
