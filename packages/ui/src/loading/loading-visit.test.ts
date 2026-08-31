import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOADING_INTRO_SEEN_KEY,
  markLoadingIntroSeen,
  readLoadingVisit,
  resetLoadingVisitForTests,
  type LoadingStorage,
} from "./loading-visit.js";

function memoryStorage(initial: Record<string, string> = {}): LoadingStorage {
  const store = { ...initial };
  return {
    getItem(key) {
      return store[key] ?? null;
    },
    setItem(key, value) {
      store[key] = value;
    },
  };
}

function throwingStorage(method: "getItem" | "setItem"): LoadingStorage {
  return {
    getItem() {
      if (method === "getItem") throw new Error("blocked");
      return null;
    },
    setItem() {
      if (method === "setItem") throw new Error("blocked");
    },
  };
}

beforeEach(() => {
  resetLoadingVisitForTests();
});

afterEach(() => {
  resetLoadingVisitForTests();
});

describe("readLoadingVisit", () => {
  it("treats a missing store as a first visit", () => {
    expect(readLoadingVisit(null)).toBe("first");
  });

  it("treats a store that throws on read as a first visit", () => {
    expect(readLoadingVisit(throwingStorage("getItem"))).toBe("first");
  });

  it("treats an empty store as a first visit", () => {
    expect(readLoadingVisit(memoryStorage())).toBe("first");
  });

  it("treats a written mark as a returning visit", () => {
    expect(readLoadingVisit(memoryStorage({ [LOADING_INTRO_SEEN_KEY]: "1" }))).toBe("returning");
  });

  it("keeps the first decision for the rest of the session", () => {
    const storage = memoryStorage();
    expect(readLoadingVisit(storage)).toBe("first");
    markLoadingIntroSeen(storage);
    expect(readLoadingVisit(storage)).toBe("first");
  });
});

describe("markLoadingIntroSeen", () => {
  it("writes a mark a later session can read", () => {
    const storage = memoryStorage();
    markLoadingIntroSeen(storage);
    resetLoadingVisitForTests();
    expect(readLoadingVisit(storage)).toBe("returning");
  });

  it("does not throw when the store refuses the write", () => {
    expect(() => markLoadingIntroSeen(throwingStorage("setItem"))).not.toThrow();
    expect(() => markLoadingIntroSeen(null)).not.toThrow();
  });
});
