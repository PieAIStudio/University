import { describe, expect, it } from "vitest";

import { checkPublishedCatalogData } from "./check-published-catalog.mjs";

const record = {
  schemaVersion: 1,
  studies: { study: ["kept", "also-kept"] },
};

describe("published catalogue check", () => {
  it("accepts an export that still ships every published course", () => {
    expect(checkPublishedCatalogData(record, { study: ["kept", "also-kept"] })).toEqual({
      published: 2,
      added: [],
    });
  });

  it("accepts an export that adds a course, because publishing is gated elsewhere", () => {
    expect(checkPublishedCatalogData(record, { study: ["kept", "also-kept", "new"] })).toEqual({
      published: 2,
      added: ["study/new"],
    });
  });

  it("refuses an export that drops a published course, and names it", () => {
    expect(() => checkPublishedCatalogData(record, { study: ["kept"] })).toThrow(/study\/also-kept/);
  });

  it("refuses an export that drops a whole study rather than reporting it as unchanged", () => {
    expect(() => checkPublishedCatalogData(record, {})).toThrow(/2 course\(s\)/);
  });

  it("counts every dropped course, so a shrinking catalogue cannot look like one mistake", () => {
    expect(() => checkPublishedCatalogData(record, { study: [] })).toThrow(/2 course\(s\)/);
  });

  it("tells the reader how to record a removal they actually mean", () => {
    expect(() => checkPublishedCatalogData(record, { study: ["kept"] })).toThrow(
      /--accept-removals/,
    );
  });
});
