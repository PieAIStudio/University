import { describe, expect, it, vi } from "vitest";
import {
  createIdentityPort,
  IdentityOperationError,
  type IdentityAuth,
  type IdentityAuthSession,
} from "./identity.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function authFixture() {
  let event: (session: IdentityAuthSession | null) => void = () => {};
  const auth: IdentityAuth = {
    getSession: vi.fn().mockResolvedValue(null),
    getAccessToken: vi.fn().mockResolvedValue("token"),
    onAuthStateChange: (listener) => {
      event = listener;
      return { unsubscribe() {} };
    },
    signInAnonymously: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    requestMagicLink: vi.fn(),
    linkEmail: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  return { auth, emit: (session: IdentityAuthSession | null) => event(session) };
}
const alice = { user: { id: "alice", email: "alice@example.test" } };
const bob = { user: { id: "bob", email: "bob@example.test" } };

describe("identity response ordering and truthful sign-out", () => {
  it("does not restore a startup session after an explicit sign-out", async () => {
    const initial = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.getSession).mockReturnValue(initial.promise);
    const port = createIdentityPort(auth);
    await port.signOut();
    initial.resolve(alice);
    await initial.promise;
    await Promise.resolve();
    expect(port.status()).toEqual({ kind: "signed_out" });
  });
  it("does not overwrite a newer auth event with initial hydration", async () => {
    const initial = deferred<IdentityAuthSession | null>();
    const { auth, emit } = authFixture();
    vi.mocked(auth.getSession).mockReturnValue(initial.promise);
    const port = createIdentityPort(auth);
    emit(bob);
    initial.resolve(alice);
    await initial.promise;
    await Promise.resolve();
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });
  it("keeps the later explicit login when an earlier response arrives last", async () => {
    const first = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.signInWithEmail).mockReturnValueOnce(first.promise).mockResolvedValueOnce(bob);
    const port = createIdentityPort(auth);
    const old = port.signInWithEmail("alice@example.test", "example-password");
    await port.signInWithEmail("bob@example.test", "example-password");
    first.resolve(alice);
    await old;
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });
  it("does not let a background guest response replace a formal account", async () => {
    const guest = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockReturnValue(guest.promise);
    vi.mocked(auth.signInWithEmail).mockResolvedValue(bob);
    const port = createIdentityPort(auth);
    const old = port.signInAnonymously();
    await port.signInWithEmail("bob@example.test", "example-password");
    guest.resolve({ user: { id: "guest", is_anonymous: true } });
    await old;
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });
  it("reports an unsuccessful SDK sign-out instead of pretending the session is gone", async () => {
    const { auth } = authFixture();
    vi.mocked(auth.getSession).mockResolvedValue(alice);
    vi.mocked(auth.signOut).mockRejectedValue(new Error("provider not reachable"));
    const port = createIdentityPort(auth);
    await vi.waitFor(() => expect(port.status().kind).toBe("signed_in"));
    await expect(port.signOut()).rejects.toThrow();
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "alice" } });
  });
  it("does not return a provider token when the visible identity is signed out", async () => {
    const { auth } = authFixture();
    const port = createIdentityPort(auth);
    await Promise.resolve();
    expect(await port.readAccessToken()).toBeNull();
    expect(auth.getAccessToken).not.toHaveBeenCalled();
  });
  it("drops a token that resolves after the identity has changed", async () => {
    const token = deferred<string | null>();
    const { auth, emit } = authFixture();
    vi.mocked(auth.getAccessToken).mockReturnValue(token.promise);
    const port = createIdentityPort(auth);
    emit(alice);
    const request = port.readAccessToken();
    emit(bob);
    token.resolve("earlier-account-token");
    expect(await request).toBeNull();
  });
  it("does not start an anonymous request during an explicit login", async () => {
    const login = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.signInWithEmail).mockReturnValue(login.promise);
    const port = createIdentityPort(auth);
    const request = port.signInWithEmail("bob@example.test", "example-password");
    await port.signInAnonymously();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    login.resolve(bob);
    await request;
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });
});

