import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { COURSE_CHEST_TRIANGLE_CEILING } from "../island/island-technique-lock.js";
import {
  CHEST_HINGE,
  CHEST_WIDTH,
  buildChestGeometry,
  chestTriangles,
  composeChestMatrix,
  composeLidMatrix,
} from "./chest-geometry.js";
import type { ChestTier } from "./chests-and-monsters.js";

const TIERS: readonly ChestTier[] = ["wood", "rare", "epic", "legendary"];

describe("the map chest", () => {
  it.each(TIERS)("stays inside the technique lock's triangle ceiling (%s)", (tier) => {
    const geometry = buildChestGeometry(tier);
    const triangles = chestTriangles(geometry);
    if (process.env.UNIVERSITY_WORLD_BENCHMARK === "1") console.log(tier, triangles);
    expect(triangles).toBeLessThanOrEqual(COURSE_CHEST_TRIANGLE_CEILING);
    expect(geometry.body.getAttribute("color")).toBeDefined();
    expect(geometry.lid.getAttribute("color")).toBeDefined();
  });

  it("gives every tier its own colours", () => {
    const first = (tier: ChestTier) => {
      const colour = buildChestGeometry(tier).lid.getAttribute("color") as THREE.BufferAttribute;
      return `${colour.getX(0).toFixed(3)},${colour.getY(0).toFixed(3)},${colour.getZ(0).toFixed(3)}`;
    };
    expect(new Set(TIERS.map(first)).size).toBe(TIERS.length);
  });

  it("stands on the ground and swings its lid up and back about the hinge", () => {
    const geometry = buildChestGeometry("wood");
    geometry.body.computeBoundingBox();
    expect(geometry.body.boundingBox!.min.y).toBeCloseTo(0, 5);
    const chest = composeChestMatrix(new THREE.Vector3(2, 1, 3), 0, 1, new THREE.Matrix4());
    const hinge = CHEST_HINGE.clone()
      .multiplyScalar(CHEST_WIDTH)
      .add(new THREE.Vector3(2, 1, 3));
    const front = new THREE.Vector3(0, 0.05, 0.6);
    const shut = front.clone().applyMatrix4(composeLidMatrix(chest, 0, new THREE.Matrix4()));
    const open = front.clone().applyMatrix4(composeLidMatrix(chest, 1, new THREE.Matrix4()));
    // Shut, the lid's front edge is in front of the hinge; open, it has swung above and behind.
    expect(shut.z).toBeGreaterThan(hinge.z);
    expect(open.y).toBeGreaterThan(shut.y);
    expect(open.z).toBeLessThan(shut.z);
    // The hinge itself does not move.
    const pin = new THREE.Vector3().applyMatrix4(composeLidMatrix(chest, 1, new THREE.Matrix4()));
    expect(pin.distanceTo(hinge)).toBeLessThan(1e-6);
  });

  it("draws an edge chest smaller in place", () => {
    const at = new THREE.Vector3(1, 0, 1);
    const full = composeChestMatrix(at, 0.4, 1, new THREE.Matrix4());
    const small = composeChestMatrix(at, 0.4, 0.62, new THREE.Matrix4());
    const size = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixScale(m).x;
    expect(size(small) / size(full)).toBeCloseTo(0.62, 5);
    expect(new THREE.Vector3().setFromMatrixPosition(small).equals(at)).toBe(true);
  });
});
