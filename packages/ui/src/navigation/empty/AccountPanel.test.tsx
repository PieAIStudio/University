// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthFlowError,
  type AuthPort,
  type AuthResult,
  type AuthSession,
} from "@pieaistudio/swimmer-auth-kit";
import { createIdentityPort, type IdentityAuth } from "@pieai/university-core";
import { setActiveLocale } from "../../i18n/index.js";

import {
  ACCOUNT_UNCONFIGURED_ACTION,
  ACCOUNT_UNCONFIGURED_REASON,
  AccountPanel,
} from "./AccountPanel.js";

let container: HTMLDivElement;
let root: Root;

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

function openAccountForm(): void {
  const details = container.querySelector("details");
  if (details) details.open = true;
}

type SharedAccount = IdentityAuth & AuthPort & { emit(session: AuthSession): void };

function sharedAccount(initial: AuthSession): SharedAccount {
  let current = initial;
  const listeners = new Set<(session: AuthSession) => void>();
  const emit = (session: AuthSession) => {
    current = session;
    for (const listener of listeners) listener(session);
  };
  const subscribe = (listener: (session: AuthSession) => void) => {
    listeners.add(listener);
    return {
      unsubscribe() {
        listeners.delete(listener);
      },
    };
  };
  return {
    getSession: async () => current,
    getCurrentUser: async () => current?.user ?? null,
    getAccessToken: async () => null,
    onAuthStateChange: (listener) =>
      subscribe((session) => {
        listener(session, session ? "SIGNED_IN" : "SIGNED_OUT");
      }),
    signInAnonymously: async () => current,
    signInWithEmail: async () => current,
    signUpWithEmail: async () => current,
    requestMagicLink: async () => {},
    linkEmail: async () => current,
    signOut: async () => {
      emit(null);
    },
    execute: async () => ({ status: "email-requested" }),
    emit,
  };
}

