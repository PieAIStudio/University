// @vitest-environment jsdom

import { EMPTY_PRACTICE_RECENT } from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRACTICE_RECENT_STORAGE_KEY,
  createLocalPracticeRecentStore,
  readLocalPracticeRecent,
  writeLocalPracticeRecent,
} from "./storage.js";

const SAMPLE = {
  version: 1,
  ids: ["technical-app.program", "general-allow.permit"],
} as const;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("local practice-recent store", () => {
  it("round-trips a document through the read/write interface", () => {
    const store = createLocalPracticeRecentStore();
    store.write(SAMPLE);
    expect(store.read()).toEqual(SAMPLE);
  });

  it("keeps the version inside the JSON, not in the key", () => {
    writeLocalPracticeRecent(SAMPLE);
    expect(window.localStorage.getItem(PRACTICE_RECENT_STORAGE_KEY)).toContain('"version":1');
    expect(PRACTICE_RECENT_STORAGE_KEY).toBe("university.practice.recent");
    expect(PRACTICE_RECENT_STORAGE_KEY.includes("v1")).toBe(false);
  });

  it("starts empty when nothing is stored", () => {
    expect(readLocalPracticeRecent()).toEqual(EMPTY_PRACTICE_RECENT);
  });

  it("survives corrupt storage rather than taking the stream down", () => {
    window.localStorage.setItem(PRACTICE_RECENT_STORAGE_KEY, "{not json");
    expect(readLocalPracticeRecent()).toEqual(EMPTY_PRACTICE_RECENT);
  });

  it("ignores a document it cannot read instead of inventing ids", () => {
    window.localStorage.setItem(
      PRACTICE_RECENT_STORAGE_KEY,
      JSON.stringify({ ids: ["technical-app.program"] }),
    );
    expect(readLocalPracticeRecent()).toEqual(EMPTY_PRACTICE_RECENT);
  });

  it("returns empty when the browser refuses to read storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readLocalPracticeRecent()).toEqual(EMPTY_PRACTICE_RECENT);
  });

  it("swallows a write failure so a blocked store does not throw into a click", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => writeLocalPracticeRecent(SAMPLE)).not.toThrow();
  });
});
