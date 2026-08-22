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
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
    };
    const port = createIdentityPort(auth);
    await Promise.resolve();
    await Promise.resolve();
    expect(port.status().kind).toBe("signed_out");
    expect(getSession).toHaveBeenCalledTimes(1);
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
});
