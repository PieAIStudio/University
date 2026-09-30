// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createMemoryPersistence, createProgressPort } from "@pieai/university-core";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";
import { DomainInterest } from "./DomainInterest.js";
let host: HTMLDivElement, root: Root;
let progress: ReturnType<typeof createProgressPort>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  progress = createProgressPort({ persistence: createMemoryPersistence() });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function show() {
  await act(async () =>
    root.render(
      <InterfaceLanguageProvider locale="en">
        <DomainInterest domainId="ai-media" progress={progress} />
      </InterfaceLanguageProvider>,
    ),
  );
}
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (entry) => entry.textContent === text,
  )!;
async function open() {
  await show();
  await act(async () => button("Tell me when it opens").click());
}
async function enterEmail() {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      "synthetic@example.test",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("opening a form never subscribes, consents or stores an email", async () => {
  await open();
  expect(progress.accountData().preferences.domainInterests).toBeUndefined();
  await enterEmail();
  expect(button("Save my interest").disabled).toBe(true);
  expect(host.textContent).toContain("not connected yet");
});
it("saves only an explicit contact intent and lets the learner withdraw and clear the email", async () => {
  await open();
  await enterEmail();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(progress.accountData().preferences.domainInterests?.["ai-media"]).toMatchObject({
    enabled: true,
    email: "synthetic@example.test",
  });
  expect(host.textContent).toContain("none will be sent now");
  await act(async () => button("Withdraw my interest").click());
  expect(progress.accountData().preferences.domainInterests?.["ai-media"]).toMatchObject({
    enabled: false,
    email: null,
  });
  expect(host.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe("");
});
it("a retained old form action cannot write to a newly switched account", async () => {
  await open();
  await enterEmail();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  const form = host.querySelector("form")!;
  await act(async () => {
    void progress.bindAccount("other", null);
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(progress.accountData().preferences.domainInterests?.["ai-media"]).toBeUndefined();
});
