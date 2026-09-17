// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthFlowError,
  type AuthEvent,
  type AuthPort,
  type AuthSession,
  type AuthUser,
} from "@pieaistudio/swimmer-auth-kit";
import { setActiveLocale } from "../../i18n/index.js";

import { AuthCallbackScreen, AuthResetScreen, clearConsumedAuthParams } from "./AuthHandoff.js";

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
  history.replaceState(null, "", "/auth/callback");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  setActiveLocale("en");
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  history.replaceState(null, "", "/");
});

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

type Harness = AuthPort & {
  emit(session: AuthSession, event: AuthEvent): void;
  setCurrentUser(user: AuthUser | null | Promise<AuthUser | null>): void;
  failCurrentUser(error?: unknown): void;
};

function harness(initial: AuthSession): Harness {
  let session = initial;
  let current: AuthUser | null | Promise<AuthUser | null> = initial?.user ?? null;
  const listeners = new Set<(session: AuthSession, event: AuthEvent) => void>();
  return {
    getSession: async () => session,
    getCurrentUser: async () => current,
    onAuthStateChange: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe() {
          listeners.delete(listener);
        },
      };
    },
    execute: async () => ({ status: "email-requested" }),
    emit(next, event) {
      session = next;
      for (const listener of listeners) listener(next, event);
    },
    setCurrentUser(user) {
      current = user;
    },
    failCurrentUser(error = new AuthFlowError("unavailable")) {
      current = Promise.reject(error);
    },
  };
}

const member: AuthUser = {
  id: "synthetic-member",
  email: "learner@example.test",
  is_anonymous: false,
};
const other: AuthUser = {
  id: "synthetic-other",
  email: "other@example.test",
  is_anonymous: false,
};
const guest: AuthUser = { id: "synthetic-guest", email: null, is_anonymous: true };

describe("AuthCallbackScreen", () => {
  it("does not treat an SDK event as authenticated without getCurrentUser", async () => {
    const account = harness(null);
    const pending = deferred<AuthUser | null>();
    account.setCurrentUser(pending.promise);
    await act(async () =>
      root.render(<AuthCallbackScreen auth={account} locale="en" onContinue={() => undefined} />),
    );
    await act(async () => account.emit({ user: member }, "SIGNED_IN"));
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(container.textContent).not.toContain("Continue learning");
    pending.resolve(null);
    await flush();
    expect(container.textContent).toMatch(/invalid or has expired/i);
    expect(container.querySelector(".swimmer-auth")).not.toBeNull();
  });

  it("shows continue learning only after a verified registered user", async () => {
    const account = harness({ user: member });
    await act(async () =>
      root.render(<AuthCallbackScreen auth={account} locale="en" onContinue={() => undefined} />),
    );
    await flush();
    expect(container.textContent).toMatch(/Continue learning/i);
    expect(container.querySelector(".swimmer-auth")).toBeNull();
  });

  it("clears a successful callback view on logout", async () => {
    const account = harness({ user: member });
    await act(async () =>
      root.render(<AuthCallbackScreen auth={account} locale="en" onContinue={() => undefined} />),
    );
    await flush();
    expect(container.textContent).toMatch(/Continue learning/i);
    await act(async () => account.emit(null, "SIGNED_OUT"));
    await flush();
    expect(container.textContent).toMatch(/invalid or has expired/i);
    expect(container.textContent).not.toMatch(/Continue learning/i);
  });

  it("does not grant authority from query or hash flags", async () => {
    history.replaceState(
      null,
      "",
      "/auth/callback?code=not-authorization#access_token=test-only&type=magiclink",
    );
    const account = harness(null);
    await act(async () =>
      root.render(<AuthCallbackScreen auth={account} locale="en" onContinue={() => undefined} />),
    );
    await flush();
    expect(container.textContent).toMatch(/invalid or has expired/i);
    expect(container.textContent).not.toMatch(/Continue learning/i);
  });
});

describe("AuthResetScreen", () => {
  it("does not show a password form from recovery query flags or an earlier anonymous session", async () => {
    history.replaceState(null, "", "/auth/reset?type=recovery");
    const account = harness({ user: guest });
    await act(async () =>
      root.render(<AuthResetScreen auth={account} locale="en" onUpdated={() => undefined} />),
    );
    await flush();
    expect(container.textContent).toMatch(/invalid or has expired/i);
    expect(container.querySelector('input[autocomplete="new-password"]')).toBeNull();
    expect(container.querySelector('input[autocomplete="current-password"]')).toBeNull();
    expect(container.textContent).toMatch(/Reset password|Send recovery email/i);
  });

  it("shows recovery password fields only for a verified registered user", async () => {
    const account = harness({ user: member });
    const execute = vi.fn<AuthPort["execute"]>(async () => ({ status: "updated" as const }));
    account.execute = execute;
    await act(async () =>
      root.render(<AuthResetScreen auth={account} locale="en" onUpdated={() => undefined} />),
    );
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
    expect(container.querySelector('input[autocomplete="current-password"]')).toBeNull();
    const password = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(password[0], "new-password12");
    password[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(password[1], "new-password12");
    password[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(execute).toHaveBeenCalledWith({ type: "update-password", password: "new-password12" });
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("currentPassword");
  });

  it("clears a password-ready recovery state after logout or a different identity", async () => {
    const account = harness({ user: member });
    await act(async () =>
      root.render(<AuthResetScreen auth={account} locale="en" onUpdated={() => undefined} />),
    );
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
    await act(async () => account.emit(null, "SIGNED_OUT"));
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).toBeNull();
    expect(container.textContent).toMatch(/invalid or has expired/i);

    account.setCurrentUser(member);
    await act(async () => account.emit({ user: member }, "SIGNED_IN"));
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
    account.setCurrentUser(null);
    await act(async () => account.emit({ user: other }, "SIGNED_IN"));
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).toBeNull();
  });

  it("may retain the same registered user through an offline verifier error", async () => {
    const account = harness({ user: member });
    await act(async () =>
      root.render(<AuthResetScreen auth={account} locale="en" onUpdated={() => undefined} />),
    );
    await flush();
    account.failCurrentUser();
    await act(async () => account.emit({ user: member }, "TOKEN_REFRESHED"));
    await flush();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
  });
});

describe("clearConsumedAuthParams", () => {
  it("keeps the language query and drops auth tokens", () => {
    history.replaceState(
      null,
      "",
      "/auth/callback?lang=en&code=test-only#access_token=test-only&type=magiclink",
    );
    clearConsumedAuthParams();
    expect(location.pathname).toBe("/auth/callback");
    expect(location.search).toBe("?lang=en");
    expect(location.hash).toBe("");
  });
});
