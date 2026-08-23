import { describe, expect, it } from "vitest";

import { spacedName } from "./spaced-name.js";

describe("spacedName", () => {
  it("puts a space around a Latin name", () => {
    expect(`回到${spacedName("TuringPact")}地图`).toBe("回到 TuringPact 地图");
  });

  it("puts none around a Chinese one", () => {
    expect(`回到${spacedName("通用课")}地图`).toBe("回到通用课地图");
  });

  /*
    The case that made this a function rather than a conditional: 「UniversityLocal
    自身」 starts Latin and ends Han, so the two sides disagree.
  */
  it("decides each side on its own", () => {
    expect(`回到${spacedName("UniversityLocal 自身")}地图`).toBe("回到 UniversityLocal 自身地图");
  });

  it("survives an empty name without inventing a gap on one side only", () => {
    expect(spacedName("")).toBe("  ");
  });
});
