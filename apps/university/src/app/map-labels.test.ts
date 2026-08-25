import { describe, expect, it } from "vitest";

import { studySub } from "./map-labels";

/**
 * The island label is the fourth place this product quoted its own size at a
 * learner. The first three were the top bar, the 「今天」 card and its mobile
 * twin, and each was fixed on its own. Pinning the rule here is cheaper than
 * finding the fifth.
 */
describe("studySub", () => {
  it("never quotes the lesson total", () => {
    for (const sub of [studySub(31, 0), studySub(31, 4), studySub(5, 0)]) {
      expect(sub).not.toMatch(/\d+\s*节/);
    }
  });

  it("offers scale to someone still choosing a world", () => {
    expect(studySub(31, 0)).toBe("31 门课");
    expect(studySub(5, 0)).toBe("5 门课");
  });

  it("switches to where you are the moment you are anywhere", () => {
    expect(studySub(31, 1)).toBe("已学 1 关");
    expect(studySub(31, 40)).toBe("已学 40 关");
  });
});
