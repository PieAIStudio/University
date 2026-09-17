// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryIdentityPort } from "@pieai/university-core";
import type { AuthPort } from "@pieaistudio/swimmer-auth-kit";
import { setActiveLocale } from "../../i18n/index.js";
import { AccountClosurePanel } from "./AccountClosurePanel.js";

let root: Root;
let container: HTMLDivElement;
const user = {
  id: "f6884e06-273b-4a83-a55a-e88bfa45f0ce",
  email: "synthetic@example.test",
  is_anonymous: false,
};
beforeEach(() => {
  setActiveLocale("en");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute("open");
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function button(text: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === text,
  );
  if (!found) throw new Error(`No button: ${text}`);
  return found;
}
function fill(selector: string, value: string) {
  const input = document.body.querySelector<HTMLInputElement>(selector)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
async function setup(result: "review-required" = "review-required") {
  const identity = createMemoryIdentityPort(user);
  const onDeleted = vi.fn(async () => {});
  const request = vi.fn(async (_expected: string, id: string) => ({
    status: result,
    operationId: id,
  }));
  const auth: AuthPort = {
    getCurrentUser: vi.fn(async () => user),
    getSession: async () => ({ user }),
    execute: vi.fn(async () => ({ status: "authenticated", user }) as const),
    onAuthStateChange: () => ({ unsubscribe() {} }),
  };
  await act(async () =>
    root.render(
      <AccountClosurePanel
        identity={identity}
        auth={auth}
        confirmationPhrase="REQUEST ACCOUNT DELETION"
        requestClosure={request}
      />,
    ),
  );
  await act(async () => button("Request account deletion").click());
  return { identity, auth, onDeleted, request };
}
async function verify() {
  await act(async () => {
    fill('.swimmer-auth input[type="email"]', user.email);
    fill('.swimmer-auth input[type="password"]', "synthetic-password12");
  });
  await act(async () =>
    document.body
      .querySelector(".swimmer-auth form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("account deletion confirmation", () => {
  it("cancel does not authenticate or send a destructive request", async () => {
    const { auth, request } = await setup();
    await act(async () => button("Cancel").click());
    expect(auth.execute).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it("requires shared reauthentication and the full confirmation, then sends one owner-bound request", async () => {
    const { request, onDeleted } = await setup();
    expect(document.body.textContent).not.toContain("Submit deletion request");
    await verify();
    expect(button("Submit deletion request").disabled).toBe(true);
    await act(async () => fill('input[autocomplete="off"]', "REQUEST ACCOUNT DELETION"));
    await act(async () => {
      const form = document.body.querySelector("dialog form")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe(user.id);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Your deletion request is recorded");
  });
  it("does not clear account data when the server records a review request", async () => {
    const { onDeleted } = await setup("review-required");
    await verify();
    await act(async () => fill('input[autocomplete="off"]', "REQUEST ACCOUNT DELETION"));
    await act(async () => button("Submit deletion request").click());
    expect(document.body.textContent).toContain("have not been deleted");
    expect(onDeleted).not.toHaveBeenCalled();
  });
  it("a different verified account never inherits the previous account's confirmation", async () => {
    const { auth, request } = await setup();
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ ...user, id: "another-person" });
    await verify();
    expect(document.body.textContent).toContain("The account changed");
    expect(document.body.querySelector('input[autocomplete="off"]')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
  it("signing out before confirmation prevents the request", async () => {
    const { identity, request } = await setup();
    await verify();
    await act(async () => identity.signOut());
    expect(document.body.textContent).toContain("The account changed");
    expect(request).not.toHaveBeenCalled();
  });
});
