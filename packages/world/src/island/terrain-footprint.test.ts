import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import {
  buildIslandGeometry,
  islandTerrainFootprintRange,
  islandVisibleSurfaceIndex,
  sampleIslandTerrainTop,
} from "./island-geometry.js";
import { clipPolygonToTriangleXZ, heightOnTriangle } from "./surface-clip.js";
import { footprintSamplePoints, orientedFootprintFor } from "./island-composition.js";

describe("whole-footprint terrain coverage", () => {
  it("agrees with the emitted top triangles, including internal ridges between sample points", () => {
    const blueprint = islandBlueprint({ studyId: "contact", courseId: "ridge", lessonCount: 24 });
    const shape = buildIslandGeometry(blueprint, "course");
    try {
      const surface = islandVisibleSurfaceIndex(shape);
      for (const [x, z, turn] of [
        [0, 0, 0.2],
        [4, -2, 1.4],
        [-3, 3, 0.8],
      ]) {
        const polygon = footprintSamplePoints(
          orientedFootprintFor("rock_largeA", 0.7, x!, z!, turn!),
        ).slice(1, 5);
        const range = islandTerrainFootprintRange(blueprint, polygon);
        expect(range).not.toBeNull();
        const heights: number[] = [];
        // Independent input: real Float32 mesh, excluding only the road overlay.
        for (const triangle of surface.triangles.slice(0, shape.counts.topTriangles)) {
          for (const point of clipPolygonToTriangleXZ(polygon, triangle)) {
            const height = heightOnTriangle(triangle, point.x, point.z);
            if (height !== null) heights.push(height);
          }
        }
        expect(heights.length).toBeGreaterThan(4);
        expect(range!.minY).toBeCloseTo(Math.min(...heights), 4);
        expect(range!.maxY).toBeCloseTo(Math.max(...heights), 4);
        for (const point of polygon) {
          const y = sampleIslandTerrainTop(blueprint, "course", point.x, point.z).y;
          expect(y).toBeGreaterThanOrEqual(range!.minY - 1e-6);
          expect(y).toBeLessThanOrEqual(range!.maxY + 1e-6);
        }
      }
    } finally {
      shape.terrain.dispose();
    }
  });

  it("rejects missing terrain, partial coverage and non-finite footprints", () => {
    const blueprint = islandBlueprint({ studyId: "contact", courseId: "outside", lessonCount: 6 });
    const polygon = (x: number) =>
      footprintSamplePoints(orientedFootprintFor("rock_largeA", 2, x, 0, 0)).slice(1, 5);
    expect(islandTerrainFootprintRange(blueprint, polygon(100))).toBeNull();
    expect(islandTerrainFootprintRange(blueprint, polygon(blueprint.bounds.halfX))).toBeNull();
    expect(islandTerrainFootprintRange(blueprint, polygon(NaN))).toBeNull();
    expect(islandTerrainFootprintRange(blueprint, [])).toBeNull();
  });
});
