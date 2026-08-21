// @vitest-environment jsdom

import { EMPTY_FAVOURITES } from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAVOURITES_STORAGE_KEY,
  createLocalFavouritesStore,
  readLocalFavourites,
  writeLocalFavourites,
} from "./storage.js";

const T1 = "2026-08-21T10:00:00.000Z";
const SAMPLE = {
  version: 1,
  items: [{ senseId: "app.program", createdAt: T1, updatedAt: T1 }],
} as const;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("local favourites store", () => {
  it("round-trips a document through the read/write interface", () => {
    const store = createLocalFavouritesStore();
    store.write(SAMPLE);
    expect(store.read()).toEqual(SAMPLE);
  });

  it("keeps the version inside the JSON, not in the key", () => {
    writeLocalFavourites(SAMPLE);
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toContain('"version":1');
    expect(FAVOURITES_STORAGE_KEY).toBe("university.favourites");
    expect(FAVOURITES_STORAGE_KEY.includes("v1")).toBe(false);
  });

  it("starts empty when nothing is stored", () => {
    expect(readLocalFavourites()).toEqual(EMPTY_FAVOURITES);
  });

  it("survives corrupt storage rather than taking the star down", () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, "{not json");
    expect(readLocalFavourites()).toEqual(EMPTY_FAVOURITES);
  });

  it("ignores a document it cannot read instead of inventing rows", () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify({ items: ["app.program"] }));
    expect(readLocalFavourites()).toEqual(EMPTY_FAVOURITES);
  });

  it("returns empty when the browser refuses to read storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readLocalFavourites()).toEqual(EMPTY_FAVOURITES);
  });

  it("swallows a write failure so a blocked store does not throw into a click", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => writeLocalFavourites(SAMPLE)).not.toThrow();
  });
});
