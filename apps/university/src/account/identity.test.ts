import { afterEach, describe, expect, it, vi } from "vitest";

import { createOnlineIdentityPort, readSwimmerBackendPublicEnv } from "./identity";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSwimmerBackendPublicEnv", () => {
  it("is silent and empty when the env is missing", () => {
    expect(readSwimmerBackendPublicEnv({})).toBeNull();
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toBeNull();
  });

  it("refuses a secret key rather than putting one in the browser client", () => {
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_secret_nope",
      }),
    ).toBeNull();
  });

  it("accepts the canonical env names with a publishable key", () => {
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("ignores the retired SwimmerCore env names", () => {
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://legacy.example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_legacy",
      }),
    ).toBeNull();
  });

  it("uses canonical names when unrelated old values are present", () => {
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://new.example.supabase.co",
        VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_new",
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://legacy.example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_legacy",
      }),
    ).toEqual({
      url: "https://new.example.supabase.co",
      publishableKey: "sb_publishable_new",
    });
  });

  it("does not complete a partial canonical pair with retired names", () => {
    expect(
      readSwimmerBackendPublicEnv({
        VITE_SWIMMER_BACKEND_SUPABASE_URL: "https://partial.example.supabase.co",
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://legacy.example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_legacy",
      }),
    ).toBeNull();
  });
});

describe("createOnlineIdentityPort", () => {
  it("does not construct a client or write to the console when env is missing", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const port = createOnlineIdentityPort({});
    expect(port.status().kind).toBe("unconfigured");
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
