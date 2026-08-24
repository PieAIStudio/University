// @vitest-environment jsdom

import {
  lessonKey,
  createProgressPort,
  emptyProgress,
  PROGRESS_STORAGE_KEY,
} from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserPersistence } from "./browser-persistence.js";
import { createBrowserProgressPort } from "./store.js";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("createBrowserPersistence", () => {
  it("round-trips the raw document under the product key", () => {
    const persistence = createBrowserPersistence();
    persistence.write('{"lessons":{}}');
    expect(persistence.read()).toBe('{"lessons":{}}');
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe('{"lessons":{}}');
  });

  it("reads null when nothing is stored, rather than inventing a document", () => {
    expect(createBrowserPersistence().read()).toBeNull();
  });

  it("returns null when the browser refuses to read, so a blocked store is empty not a crash", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(createBrowserPersistence().read()).toBeNull();
  });

  it("swallows a write failure so a full quota does not throw into a lesson", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => createBrowserPersistence().write("{}")).not.toThrow();
  });
});

describe("createBrowserProgressPort", () => {
  it("is the Persistence adapter wired to the one port, not a second store", () => {
    const port = createBrowserProgressPort();
    // Through the key builder, not a hand-typed string: the document's key and
    // the shared four-segment key were interchangeable at call sites once, and
    // a test that types its own string is a test that cannot notice.
    const key = lessonKey("s", "c", "l");
    port.advanceLesson(key, 1);
    const again = createProgressPort({ persistence: createBrowserPersistence() });
    expect(again.lessonState(key).progress).toBe(1);
    expect(again.snapshot().lessons[key]?.progress).toBe(1);
    expect(port.snapshot()).not.toEqual(emptyProgress());
  });
});
