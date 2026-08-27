// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryIdentityPort } from "@pieai/university-core";

import { AccountPanel } from "./AccountPanel.js";

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

function setInputValue(selector: string, value: string): void {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`missing input ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AccountPanel anonymous binding", () => {
  it("uses linkEmail for the register action so the anonymous identity is retained", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const linkEmail = vi.spyOn(identity, "linkEmail").mockResolvedValue(undefined);
    const signUpWithEmail = vi.spyOn(identity, "signUpWithEmail");

    await act(async () => root.render(<AccountPanel identity={identity} />));
    const register = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("创建账号"),
    );
    if (!register) throw new Error("missing register tab");
    await act(async () => register.click());

    await act(async () => {
      setInputValue('input[name="email"]', "learner@example.com");
      setInputValue('input[name="password"]', "password12");
    });
    const submit = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.type === "submit",
    );
    if (!submit) throw new Error("missing account submit");
    await act(async () => submit.click());

    expect(linkEmail).toHaveBeenCalledWith("learner@example.com", "password12");
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("sends a magic link without asking for a password", async () => {
    const identity = createMemoryIdentityPort();
    const requestMagicLink = vi.spyOn(identity, "requestMagicLink");

    await act(async () => root.render(<AccountPanel identity={identity} />));
    const magicLink = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("免密码登录"),
    );
    if (!magicLink) throw new Error("missing magic link tab");
    await act(async () => magicLink.click());

    expect(container.querySelector('input[name="password"]')).toBeNull();
    await act(async () => {
      setInputValue('input[name="email"]', "learner@example.com");
    });
    const submit = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.type === "submit",
    );
    if (!submit) throw new Error("missing magic link submit");
    await act(async () => submit.click());

    expect(requestMagicLink).toHaveBeenCalledWith("learner@example.com", window.location.origin);
    expect(container.textContent).toContain("登录链接已经发到邮箱");
  });
});
