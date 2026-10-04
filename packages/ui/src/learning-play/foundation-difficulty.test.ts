import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DIFFICULTIES,
  checkConnections,
  evaluateTuning,
  selectActivityLevel,
} from "@pieai/university-core";
import { getFoundationFamily } from "./foundation-difficulty.js";
import { getBaseExamples } from "./base-examples.js";

describe("curated foundation difficulty tasks", () => {
  it.each(ACTIVITY_DIFFICULTIES)(
    "%s has unique task identities and an actual solution for every case",
    (level) => {
      for (const activity of getBaseExamples()) {
        const family = getFoundationFamily(activity);
        const task = selectActivityLevel(family, level);
        expect(task.difficulty).toBe(level);
        expect(task.id).not.toBe(activity.id);
        if (task.kind === "connect") {
          expect(checkConnections(task, task.edges).passed, task.id).toBe(true);
          expect(checkConnections(task, []).passed, task.id).toBe(false);
        } else if (task.kind === "tune") {
          const input: Record<string, number> =
            task.visualization?.kind === "image-detail"
              ? level === "intro"
                ? { width: 840 }
                : { width: 1000, quality: 65 }
              : level === "intro"
                ? { batch: 6 }
                : { batch: 5, workers: 3 };
          expect(evaluateTuning(task, input).passed, task.id).toBe(true);
        }
      }
    },
  );

  it("uses narrower tasks, independent constraints and changed cache keys rather than a difficulty multiplier", () => {
    for (const activity of getBaseExamples()) {
      const family = getFoundationFamily(activity);
      expect(new Set(ACTIVITY_DIFFICULTIES.map((level) => family.levels[level].id)).size).toBe(3);
      const { intro, practice, challenge } = family.levels;
      if (activity.kind === "connect") {
        if (intro.kind !== "connect" || practice.kind !== "connect" || challenge.kind !== "connect")
          throw new Error("A connect family contains another activity kind");
        expect(intro.edges.length).toBeLessThan(practice.edges.length);
        expect(challenge.edges.length).toBeGreaterThan(practice.edges.length);
      } else {
        if (intro.kind !== "tune" || practice.kind !== "tune")
          throw new Error("A tune family contains another activity kind");
        expect(intro.controls.length).toBeLessThan(practice.controls.length);
      }
    }
  });

  it("rejects a family that reuses an activity identity across difficulty", () => {
    const family = getFoundationFamily(getBaseExamples()[0]!);
    Object.assign(family.levels.intro, { id: family.levels.practice.id });
    expect(() => selectActivityLevel(family, "intro")).toThrow("Invalid learning activity family");
  });
});