const guestSession = { user: { id: "guest", email: null, is_anonymous: true } };
const providerLeak = new Error(
  "AuthApiError: Invalid login credentials for existing@example.test token=guest-token-leak",
);

function expectSafeSignInFailure(error: unknown) {
  expect(error).toBeInstanceOf(IdentityOperationError);
  expect(error).toMatchObject({ name: "IdentityOperationError", code: "sign-in-failed" });
  const typed = error as IdentityOperationError;
  expect(typed.message).toBe("登录没有完成，请核对输入或网络后重试。");
  expect(`${typed.message}\n${typed.stack ?? ""}`).not.toMatch(
    /AuthApiError|existing@example\.test|guest-token-leak|provider-secret/i,
  );
  expect((typed as { cause?: unknown }).cause).toBeUndefined();
}

describe("identity guest sign-in failure", () => {
  it("does not trust a provider's typed error message as safe product copy", async () => {
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockRejectedValue(
      new IdentityOperationError("sign-in-failed", "provider-secret for existing@example.test"),
    );
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const error = await port.signInWithEmail("existing@example.test", "example-password").then(
      () => null,
      (reason: unknown) => reason,
    );
    expectSafeSignInFailure(error);
    expect(port.status()).toMatchObject({ kind: "anonymous", user: { id: "guest" } });
  });

  it("ignores a superseded typed failure just like any other provider failure", async () => {
    const first = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockReturnValueOnce(first.promise).mockResolvedValueOnce(bob);
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const stale = port.signInWithEmail("existing@example.test", "example-password");
    await port.signInWithEmail("bob@example.test", "example-password");
    first.reject(new IdentityOperationError("sign-in-failed", "provider-secret"));
    await expect(stale).resolves.toBeUndefined();
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });

  it("rejects a current guest-to-existing login with sign-in-failed and keeps the guest id", async () => {
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockRejectedValue(providerLeak);
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const error = await port.signInWithEmail("existing@example.test", "example-password").then(
      () => null,
      (reason: unknown) => reason,
    );
    expectSafeSignInFailure(error);
    expect(port.status()).toEqual({ kind: "anonymous", user: { id: "guest", email: null } });
  });

  it("rejects a null unsuccessful guest sign-in instead of pretending success", async () => {
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockResolvedValue(null);
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const error = await port.signInWithEmail("existing@example.test", "example-password").then(
      () => null,
      (reason: unknown) => reason,
    );
    expectSafeSignInFailure(error);
    expect(port.status()).toEqual({ kind: "anonymous", user: { id: "guest", email: null } });
  });

  it("ignores a superseded sign-in rejection so it cannot paint a newer account", async () => {
    const first = deferred<IdentityAuthSession | null>();
    const { auth } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockReturnValueOnce(first.promise).mockResolvedValueOnce(bob);
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const stale = port.signInWithEmail("existing@example.test", "example-password");
    await port.signInWithEmail("bob@example.test", "example-password");
    first.reject(new Error("provider-secret for existing@example.test"));
    await expect(stale).resolves.toBeUndefined();
    expect(port.status()).toMatchObject({ kind: "signed_in", user: { id: "bob" } });
  });

  it("does not revive a guest UUID from a late null response after SIGNED_OUT", async () => {
    const login = deferred<IdentityAuthSession | null>();
    const { auth, emit } = authFixture();
    vi.mocked(auth.signInAnonymously).mockResolvedValue(guestSession);
    vi.mocked(auth.signInWithEmail).mockReturnValue(login.promise);
    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    const attempt = port.signInWithEmail("existing@example.test", "example-password");
    emit(null);
    expect(port.status()).toEqual({ kind: "signed_out" });
    login.resolve(null);
    await expect(attempt).resolves.toBeUndefined();
    expect(port.status()).toEqual({ kind: "signed_out" });
  });
});
