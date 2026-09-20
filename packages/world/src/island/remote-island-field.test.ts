import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  islandBlueprint,
  islandGeometryBlueprint,
  islandGeometryProjection,
  projectIslandBlueprint,
} from "./island-blueprint.js";
import {
  buildRemoteIslandBatch,
  buildRemoteBaseGeometry,
  getOrCreateRemoteBaseGeometry,
  getRemoteBaseGeometryBuildCount,
  resetRemoteBaseGeometryBuildCount,
  type RemoteIslandPlacement,
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
} from "./remote-island-field.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

describe("RemoteIslandField projection & batching", () => {
  it("bounds radius variants per live blueprint without evicting the recently used shape", () => {
    const blueprint = islandBlueprint({
      studyId: "radius-cache",
      courseId: "resized",
      lessonCount: 6,
    });
    const originals = Array.from({ length: 8 }, (_, index) =>
      getOrCreateRemoteBaseGeometry(blueprint, index + 2),
    );
    const before = originals[0]!.positions.slice();
    expect(getOrCreateRemoteBaseGeometry(blueprint, 2)).toBe(originals[0]);
    getOrCreateRemoteBaseGeometry(blueprint, 10);
    expect(getOrCreateRemoteBaseGeometry(blueprint, 2)).toBe(originals[0]);
    expect(getOrCreateRemoteBaseGeometry(blueprint, 3)).not.toBe(originals[1]);
    // Eviction relinquishes cache ownership, not buffers a mounted consumer owns.
    expect(originals[0]!.positions).toEqual(before);
    const packet = originals[0]!;
    console.log(
      "[remote-radius-cache] slots=8 packetBytes=" +
        (packet.positions.byteLength +
          packet.normals.byteLength +
          packet.colors.byteLength +
          packet.indices.byteLength),
    );
  });

  it("handles empty island array cleanly with finite bounds", () => {
    const batch = buildRemoteIslandBatch([]);
    expect(batch.islandCount).toBe(0);
    expect(batch.triangleCount).toBe(0);
    expect(batch.islandRanges).toHaveLength(0);
    expect(batch.islandIndexForFace(0)).toBeNull();
    expect(batch.islandIndexForFace(-1)).toBeNull();
    expect(Number.isFinite(batch.bounds.min.x)).toBe(true);
    expect(Number.isFinite(batch.bounds.min.y)).toBe(true);
    expect(Number.isFinite(batch.bounds.min.z)).toBe(true);
    expect(Number.isFinite(batch.bounds.max.x)).toBe(true);
    expect(Number.isFinite(batch.bounds.max.y)).toBe(true);
    expect(Number.isFinite(batch.bounds.max.z)).toBe(true);
    expect(batch.bounds.min.x).toBe(0);
    expect(batch.bounds.max.x).toBe(0);
    batch.dispose();
  });

  it("keeps the measured single-island geometry below its ceiling and preserves identity", () => {
    const studyId = "turing-pact";
    const courseId = "foundations-before-zero";
    const geom = islandGeometryBlueprint({
      studyId,
      courseId,
      lessonCount: 41,
      seed: "fixture-seed",
      themeSelection: islandThemeSelectionForCourse(studyId, courseId),
    });
    const blueprint = projectIslandBlueprint(geom);

    const placement: RemoteIslandPlacement = {
      id: `${studyId}/${courseId}`,
      blueprint,
      position: new THREE.Vector3(10, 2, -5),
      scale: 1.2,
      dimmed: false,
    };

    const batch = buildRemoteIslandBatch([placement]);
    try {
      expect(batch.islandCount).toBe(1);
      // R53 adaptive stone segmentation counts actual faces, not a fixed
      // 1,600-face stride. This fixture is a measured topology tripwire.
      expect(batch.triangleCount).toBe(1420);
      expect(batch.triangleCount).toBeLessThanOrEqual(REMOTE_ISLAND_TERRAIN_TRIANGLES);
      expect(batch.geometry.getIndex()!.count).toBe(batch.triangleCount * 3);
      expect(batch.islandRanges).toHaveLength(1);
      const range = batch.islandRanges[0]!;
      expect(range.id).toBe(`${studyId}/${courseId}`);
      expect(range.islandIndex).toBe(0);
      expect(range.startTriangle).toBe(0);
      expect(range.triangleCount).toBe(batch.triangleCount);

      // Face index mapping
      expect(batch.islandIndexForFace(0)).toBe(0);
      expect(batch.islandIndexForFace(300)).toBe(0);
      expect(batch.islandIndexForFace(batch.triangleCount - 1)).toBe(0);
      expect(batch.islandIndexForFace(batch.triangleCount)).toBeNull();
      expect(batch.islandIndexForFace(-1)).toBeNull();

      // Transformed bounding box contains the island position
      expect(range.bounds.containsPoint(new THREE.Vector3(10, 2, -5))).toBe(true);

      // Same blueprint base as course
      expect(islandGeometryProjection(blueprint)).toEqual(geom);
    } finally {
      batch.dispose();
    }
  });

  it("batches multiple islands into one BufferGeometry and maps picking faces accurately", () => {
    const count = 5;
    const placements: RemoteIslandPlacement[] = Array.from({ length: count }, (_, i) => {
      const studyId = `study-${i % 2}`;
      const courseId = `course-${i}`;
      const bp = islandBlueprint({
        studyId,
        courseId,
        lessonCount: 10 + i * 5,
      });
      return {
        id: `${studyId}/${courseId}`,
        blueprint: bp,
        position: new THREE.Vector3(i * 30, 0, 0),
        scale: 1.0,
        dimmed: i === 3,
        lift: i === 1 ? 2.5 : 0,
      };
    });

    const batch = buildRemoteIslandBatch(placements);
    try {
      expect(batch.islandCount).toBe(count);
      expect(batch.triangleCount).toBeLessThanOrEqual(count * REMOTE_ISLAND_TERRAIN_TRIANGLES);
      expect(batch.geometry.getIndex()!.count).toBe(batch.triangleCount * 3);
      expect(batch.islandRanges).toHaveLength(count);
      expect(new Set(batch.islandRanges.map((range) => range.triangleCount)).size).toBeGreaterThan(
        1,
      );

      // Verify range sequence
      let expectedStart = 0;
      for (let i = 0; i < count; i += 1) {
        const range = batch.islandRanges[i]!;
        const base = getOrCreateRemoteBaseGeometry(placements[i]!.blueprint);
        expect(range.islandIndex).toBe(i);
        expect(range.startTriangle).toBe(expectedStart);
        expect(range.triangleCount).toBe(base.indices.length / 3);
        expect(range.triangleCount).toBeGreaterThan(352);
        expect(range.triangleCount).toBeLessThanOrEqual(REMOTE_ISLAND_TERRAIN_TRIANGLES);

        // Test boundary faces for each island
        expect(batch.islandIndexForFace(expectedStart)).toBe(i);
        expect(batch.islandIndexForFace(expectedStart + Math.floor(range.triangleCount / 2))).toBe(
          i,
        );
        expect(batch.islandIndexForFace(expectedStart + range.triangleCount - 1)).toBe(i);
        expectedStart += range.triangleCount;
        expect(batch.islandIndexForFace(expectedStart)).toBe(i + 1 < count ? i + 1 : null);
      }

      expect(batch.triangleCount).toBe(expectedStart);
      expect(batch.islandIndexForFace(expectedStart)).toBeNull();
      expect(batch.islandIndexForFace(-5)).toBeNull();

      // Lift check: island 1 position has y lifted
      expect(batch.islandRanges[1]!.bounds.max.y).toBeGreaterThan(
        batch.islandRanges[0]!.bounds.max.y,
      );

      // Dimmed check: island 3 has dimmed color multiplier applied
      const colorAttr = batch.geometry.getAttribute("color");
      expect(colorAttr).toBeDefined();
      // Variable topology also changes vertex ranges: dividing the total by
      // island count would silently sample a different rock or neighbour.
      for (const i of [0, 3]) {
        const base = getOrCreateRemoteBaseGeometry(placements[i]!.blueprint);
        const vertex = batch.geometry.getIndex()!.getX(batch.islandRanges[i]!.startTriangle * 3);
        const sourceVertex = base.indices[0]!;
        const multiplier = i === 3 ? 0.9 : 1;
        expect(colorAttr.getX(vertex)).toBeGreaterThan(0);
        expect(colorAttr.getX(vertex)).toBeCloseTo(base.colors[sourceVertex * 3]! * multiplier, 6);
        expect(colorAttr.getY(vertex)).toBeCloseTo(
          base.colors[sourceVertex * 3 + 1]! * multiplier,
          6,
        );
        expect(colorAttr.getZ(vertex)).toBeCloseTo(
          base.colors[sourceVertex * 3 + 2]! * multiplier,
          6,
        );
      }
    } finally {
      batch.dispose();
    }
  });

  it("scales to full 53-course catalogue within budget in a single draw call", () => {
    const totalIslands = 53;
    const placements: RemoteIslandPlacement[] = Array.from({ length: totalIslands }, (_, i) => {
      const studyId = `study-${i % 5}`;
      const courseId = `course-${i}`;
      const bp = islandBlueprint({
        studyId,
        courseId,
        lessonCount: 6 + (i % 35),
      });
      return {
        id: `${studyId}/${courseId}`,
        blueprint: bp,
        position: new THREE.Vector3((i % 8) * 20, 0, Math.floor(i / 8) * 20),
        scale: 0.9,
      };
    });

    const start = performance.now();
    const batch = buildRemoteIslandBatch(placements);
    const elapsedMs = performance.now() - start;

    try {
      console.log(
        `[catalogue-53-remote-batch] elapsedMs=${elapsedMs.toFixed(2)} triangles=${batch.triangleCount}`,
      );
      // Single geometry = 1 draw call
      expect(batch.geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(batch.islandCount).toBe(53);
      expect(batch.triangleCount).toBeLessThanOrEqual(53 * REMOTE_ISLAND_TERRAIN_TRIANGLES);
      expect(batch.geometry.getIndex()!.count).toBe(batch.triangleCount * 3);
      expect(batch.islandRanges).toHaveLength(53);
      let offset = 0;
      for (const range of batch.islandRanges) {
        expect(range.startTriangle).toBe(offset);
        expect(range.triangleCount).toBeGreaterThan(352);
        expect(range.triangleCount).toBeLessThanOrEqual(REMOTE_ISLAND_TERRAIN_TRIANGLES);
        expect(batch.islandIndexForFace(offset)).toBe(range.islandIndex);
        offset += range.triangleCount;
        expect(batch.islandIndexForFace(offset - 1)).toBe(range.islandIndex);
      }
      expect(batch.triangleCount).toBe(offset);
      expect(batch.islandIndexForFace(offset)).toBeNull();
      expect(elapsedMs).toBeLessThan(500); // well below half a second
    } finally {
      batch.dispose();
    }
  });

  it("caches base geometry and ensures zero additional terrain generation on selection/lift/dimmed updates", () => {
    const studyId = "buzz";
    const courseId = "intro";
    const bp = islandBlueprint({
      studyId,
      courseId,
      lessonCount: 15,
    });

    resetRemoteBaseGeometryBuildCount();
    const base = buildRemoteBaseGeometry(bp, 6);
    expect(getRemoteBaseGeometryBuildCount()).toBe(1);

    // Initial batch using prebuilt base geometry
    const batch1 = buildRemoteIslandBatch([
      {
        id: `${studyId}/${courseId}`,
        blueprint: bp,
        baseGeometry: base,
        position: new THREE.Vector3(0, 0, 0),
        scale: 1,
        dimmed: false,
      },
    ]);
    expect(getRemoteBaseGeometryBuildCount()).toBe(1);
    batch1.dispose();

    // Rebuild batch when selectedId / lift / dimmed changes
    const batch2 = buildRemoteIslandBatch([
      {
        id: `${studyId}/${courseId}`,
        blueprint: bp,
        baseGeometry: base,
        position: new THREE.Vector3(0, 1.08, 0),
        scale: 1.045,
        dimmed: true,
      },
    ]);
    // Base geometry build count MUST NOT increase!
    expect(getRemoteBaseGeometryBuildCount()).toBe(1);
    expect(batch2.triangleCount).toBe(base.triangleCount);
    expect(batch2.geometry.getIndex()!.count).toBe(base.indices.length);
    expect(batch2.islandRanges[0]!.bounds.max.y).toBeGreaterThan(0);
    batch2.dispose();
  });

  it("rejects non-finite, non-integer, and negative faceIndex with null", () => {
    const bp = islandBlueprint({ studyId: "turing", courseId: "c1", lessonCount: 10 });
    const batch = buildRemoteIslandBatch([
      {
        id: "turing/c1",
        blueprint: bp,
        position: new THREE.Vector3(),
      },
    ]);

    try {
      expect(batch.islandIndexForFace(NaN)).toBeNull();
      expect(batch.islandIndexForFace(Infinity)).toBeNull();
      expect(batch.islandIndexForFace(-Infinity)).toBeNull();
      expect(batch.islandIndexForFace(0.5)).toBeNull();
      expect(batch.islandIndexForFace(100.99)).toBeNull();
      expect(batch.islandIndexForFace(-1)).toBeNull();
      expect(batch.islandIndexForFace(-100)).toBeNull();
      expect(batch.islandIndexForFace(batch.triangleCount)).toBeNull();
      expect(batch.islandIndexForFace(1000000)).toBeNull();
      // Valid integer indices return the island
      expect(batch.islandIndexForFace(0)).toBe(0);
      expect(batch.islandIndexForFace(batch.triangleCount - 1)).toBe(0);
    } finally {
      batch.dispose();
    }
  });

  it("selects Uint16 vs Uint32 index attribute based on max vertex index rather than index length", () => {
    const bp = islandBlueprint({ studyId: "turing", courseId: "c1", lessonCount: 10 });
    // One bounded island has fewer than 65536 actual vertices: Uint16 suffices.
    const smallBatch = buildRemoteIslandBatch([
      {
        id: "turing/c1",
        blueprint: bp,
        position: new THREE.Vector3(),
      },
    ]);
    try {
      const indexAttr = smallBatch.geometry.getIndex();
      expect(indexAttr).toBeDefined();
      expect(indexAttr!.array).toBeInstanceOf(Uint16Array);
    } finally {
      smallBatch.dispose();
    }
  });

  it("ensures mesh bounds strictly match entry.radius without double scaling", () => {
    const studyId = "alpha";
    const courseId = "c1";
    const bp = islandBlueprint({ studyId, courseId, lessonCount: 12 });
    const targetRadius = 4.2;

    const batch = buildRemoteIslandBatch([
      {
        id: `${studyId}/${courseId}`,
        blueprint: bp,
        position: new THREE.Vector3(0, 0, 0),
        scale: 1, // Single actual radius: scale=1
        radius: targetRadius,
      },
    ]);

    try {
      const range = batch.islandRanges[0]!;
      const halfSpanX = (range.bounds.max.x - range.bounds.min.x) * 0.5;
      const halfSpanZ = (range.bounds.max.z - range.bounds.min.z) * 0.5;
      const measuredMaxHalf = Math.max(halfSpanX, halfSpanZ);
      expect(measuredMaxHalf).toBeGreaterThan(3.9);
      expect(measuredMaxHalf).toBeLessThanOrEqual(targetRadius);
    } finally {
      batch.dispose();
    }
  });
});
