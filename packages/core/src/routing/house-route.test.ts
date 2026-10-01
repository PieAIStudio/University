import { describe, expect, it } from "vitest";
import { fromPath, toPath } from "./view.js";

describe("the house route", () => {
  it("has its own address and keeps the old wardrobe address arriving there", () => {
    expect(toPath({ kind: "house" })).toBe("/house");
    expect(fromPath("/house")).toEqual({ kind: "house" });
    // The wardrobe merged into the house (Owner H2, 2026-10-01).
    expect(fromPath("/wardrobe")).toEqual({ kind: "house" });
  });
});
