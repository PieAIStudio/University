import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  islandBlueprint,
  islandSurfaceY,
  sampleIslandSurface,
} from "../island/island-blueprint.js";
import { buildBlueprintIsland } from "../island/island-geometry.js";
import { radiusForLessons } from "../course/layout.js";

const STUDY = "turing-pact";
const COURSE = "foundations-before-zero";

describe("IslandBlueprint semantic LOD", () => {
  it("is deterministic, serialisable and keyed to the stable course identity", () => {
    const once = islandBlueprint(STUDY, COURSE, 41);
    const twice = islandBlueprint(STUDY, COURSE, 41);
    expect(once).toEqual(twice);
    expect(once.seed).toBe(`${STUDY}/${COURSE}`);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
    expect(once.path).toHaveLength(41);
  });

  it("keeps every route point and semantic anchor on the authored ground", () => {
    const blueprint = islandBlueprint(STUDY, COURSE, 41);
    for (const point of blueprint.path) {
      expect(sampleIslandSurface(blueprint, point.x, point.z).inside).toBe(true);
    }
    for (const [x, z] of Object.values(blueprint.anchors)) {
      const sample = sampleIslandSurface(blueprint, x, z);
      expect(sample.inside).toBe(true);
      expect(sample.y).toBe(islandSurfaceY(blueprint, x, z));
    }
  });

  it("keeps a one-lesson landmark beside, not on top of, its entrance", () => {
    const blueprint = islandBlueprint(STUDY, "one-lesson", 1);
    expect(blueprint.anchors.landmark).not.toEqual(blueprint.anchors.entrance);
    const [x, z] = blueprint.anchors.landmark;
    expect(sampleIslandSurface(blueprint, x, z).inside).toBe(true);
  });

  it("changes mesh density, not the normalised outline or landmark coordinate", () => {
    const blueprint = islandBlueprint(STUDY, COURSE, 41);
    const radius = radiusForLessons(41);
    const world = buildBlueprintIsland(blueprint, "world", radius);
    const course = buildBlueprintIsland(blueprint, "course");
    try {
      expect(world.geometry.getAttribute("position").count).toBeLessThan(
        course.geometry.getAttribute("position").count,
      );
      expect(world.bounds.halfX / world.horizontalScale).toBeCloseTo(course.bounds.halfX, 6);
      expect(world.bounds.halfZ / world.horizontalScale).toBeCloseTo(course.bounds.halfZ, 6);
      expect(world.slots.length).toBeLessThan(course.slots.length);

      const [x, z] = blueprint.anchors.landmark;
      const courseAnchor = new THREE.Vector3(x, islandSurfaceY(blueprint, x, z), z);
      const worldAnchor = new THREE.Vector3(
        x * world.horizontalScale,
        islandSurfaceY(blueprint, x, z) * world.heightScale,
        z * world.horizontalScale,
      );
      expect(worldAnchor.x / world.horizontalScale).toBeCloseTo(courseAnchor.x, 6);
      expect(worldAnchor.z / world.horizontalScale).toBeCloseTo(courseAnchor.z, 6);
    } finally {
      world.geometry.dispose();
      course.geometry.dispose();
    }
  });

  it("uses the same surface rule for deterministic prop slots", () => {
    const blueprint = islandBlueprint(STUDY, COURSE, 41);
    for (const slot of blueprint.surfaceSlots) {
      expect(sampleIslandSurface(blueprint, slot.x, slot.z).inside).toBe(true);
      expect(slot.y).toBeCloseTo(islandSurfaceY(blueprint, slot.x, slot.z), 8);
      const [landmarkX, landmarkZ] = blueprint.anchors.landmark;
      expect(Math.hypot(slot.x - landmarkX, slot.z - landmarkZ)).toBeGreaterThanOrEqual(5.8);
    }
  });

  it("builds finite, upward-facing top geometry", () => {
    const blueprint = islandBlueprint(STUDY, COURSE, 41);
    const shape = buildBlueprintIsland(blueprint, "course");
    try {
      const positions = shape.geometry.getAttribute("position") as THREE.BufferAttribute;
      const normals = shape.geometry.getAttribute("normal") as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index += 1) {
        expect(Number.isFinite(positions.getX(index))).toBe(true);
        expect(Number.isFinite(positions.getY(index))).toBe(true);
        expect(Number.isFinite(positions.getZ(index))).toBe(true);
      }
      expect(normals.getY(0)).toBeGreaterThan(0.5);
    } finally {
      shape.geometry.dispose();
    }
  });
});
