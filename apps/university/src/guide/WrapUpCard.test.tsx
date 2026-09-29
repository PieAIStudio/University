// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgressPort, type ProgressPort } from "@pieai/university-core";
import { withInterfaceLocale } from "../../../../packages/ui/test-support/interface-locale.js";
import { WrapUpCard } from "./WrapUpCard.js";

let root: Root, host: HTMLDivElement, progress: ProgressPort;
const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  progress = createProgressPort({ persistence: { read: () => null, write: vi.fn() } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(overrides: Partial<Parameters<typeof WrapUpCard>[0]> = {}) {
  const props = {
    progress,
    locator,
    owner: null,
    member: false,
    hasEmail: false,
    offerSave: true,
    offerMember: false,
    objective: "",
    contentRevision: 1,
    onSave: vi.fn(),
    onLater: vi.fn(),
    onMember: vi.fn(),
    onReview: vi.fn(),
    ...overrides,
  };
  await act(async () => root.render(withInterfaceLocale(<WrapUpCard {...props} />)));
  return props;
}
async function click(selector: string) {
  const node = host.querySelector<HTMLButtonElement>(selector)!;
  expect(node).not.toBeNull();
  await act(async () => node.click());
}
describe("V7 wrap-up speaks only about this learner's saved state", () => {
  it("a guest chooses reminders or save-only explicitly; dismissing never grants consent", async () => {
    const props = await render();
    expect(host.querySelector('[data-wrap-up="guest"]')).not.toBeNull();
    expect(progress.accountData().preferences.reviewEmail).toBeUndefined();
    await click('[data-journey-save="remind"]');
    expect(props.onSave).toHaveBeenLastCalledWith(true);
    await click('[data-journey-save="only"]');
    expect(props.onSave).toHaveBeenLastCalledWith(false);
    await click("[data-journey-later]");
    expect(props.onLater).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(2);
    expect(progress.accountData().preferences.reviewEmail).toBeUndefined();
  });
  it("a suppressed save card leaves review and the real next lesson reachable", async () => {
    const next = vi.fn();
    const props = await render({ offerSave: false, onNext: next });
    expect(host.querySelector("[data-email-save-card]")).toBeNull();
    await click("[data-journey-next]");
    await click("[data-journey-review]");
    expect(next).toHaveBeenCalledTimes(1);
    expect(props.onReview).toHaveBeenCalledTimes(1);
  });
  it("an email address alone does not claim the cloud has saved the progress", async () => {
    await render({ hasEmail: true, offerMember: true });
    expect(host.querySelector('[data-wrap-up="email"]')).not.toBeNull();
    expect(host.querySelector('[data-wrap-up-sync="pending"]')).not.toBeNull();
    expect(host.querySelector("[data-email-save-card]")).toBeNull();
    expect(host.querySelector("[data-member-line]")).not.toBeNull();
    await render({ hasEmail: true, offerMember: false });
    expect(host.querySelector("[data-member-line]")).toBeNull();
  });
  it("a member gets no save request or membership pitch", async () => {
    await render({ member: true, hasEmail: true, offerMember: true });
    expect(host.querySelector('[data-wrap-up="member"]')).not.toBeNull();
    expect(
      host.querySelector("[data-email-save-card],[data-member-line],[data-wrap-up-sync]"),
    ).toBeNull();
  });
  it("hides the previous learner's card immediately when the progress owner changes", async () => {
    await render({ owner: "different-learner" });
    expect(host.querySelector("[data-wrap-up]")).toBeNull();
  });
});
