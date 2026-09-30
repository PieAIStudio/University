import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACCOUNT_PREFERENCES,
  mergeAccountPreferences,
  parseAccountData,
} from "../ports/account-data.js";
import { hasBeenGuided, mergeGuidedHistory, parseGuidedHistory, recordGuided } from "./guided.js";

describe("guided history", () => {
  it("keeps well-formed guide ids once, sorted, and drops the rest", () => {
    expect(parseGuidedHistory(["game:links", "game:links", "step:sort", "bad id", 3])).toEqual([
      "game:links",
      "step:sort",
    ]);
    expect(parseGuidedHistory("game:links")).toBeUndefined();
  });

  it("merges two devices by union, so a guide is never shown twice", () => {
    expect(mergeGuidedHistory(["game:links"], ["step:sort"])).toEqual(["game:links", "step:sort"]);
    expect(mergeGuidedHistory(undefined, undefined)).toBeUndefined();
  });

  it("records a finished guide", () => {
    const history = recordGuided(undefined, "game:snake");
    expect(hasBeenGuided(history, "game:snake")).toBe(true);
    expect(hasBeenGuided(history, "game:moles")).toBe(false);
  });

  it("travels in the account document and survives a merge", () => {
    const on = (guided: string[]) =>
      parseAccountData({ preferences: { ...DEFAULT_ACCOUNT_PREFERENCES, guided } }).preferences;
    expect(on(["game:links"]).guided).toEqual(["game:links"]);
    expect(mergeAccountPreferences(on(["game:links"]), on(["game:snake"])).guided).toEqual([
      "game:links",
      "game:snake",
    ]);
  });
});
