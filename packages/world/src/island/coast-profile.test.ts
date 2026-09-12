import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import { coastalRockMask } from "./coast-profile.js";

describe("shared geological shoulders", () => {
  it.each(["coast-a", "coast-b", "coast-c"])(
    "exposes headlands, not a constant-width rim: %s",
    (courseId) => {
      const blueprint = islandBlueprint({ studyId: "coast", courseId, lessonCount: 24 });
      const sample = (radial: number) =>
        Array.from({ length: 96 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 96;
          return coastalRockMask(
            blueprint,
            Math.cos(angle) * blueprint.bounds.halfX * radial,
            Math.sin(angle) * blueprint.bounds.halfZ * radial,
            radial,
            blueprint.bounds.maxHalf * 0.08,
          );
        });
      expect(sample(0.7).every((value) => value === 0)).toBe(true);
      const shoulder = sample(0.82);
      expect(Math.max(...shoulder)).toBeGreaterThan(0.1);
      expect(shoulder.filter((value) => value === 0).length).toBeGreaterThan(10);
      const edge = sample(1);
      expect(Math.max(...edge) - Math.min(...edge)).toBeGreaterThan(0.7);
      expect(edge.every((value) => value >= 0 && value <= 1)).toBe(true);
      expect(sample(0.82)).toEqual(shoulder);
    },
  );
});
