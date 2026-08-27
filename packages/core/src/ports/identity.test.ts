import { describe, expect, it, vi } from "vitest";

import { createIdentityPort, createMemoryIdentityPort, type IdentityAuth } from "./identity.js";

describe("createIdentityPort", () => {
  it("treats a missing auth client as unconfigured and never talks to the network", async () => {
    const port = createIdentityPort(null);
    expect(port.status()).toEqual({ kind: "unconfigured" });
    await port.signInWithEmail("ada@example.com", "password12");
    await port.signUpWithEmail("ada@example.com", "password12");
    await port.signOut();
    expect(await port.readAccessToken()).toBeNull();
    expect(port.status()).toEqual({ kind: "unconfigured" });
  });

  it("hydrates a stored session without turning a getSession failure into a wall", async () => {
    const getSession = vi.fn().mockRejectedValue(new Error("network"));
    const auth: IdentityAuth = {
      getSession,
      getAccessToken: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail: vi.fn(),
      signOut: vi.fn(),
    };
    const port = createIdentityPort(auth);
    await Promise.resolve();
    await Promise.resolve();
    expect(port.status().kind).toBe("signed_out");
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("keeps an anonymous session distinct from a formal signed-in session", async () => {
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "anonymous-user", email: null, is_anonymous: true },
      }),
      getAccessToken: vi.fn().mockResolvedValue("anonymous-token"),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail: vi.fn(),
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await vi.waitFor(() => {
      expect(port.status()).toEqual({
        kind: "anonymous",
        user: { id: "anonymous-user", email: null },
      });
    });
  });

  it("silently ignores an anonymous sign-in failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const signInAnonymously = vi.fn().mockRejectedValue(new Error("captcha unavailable"));
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue(null),
      getAccessToken: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail: vi.fn(),
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await port.signInAnonymously();

    expect(signInAnonymously).toHaveBeenCalledWith(undefined);
    expect(port.status()).toEqual({ kind: "signed_out" });
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("requests a magic link with the product redirect and stays signed out", async () => {
    const requestMagicLink = vi.fn().mockResolvedValue(undefined);
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue(null),
      getAccessToken: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink,
      linkEmail: vi.fn(),
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await port.requestMagicLink("ada@example.com", "https://university.pieaistudio.com");

    expect(requestMagicLink).toHaveBeenCalledWith(
      "ada@example.com",
      "https://university.pieaistudio.com",
    );
    expect(port.status()).toEqual({ kind: "signed_out" });
  });

  it("does not let an anonymous learner switch to a magic link", async () => {
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "anonymous-user", email: null, is_anonymous: true },
      }),
      getAccessToken: vi.fn().mockResolvedValue("anonymous-token"),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail: vi.fn(),
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await vi.waitFor(() => expect(port.status().kind).toBe("anonymous"));

    await expect(
      port.requestMagicLink("ada@example.com", "https://university.pieaistudio.com"),
    ).rejects.toThrow("匿名学习会话请用邮箱和密码绑定");
    expect(auth.requestMagicLink).not.toHaveBeenCalled();
  });

  it("links the email without changing the anonymous user id", async () => {
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue(null),
      getAccessToken: vi.fn().mockResolvedValue("token"),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn().mockResolvedValue({
        user: { id: "same-user", email: null, is_anonymous: true },
      }),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail: vi.fn().mockResolvedValue({
        user: { id: "same-user", email: "learner@example.com", is_anonymous: false },
      }),
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    await port.linkEmail("learner@example.com", "password12");

    expect(port.status()).toEqual({
      kind: "signed_in",
      user: { id: "same-user", email: "learner@example.com" },
    });
  });

  it("keeps the anonymous session after a taken email, so login can switch to the existing user", async () => {
    const linkEmail = vi.fn().mockRejectedValue(new Error("email already registered"));
    const signInWithEmail = vi.fn().mockResolvedValue({
      user: { id: "existing-user", email: "learner@example.com", is_anonymous: false },
    });
    const auth: IdentityAuth = {
      getSession: vi.fn().mockResolvedValue(null),
      getAccessToken: vi.fn().mockResolvedValue("token"),
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe() {} }),
      signInAnonymously: vi.fn().mockResolvedValue({
        user: { id: "anonymous-user", email: null, is_anonymous: true },
      }),
      signInWithEmail,
      signUpWithEmail: vi.fn(),
      requestMagicLink: vi.fn(),
      linkEmail,
      signOut: vi.fn(),
    };

    const port = createIdentityPort(auth);
    await port.signInAnonymously();
    await expect(port.linkEmail("learner@example.com", "password12")).rejects.toThrow(
      "email already registered",
    );
    expect(port.status().kind).toBe("anonymous");

    await port.signInWithEmail("learner@example.com", "password12");

    expect(signInWithEmail).toHaveBeenCalledWith("learner@example.com", "password12");
    expect(port.status()).toEqual({
      kind: "signed_in",
      user: { id: "existing-user", email: "learner@example.com" },
    });
  });
});

describe("createMemoryIdentityPort", () => {
  it("signs in and out without a backend", async () => {
    const port = createMemoryIdentityPort();
    expect(port.status().kind).toBe("signed_out");
    await port.signInWithEmail("ada@example.com", "password12");
    const signedIn = port.status();
    expect(signedIn).toEqual({
      kind: "signed_in",
      user: { id: "memory:ada@example.com", email: "ada@example.com" },
    });
    expect(await port.readAccessToken()).toBe("memory-token:memory:ada@example.com");
    await port.signOut();
    expect(port.status().kind).toBe("signed_out");
    expect(await port.readAccessToken()).toBeNull();
  });

  it("creates an anonymous user and preserves its id when linking an email", async () => {
    const port = createMemoryIdentityPort();

    await port.signInAnonymously();
    const anonymous = port.status();
    expect(anonymous).toEqual({
      kind: "anonymous",
      user: { id: "memory:anonymous", email: null },
    });

    await port.linkEmail("ada@example.com", "password12");

    expect(port.status()).toEqual({
      kind: "signed_in",
      user: { id: "memory:anonymous", email: "ada@example.com" },
    });
  });
});
