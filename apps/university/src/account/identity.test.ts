import { afterEach, describe, expect, it, vi } from "vitest";

import { createOnlineIdentityPort, readSwimmerCorePublicEnv } from "./identity";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSwimmerCorePublicEnv", () => {
  it("is silent and empty when the env is missing", () => {
    expect(readSwimmerCorePublicEnv({})).toBeNull();
    expect(
      readSwimmerCorePublicEnv({
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
    expect(
      readSwimmerCorePublicEnv({
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toBeNull();
  });

  it("refuses a secret key rather than putting one in the browser client", () => {
    expect(
      readSwimmerCorePublicEnv({
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_secret_nope",
      }),
    ).toBeNull();
  });

  it("accepts the portfolio env names with a publishable key", () => {
    expect(
      readSwimmerCorePublicEnv({
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
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
