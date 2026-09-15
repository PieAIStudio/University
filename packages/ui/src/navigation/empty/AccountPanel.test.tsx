// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIdentityPort,
  createMemoryIdentityPort,
  type IdentityAuth,
} from "@pieai/university-core";
import { setActiveLocale, translate } from "../../i18n/index.js";

import {
  ACCOUNT_UNCONFIGURED_ACTION,
  ACCOUNT_UNCONFIGURED_REASON,
  AccountPanel,
} from "./AccountPanel.js";

let container: HTMLDivElement;
let root: Root;

type IdentityAuthSession = Awaited<ReturnType<IdentityAuth["getSession"]>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal ??= function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function close() {
      this.removeAttribute("open");
    };
  }
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
  it("keeps the guest form through pending, displays failure, and retries only once", async () => {
    setActiveLocale("en");
    const first = deferred<IdentityAuthSession>();
    const guest = { user: { id: "synthetic-guest", email: null, is_anonymous: true } };
    const signIn = vi
      .fn<IdentityAuth["signInWithEmail"]>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ user: { id: "synthetic-member", email: "learner@example.test" } });
    const auth: IdentityAuth = {
      getSession: async () => guest,
      getAccessToken: async () => null,
      onAuthStateChange: () => ({ unsubscribe() {} }),
      signInAnonymously: async () => guest,
      signInWithEmail: signIn,
      signUpWithEmail: async () => null,
      requestMagicLink: async () => {},
      linkEmail: async () => null,
      signOut: async () => {},
    };
    const identity = createIdentityPort(auth);
    await act(async () => root.render(<AccountPanel identity={identity} />));
    container.querySelector("details")!.open = true;
    await act(async () => {
      setInputValue('input[name="email"]', "learner@example.test");
      setInputValue('input[name="password"]', "synthetic-password12");
    });
    const form = container.querySelector("form")!;
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    const retainedWhilePending = container.querySelector("form") === form;
    const fieldsDisabled = [...container.querySelectorAll("input, button")].every((element) =>
      element.matches(":disabled"),
    );
    await act(async () => first.reject(new Error("private-provider-detail")));
    expect(retainedWhilePending).toBe(true);
    expect(fieldsDisabled).toBe(true);
    expect(container.textContent).toContain("Sign-in did not finish");
    expect(container.textContent).not.toContain("private-provider-detail");
    expect(identity.status()).toMatchObject({ kind: "anonymous", user: { id: "synthetic-guest" } });
    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe(
      "learner@example.test",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="password"]')?.value).toBe("");
    await act(async () => setInputValue('input[name="password"]', "synthetic-password12"));
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(identity.status()).toMatchObject({
      kind: "signed_in",
      user: { id: "synthetic-member" },
    });
  });

  it("keeps the registration confirmation on the same form after the pending request", async () => {
    setActiveLocale("en");
    const registration = deferred<IdentityAuthSession>();
    const auth: IdentityAuth = {
      getSession: async () => null,
      getAccessToken: async () => null,
      onAuthStateChange: () => ({ unsubscribe() {} }),
      signInAnonymously: async () => null,
      signInWithEmail: async () => null,
      signUpWithEmail: () => registration.promise,
      requestMagicLink: async () => {},
      linkEmail: async () => null,
      signOut: async () => {},
    };
    const identity = createIdentityPort(auth);
    await act(async () => root.render(<AccountPanel identity={identity} />));
    container.querySelector("details")!.open = true;
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click(),
    );
    await act(async () => {
      setInputValue('input[name="email"]', "new-learner@example.test");
      setInputValue('input[name="password"]', "synthetic-password12");
    });
    const form = container.querySelector("form")!;
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    const retainedWhilePending = container.querySelector("form") === form;
    await act(async () => registration.resolve(null));
    expect(retainedWhilePending).toBe(true);
    expect(container.textContent).toContain(
      translate("ui.navigation.empty.accountPanel.copy.请去邮箱点开确认信-然后再回来登录"),
    );
    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe(
      "new-learner@example.test",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="password"]')?.value).toBe("");
    expect(identity.status().kind).toBe("signed_out");
  });

  it("turns an unconfigured login click into an explicit explanation", async () => {
    const identity = createIdentityPort(null);

    await act(async () => root.render(<AccountPanel identity={identity} />));
    const action = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes(ACCOUNT_UNCONFIGURED_ACTION),
    );
    if (!action) throw new Error("missing unavailable account action");

    await act(async () => action.click());

    expect(container.textContent).toContain(ACCOUNT_UNCONFIGURED_REASON);
  });

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
    expect(container.textContent).toContain("已请求登录链接");
    expect(identity.status().kind).toBe("signed_out");
  });

  it("keeps a rejected sign-out visible and permits a real retry", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInWithEmail("learner@example.test", "password12");
    const signOut = vi
      .spyOn(identity, "signOut")
      .mockRejectedValueOnce(new Error("private-provider-detail"));
    await act(async () => root.render(<AccountPanel identity={identity} />));
    const button = () =>
      container.querySelector<HTMLButtonElement>(".account-panel__signed-in button")!;
    await act(async () => button().click());
    expect(identity.status().kind).toBe("signed_in");
    expect(container.textContent).toContain("退出登录没有完成");
    expect(container.textContent).not.toContain("private-provider-detail");
    expect(button().disabled).toBe(false);
    await act(async () => button().click());
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(identity.status().kind).toBe("signed_out");
  });

  it("localizes a typed account failure without leaking raw provider text", async () => {
    setActiveLocale("en");
    const identity = createMemoryIdentityPort();
    const failure = {
      kind: "error",
      code: "sign-in-failed",
      message: "internal-debug-body",
    } as const;
    identity.status = () => failure;
    await act(async () => root.render(<AccountPanel identity={identity} />));
    expect(container.textContent).toContain("Sign-in did not finish");
    expect(container.textContent).not.toContain("internal-debug-body");
    expect(container.querySelector("input[type=password]")).not.toBeNull();
    expect(container.querySelector("details")?.open).toBe(true);
  });
});
