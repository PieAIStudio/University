import { describe, expect, it } from "vitest";
import { emptyProgress } from "@pieai/university-core";
import {
  isWelcomeEntry,
  readWelcomeAcknowledged,
  shouldShowWelcome,
  writeWelcomeAcknowledged,
} from "./welcome-policy.js";

describe("welcome entry policy", () => {
  it("W1 welcomes only a genuine new home visit, never a lesson, auth callback or diagnostic URL", () => {
    expect(isWelcomeEntry(new URL("https://example.test/"))).toBe(true);
    expect(isWelcomeEntry(new URL("https://example.test/#/"))).toBe(true);
    expect(isWelcomeEntry(new URL("https://example.test/?utm_source=friend"))).toBe(true);
    for (const path of [
      "/catalog",
      "/study/course/unit/lesson",
      "/?code=callback",
      "/?seed=course",
      "/#/me",
      "/#access_token=not-a-real-token",
    ]) {
      expect(isWelcomeEntry(new URL(path, "https://example.test"))).toBe(false);
    }
    const options = {
      entryEligible: true,
      acknowledged: false,
      identityKind: "signed_out" as const,
      progress: emptyProgress(),
    };
    expect(shouldShowWelcome(options)).toBe(true);
    expect(shouldShowWelcome({ ...options, acknowledged: true })).toBe(false);
    expect(shouldShowWelcome({ ...options, entryEligible: false })).toBe(false);
    for (const identityKind of ["pending", "anonymous", "signed_in"] as const) {
      expect(shouldShowWelcome({ ...options, identityKind })).toBe(false);
    }
    expect(shouldShowWelcome({ ...options, progress: { ...emptyProgress(), totalXp: 10 } })).toBe(
      false,
    );
    expect(
      shouldShowWelcome({
        ...options,
        progress: {
          ...emptyProgress(),
          lessons: {
            existing: { progress: 0, attempts: 0, completedAt: null, readConfirmed: true },
          },
        },
      }),
    ).toBe(false);
  });

  it("W2 stores only an acknowledgement and treats unavailable storage as non-fatal", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readWelcomeAcknowledged(storage)).toBe(false);
    expect(writeWelcomeAcknowledged(storage)).toBe(true);
    expect(readWelcomeAcknowledged(storage)).toBe(true);
    expect([...values.values()]).toEqual(["acknowledged"]);
    const denied = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
    };
    expect(readWelcomeAcknowledged(denied)).toBe(false);
    expect(writeWelcomeAcknowledged(denied)).toBe(false);
  });
});
