import { describe, expect, it } from "vitest";
import { emptyProgress, parseProgress } from "../progress/document.js";
import { createMemoryPresencePort } from "./presence.js";

describe("presence consent", () => {
  it("V1 new and legacy implicit defaults do not share learning activity", () => {
    expect(emptyProgress().account.preferences.sharesPresence).toBe(false);
    const legacy = emptyProgress();
    const recovered = parseProgress(
      JSON.stringify({
        ...legacy,
        account: {
          ...legacy.account,
          preferences: { ...legacy.account.preferences, sharesPresence: true, updatedAt: {} },
        },
      }),
    );
    expect(recovered.account.preferences.sharesPresence).toBe(false);
    expect(createMemoryPresencePort().snapshot().sharesPresence).toBe(false);
  });
  it("V2 a timestamped explicit sharing choice is preserved", () => {
    const original = emptyProgress();
    const recovered = parseProgress(
      JSON.stringify({
        ...original,
        account: {
          ...original.account,
          preferences: {
            ...original.account.preferences,
            sharesPresence: true,
            updatedAt: { sharesPresence: "2026-09-09T00:00:00.000Z" },
          },
        },
      }),
    );
    expect(recovered.account.preferences.sharesPresence).toBe(true);
  });
});
