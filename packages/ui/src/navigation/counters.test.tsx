// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { universityCounters } from "./counters.js";

/**
 * The row drifted once already: the delivery shell dropped two counters that
 * counted nothing, and the authoring shell — holding its own copy — kept
 * rendering them. These assertions are about the product decision, not the
 * markup, so they belong next to the one implementation of it.
 */
describe("universityCounters", () => {
  it("never renders a counter for a system that does not exist", () => {
    const ids = universityCounters({ projectName: "TuringPact", streakDays: 3 }).map((c) => c.id);
    expect(ids).not.toContain("credit");
    expect(ids).not.toContain("energy");
  });

  it("names the project instead of only drawing its icon", () => {
    const [island] = universityCounters({ projectName: "TuringPact", streakDays: 3 });
    expect(island?.value).toBe("TuringPact");
  });

  it("omits the streak entirely when the shell has no streak to report", () => {
    const ids = universityCounters({ projectName: "TuringPact", streakDays: null }).map(
      (c) => c.id,
    );
    expect(ids).toEqual(["island"]);
  });

  it("keeps a real zero streak, greyed, because zero days is a true fact", () => {
    const streak = universityCounters({ projectName: "TuringPact", streakDays: 0 }).find(
      (c) => c.id === "streak",
    );
    expect(streak?.value).toBe("0");
    expect(streak?.muted).toBe(true);
  });

  it("stops greying the streak once it is running", () => {
    const streak = universityCounters({ projectName: "TuringPact", streakDays: 7 }).find(
      (c) => c.id === "streak",
    );
    expect(streak?.muted).toBe(false);
  });
});