describe("AccountPanel anonymous binding", () => {
  it("keeps the guest form through pending, displays failure, and retries only once", async () => {
    setActiveLocale("en");
    const first = deferred<AuthResult>();
    const guest = {
      user: { id: "synthetic-guest", email: null, is_anonymous: true },
    } as const;
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(guest);
    const execute = vi.fn<AuthPort["execute"]>(async (action) => {
      if (action.type !== "sign-in") throw new Error("unexpected-action");
      if (execute.mock.calls.length === 1) return first.promise;
      account.emit(member);
      return { status: "authenticated" as const, user: member.user };
    });
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.test");
      setInputValue('input[type="password"]', "synthetic-password12");
    });
    const form = container.querySelector("form")!;
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    const retainedWhilePending = container.querySelector("form") === form;
    const fieldsDisabled = [...container.querySelectorAll("input, button")].every(
      (element) => (element as HTMLInputElement | HTMLButtonElement).disabled,
    );
    await act(async () => first.reject(new Error("private-provider-detail")));
    expect(retainedWhilePending).toBe(true);
    expect(fieldsDisabled).toBe(true);
    expect(container.textContent).toMatch(/unavailable|did not finish|暂时不可用/i);
    expect(container.textContent).not.toContain("private-provider-detail");
    expect(identity.status()).toMatchObject({ kind: "anonymous", user: { id: "synthetic-guest" } });
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe(
      "learner@example.test",
    );
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
    await act(async () => setInputValue('input[type="password"]', "synthetic-password12"));
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(identity.status()).toMatchObject({
      kind: "signed_in",
      user: { id: "synthetic-member" },
    });
  });

  it("keeps the registration confirmation on the same form after the pending request", async () => {
    setActiveLocale("en");
    const registration = deferred<AuthResult>();
    const account = sharedAccount(null);
    account.execute = vi.fn(async () => registration.promise);
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    const register = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Register"),
    );
    if (!register) throw new Error("missing register mode");
    await act(async () => register.click());
    await act(async () => {
      setInputValue('input[type="email"]', "new-learner@example.test");
      setInputValue('input[type="password"]', "synthetic-password12");
    });
    const form = container.querySelector("form")!;
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    const retainedWhilePending = container.querySelector("form") === form;
    await act(async () => registration.resolve({ status: "confirmation-required" }));
    expect(retainedWhilePending).toBe(true);
    expect(container.textContent).toMatch(/confirmation email|确认邮箱/i);
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe(
      "new-learner@example.test",
    );
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
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

  it("uses link-email for the register action so the anonymous identity is retained", async () => {
    const guest = { user: { id: "synthetic-guest", email: null, is_anonymous: true } } as const;
    const account = sharedAccount(guest);
    const execute = vi.fn<AuthPort["execute"]>(async (action) => {
      if (action.type !== "link-email") throw new Error(`unexpected ${action.type}`);
      return { status: "confirmation-required", user: guest.user };
    });
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    const register = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("注册") || button.textContent?.includes("Register"),
    );
    if (!register) throw new Error("missing register mode");
    await act(async () => register.click());
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.com");
      setInputValue('input[type="password"]', "password12");
    });
    const submit = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.type === "submit",
    );
    if (!submit) throw new Error("missing account submit");
    await act(async () => submit.click());
    expect(execute).toHaveBeenCalledWith({
      type: "link-email",
      email: "learner@example.com",
      password: "password12",
    });
    expect(identity.status()).toMatchObject({ kind: "anonymous", user: { id: "synthetic-guest" } });
  });

  it("sends an email code without asking for a password", async () => {
    setActiveLocale("en");
    const account = sharedAccount(null);
    const execute = vi.fn<AuthPort["execute"]>(async () => ({ status: "email-requested" }));
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    const emailCode = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Email code"),
    );
    if (!emailCode) throw new Error("missing email code mode");
    await act(async () => emailCode.click());
    expect(container.querySelector('input[type="password"]')).toBeNull();
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.com");
    });
    const submit = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.type === "submit",
    );
    if (!submit) throw new Error("missing email code submit");
    await act(async () => submit.click());
    expect(execute).toHaveBeenCalledWith({
      type: "send-link",
      email: "learner@example.com",
      createAccount: false,
    });
    expect(container.textContent).toMatch(/Email request accepted|邮件请求已提交/i);
    expect(identity.status().kind).toBe("signed_out");
  });

  it("clears a one-time code after verification and does not persist it", async () => {
    setActiveLocale("en");
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(null);
    const execute = vi.fn<AuthPort["execute"]>(async (action) => {
      if (action.type === "verify-code") {
        account.emit(member);
        return { status: "authenticated", user: member.user };
      }
      return { status: "email-requested" };
    });
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    const emailCode = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Email code"),
    );
    await act(async () => emailCode!.click());
    const verify = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Enter code"),
    );
    await act(async () => verify!.click());
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.test");
      setInputValue('input[autocomplete="one-time-code"]', "123456");
    });
    const submit = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.type === "submit",
    );
    await act(async () => submit!.click());
    expect(execute).toHaveBeenCalledWith({
      type: "verify-code",
      email: "learner@example.test",
      token: "123456",
      purpose: "email",
    });
    expect(container.textContent).not.toContain("123456");
  });

  it("keeps onResult continuation when SIGNED_IN arrives before execute resolves", async () => {
    setActiveLocale("en");
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(null);
    const continued = deferred<void>();
    let sawFormAfterSignedIn = false;
    account.execute = vi.fn(async () => {
      account.emit(member);
      sawFormAfterSignedIn = container.querySelector("form") !== null;
      return { status: "authenticated" as const, user: member.user };
    });
    const identity = createIdentityPort(account);
    await act(async () =>
      root.render(
        <AccountPanel
          identity={identity}
          auth={account}
          onResult={async () => continued.promise}
        />,
      ),
    );
    openAccountForm();
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.test");
      setInputValue('input[type="password"]', "synthetic-password12");
    });
    const form = container.querySelector("form")!;
    const submit = act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    await act(async () => Promise.resolve());
    expect(container.querySelector("form")).toBe(form);
    continued.resolve();
    await submit;
    expect(sawFormAfterSignedIn).toBe(true);
    expect(identity.status()).toMatchObject({
      kind: "signed_in",
      user: { id: "synthetic-member" },
    });
  });

  it("keeps a rejected sign-out visible and permits a real retry", async () => {
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(member);
    const execute = vi
      .fn<AuthPort["execute"]>()
      .mockRejectedValueOnce(new AuthFlowError("unavailable"))
      .mockImplementation(async () => {
        account.emit(null);
        return { status: "signed-out" };
      });
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    const button = () =>
      container.querySelector<HTMLButtonElement>(".account-panel__signed-in button")!;
    await act(async () => button().click());
    expect(identity.status().kind).toBe("signed_in");
    expect(container.textContent).toMatch(/unavailable|暂时不可用|退出登录没有完成/i);
    expect(container.textContent).not.toContain("private-provider-detail");
    expect(button().disabled).toBe(false);
    await act(async () => button().click());
    expect(execute).toHaveBeenCalledTimes(2);
    expect(identity.status().kind).toBe("signed_out");
  });

  it("localizes a typed account failure without leaking raw provider text", async () => {
    setActiveLocale("en");
    const account = sharedAccount(null);
    const identity = createIdentityPort(account);
    const errorStatus = {
      kind: "error",
      code: "sign-in-failed",
      message: "internal-debug-body",
    } as const;
    identity.status = () => errorStatus;
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    expect(container.textContent).toContain("Sign-in did not finish");
    expect(container.textContent).not.toContain("internal-debug-body");
    expect(container.querySelector("input[type=password]")).not.toBeNull();
    expect(container.querySelector("details")?.open).toBe(true);
    expect(container.querySelector(".swimmer-auth")).not.toBeNull();
  });

  it("releases the held form after an email request so a later sign-in is visible", async () => {
    setActiveLocale("en");
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(null);
    account.execute = vi.fn(async () => ({ status: "email-requested" as const }));
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    openAccountForm();
    const emailCode = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Email code"),
    );
    await act(async () => emailCode!.click());
    await act(async () => setInputValue('input[type="email"]', "learner@example.test"));
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe(
      "learner@example.test",
    );
    expect(container.textContent).toMatch(/Email request accepted/i);
    await act(async () => account.emit(member));
    expect(container.querySelector(".account-panel__signed-in")?.textContent).toContain(
      "learner@example.test",
    );
  });

  it("does not reclassify successful auth when the product onResult fails", async () => {
    setActiveLocale("en");
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(null);
    account.execute = vi.fn(async () => {
      account.emit(member);
      return { status: "authenticated" as const, user: member.user };
    });
    const identity = createIdentityPort(account);
    await act(async () =>
      root.render(
        <AccountPanel
          identity={identity}
          auth={account}
          onResult={async () => {
            throw new Error("navigation-failed");
          }}
        />,
      ),
    );
    openAccountForm();
    await act(async () => {
      setInputValue('input[type="email"]', "learner@example.test");
      setInputValue('input[type="password"]', "synthetic-password12");
    });
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(identity.status()).toMatchObject({
      kind: "signed_in",
      user: { id: "synthetic-member" },
    });
    expect(container.querySelector(".account-panel__signed-in")).not.toBeNull();
    expect(container.textContent).not.toMatch(/invalid-credentials|Sign-in did not finish/i);
  });

  it("asks for the current password on a signed-in change, not a recovery write", async () => {
    setActiveLocale("en");
    const member = {
      user: { id: "synthetic-member", email: "learner@example.test", is_anonymous: false },
    } as const;
    const account = sharedAccount(member);
    const execute = vi.fn<AuthPort["execute"]>(async () => ({ status: "updated" as const }));
    account.execute = execute;
    const identity = createIdentityPort(account);
    await act(async () => root.render(<AccountPanel identity={identity} auth={account} />));
    expect(container.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
    const fields = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(fields[0], "current-password12");
    fields[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(fields[1], "new-password12");
    fields[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(fields[2], "new-password12");
    fields[2]!.dispatchEvent(new Event("input", { bubbles: true }));
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(execute).toHaveBeenCalledWith({
      type: "update-password",
      password: "new-password12",
      currentPassword: "current-password12",
    });
  });
});
