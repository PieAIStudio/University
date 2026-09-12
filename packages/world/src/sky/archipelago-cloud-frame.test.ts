import { describe, expect, it } from "vitest";
import { cuteCloudLayout } from "./cloud-sea.js";
import { createCloudVolumeGeometry } from "./cloud-volume.js";

describe("the miniature archipelago's existing cloud batches", () => {
  it.each(["desktop", "mobile"] as const)(
    "keeps the carrier identical and scenery below real roots on %s",
    (quality) => {
      const ordinary = cuteCloudLayout(120, -5.2, quality);
      const frame = { radius: 4.5, floor: -7 };
      const framed = cuteCloudLayout(120, -5.2, quality, frame);
      expect(framed.puffs).toHaveLength(ordinary.puffs.length);
      expect(framed.lobes).toHaveLength(ordinary.lobes.length);
      expect(framed.underbellies).toHaveLength(ordinary.underbellies.length);
      expect(framed.puffs.at(-1)).toEqual(ordinary.puffs.at(-1));
      expect(framed.lobes.at(-1)).toEqual(ordinary.lobes.at(-1));
      expect(framed.underbellies.at(-1)).toEqual(ordinary.underbellies.at(-1));
      expect(cuteCloudLayout(120, -5.2, quality, frame)).toEqual(framed);
      const geometry = createCloudVolumeGeometry(32, 9);
      const positions = geometry.getAttribute("position");
      for (const lobe of framed.lobes.slice(0, -1)) {
        expect(lobe.position.every(Number.isFinite)).toBe(true);
        for (let i = 0; i < positions.count; i++) {
          expect(lobe.position[1] + positions.getY(i) * lobe.scale[1]).toBeLessThan(
            frame.floor - 2.5,
          );
        }
      }
      geometry.dispose();
    },
  );
});
