import { describe, expect, it } from "vitest";
import { checkConnections, evaluateTuning, isValidSortActivity } from "@pieai/university-core";
import { getBaseExamples } from "./base-examples.js";
import { getSortExamples } from "./sort-examples.js";
import { getExampleFamily } from "./difficulty-examples.js";

describe("playground payloads are solvable", () => {
  it("has two distinct examples of each activity, with unique IDs", () => {
    const all = [...getBaseExamples(), ...getSortExamples()];
    expect(new Set(all.map((activity) => activity.id)).size).toBe(all.length);
    for (const kind of ["connect", "tune"] as const)
      expect(all.filter((activity) => activity.kind === kind)).toHaveLength(2);
    expect(all.filter((activity) => activity.kind === "sort")).toHaveLength(1);
  });

  it("checks both causal branches and supports more than one tuning solution", () => {
    for (const activity of getBaseExamples()) {
      if (activity.kind === "connect") {
        expect(checkConnections(activity, activity.edges).passed).toBe(true);
        expect(checkConnections(activity, []).passed).toBe(false);
      } else {
        const values =
          activity.id === "tune-image"
            ? [
                { width: 1000, quality: 65 },
                { width: 840, quality: 80 },
              ]
            : [
                { batch: 4, workers: 3 },
                { batch: 6, workers: 2 },
              ];
        for (const input of values) expect(evaluateTuning(activity, input).passed).toBe(true);
      }
    }
    for (const activity of getSortExamples()) expect(isValidSortActivity(activity)).toBe(true);
  });

  it("expands every retained example into three distinct difficulty tasks", () => {
    for (const activity of [...getBaseExamples(), ...getSortExamples()]) {
      const family = getExampleFamily(activity);
      expect(new Set(Object.values(family.levels).map((task) => task.id)).size).toBe(3);
      expect(new Set(Object.values(family.levels).map((task) => task.difficulty)).size).toBe(3);
    }
  });
});
