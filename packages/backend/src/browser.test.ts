/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { browserAuthOrigin, createUniversityBackend, universityAuthRedirects } from "./browser.js";

function withLocationOrigin<T>(origin: string, run: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin },
  });
  try {
    return run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else delete (globalThis as { location?: unknown }).location;
  }
}

afterEach(() => {
  delete (globalThis as { location?: unknown }).location;
});

describe("University browser account assembly", () => {
  it("does not construct a second auth controller from createAuthClient", () => {
    const source = readFileSync(fileURLToPath(new URL("./browser.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/createAuthClient/);
    expect(source).not.toMatch(/as IdentityAuth/);
    expect(source).toMatch(/createSupabaseAuth/);
    expect(source).toMatch(/authRedirect/);
    expect(source).toMatch(/\/auth\/callback/);
    expect(source).toMatch(/\/auth\/reset/);
  });

  it("exposes the kit AuthPort beside the existing identity port when configured", () => {
    const backend = createUniversityBackend({
      VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://example.supabase.co",
      VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(backend.identityPort.status().kind).not.toBe("unconfigured");
    expect(backend.authPort).not.toBeNull();
    expect(typeof backend.authPort?.execute).toBe("function");
    expect(typeof backend.authPort?.getCurrentUser).toBe("function");
    expect(typeof backend.authPort?.signInWithEmail).toBe("function");
  });

  it("keeps the unconfigured local path when public env is missing", () => {
    const backend = createUniversityBackend({});
    expect(backend.client).toBeNull();
    expect(backend.authPort).toBeNull();
    expect(backend.identityPort.status().kind).toBe("unconfigured");
  });

  it("keeps HTTPS and loopback origins and does not rewrite a public HTTP LAN origin", () => {
    expect(browserAuthOrigin()).toBe("http://127.0.0.1");
    expect(universityAuthRedirects("https://learn.example")).toEqual({
      redirectTo: "https://learn.example/auth/callback",
      recoveryRedirectTo: "https://learn.example/auth/reset",
    });
    expect(universityAuthRedirects("http://127.0.0.1:5173")).toEqual({
      redirectTo: "http://127.0.0.1:5173/auth/callback",
      recoveryRedirectTo: "http://127.0.0.1:5173/auth/reset",
    });
    expect(universityAuthRedirects("http://192.168.4.12:5173")).toBeNull();
    expect(withLocationOrigin("http://192.168.4.12:5173", () => browserAuthOrigin())).toBe(
      "http://192.168.4.12:5173",
    );
  });

  it("does not present working email auth for a public HTTP LAN preview", () => {
    const backend = withLocationOrigin("http://192.168.4.12:5173", () =>
      createUniversityBackend({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    );
    expect(backend.client).not.toBeNull();
    expect(backend.authPort).toBeNull();
    expect(backend.identityPort.status().kind).toBe("unconfigured");
  });
});
