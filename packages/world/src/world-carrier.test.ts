import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { islandBlueprint } from "./island/island-blueprint.js";
import { getOrCreateRemoteBaseGeometry } from "./island/remote-island-field.js";
import {
  cloudCarrierClearance,
  cloudCarrierHome,
  cuteCloudLayout,
  CLOUD_CARRIER_FOOT_OFFSET,
} from "./sky/cloud-sea.js";
import {
  worldCarrierHomeTarget,
  worldIslandCarrierTarget,
  worldIslandCaptionTarget,
} from "./world-carrier.js";

describe("carrier contact on the real distant island", () => {
  it.each([6, 24, 41])(
    "anchors a %i-lesson caption below the actual cached rock root at every state scale",
    (lessonCount) => {
      const blueprint = islandBlueprint({
        studyId: "caption",
        courseId: `island-${lessonCount}`,
        lessonCount,
      });
      for (const scale of [0.84, 0.92, 0.98, 1.2]) {
        const island = { blueprint, radius: 3 * scale, position: new THREE.Vector3(4, 2, -3) };
        const base = getOrCreateRemoteBaseGeometry(blueprint, island.radius);
        const before = island.position.clone();
        const caption = worldIslandCaptionTarget(island);
        expect(caption.x).toBe(island.position.x);
        expect(caption.z).toBe(island.position.z);
        expect(caption.y).toBeCloseTo(island.position.y + base.bounds.min.y - 0.3, 8);
        expect(caption.y).toBeLessThan(island.position.y);
        expect(island.position).toEqual(before);
        expect(getOrCreateRemoteBaseGeometry(blueprint, island.radius)).toBe(base);
      }
    },
  );

  it.each([6, 24, 41])(
    "keeps the entire cloud above the %i-lesson terrain without moving the island",
    (lessonCount) => {
      const blueprint = islandBlueprint({
        studyId: "carrier",
        courseId: `island-${lessonCount}`,
        lessonCount,
      });
      const island = { blueprint, radius: 4.8, position: new THREE.Vector3(4, 2, -3) };
      const before = island.position.clone();
      const target = worldIslandCarrierTarget(island, 120, -5.2);
      const ground =
        getOrCreateRemoteBaseGeometry(blueprint, island.radius).bounds.max.y + island.position.y;
      expect(target[1] - cloudCarrierClearance(120, -5.2)).toBeCloseTo(ground, 8);
      expect(target[0]).toBe(island.position.x);
      expect(target[2]).toBe(island.position.z);
      expect(island.position).toEqual(before);
      expect(worldIslandCarrierTarget(island, 120, -5.2)).toEqual(target);
      // N06: remembered learning focus is not an explicit selection.
      const home = worldCarrierHomeTarget([island], before.clone(), 120, -5.2);
      expect(
        Math.hypot(home[0] - island.position.x, home[2] - island.position.z),
      ).toBeGreaterThanOrEqual(island.radius + 2.2);
      expect(home[1]).toBe(target[1]);
      expect(island.position).toEqual(before);
    },
  );

  it("retains the existing cloud home when the actual catalogue has no islands", () => {
    const home = cloudCarrierHome(120, -5.2);
    expect(worldCarrierHomeTarget([], null, 120, -5.2)).toEqual(home);
    expect(worldCarrierHomeTarget([], new THREE.Vector3(4, 0, -3), 120, -5.2)).toEqual(home);
  });

  it("checks all destination footprints and keeps a deterministic waiting position", () => {
    const blueprint = islandBlueprint({ studyId: "waiting", courseId: "shared", lessonCount: 6 });
    const islands = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-9, 2, 0),
      new THREE.Vector3(0, 1, 9),
    ].map((position) => ({ blueprint, position, radius: 4.8 }));
    const originals = islands.map((island) => island.position.toArray());
    const result = worldCarrierHomeTarget(islands, islands[0]!.position.clone(), 120, -5.2);
    const margin = Math.max(2.2, cloudCarrierClearance(120, -5.2));
    for (const island of islands) {
      expect(
        Math.hypot(result[0] - island.position.x, result[2] - island.position.z),
      ).toBeGreaterThanOrEqual(island.radius + margin - 1e-8);
    }
    expect(result.every(Number.isFinite)).toBe(true);
    expect(worldCarrierHomeTarget(islands, islands[0]!.position.clone(), 120, -5.2)).toEqual(
      result,
    );
    expect(islands.map((island) => island.position.toArray())).toEqual(originals);
  });

  it.each(["desktop", "mobile"] as const)(
    "derives clearance from the %s carrier lobes instead of a guessed height",
    (quality) => {
      const layout = cuteCloudLayout(120, -5.2, quality);
      const feet = cloudCarrierHome(120, -5.2, quality);
      const clearance = cloudCarrierClearance(120, -5.2, quality);
      expect(clearance).toBeGreaterThan(CLOUD_CARRIER_FOOT_OFFSET);
      for (const lobe of [...layout.lobes, ...layout.underbellies].filter(
        (entry) => entry.puffIndex === layout.puffs.length - 1,
      )) {
        expect(lobe.position[1] - lobe.scale[1]).toBeGreaterThan(feet[1] - clearance);
      }
    },
  );
});
