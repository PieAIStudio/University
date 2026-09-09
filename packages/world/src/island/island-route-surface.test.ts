/**
 * The route has to be the ground it is drawn on, not a second opinion about it.
 *
 * These are the regressions for the 2026-09-06 review finding: the soil strip
 * placed its vertices at the rendered terrain's height and then interpolated
 * along its own edges, while the ground interpolated along the lattice's. The
 * two linear functions crossed, and 22.7% of the strip sat under the hill it
 * was supposed to lie on. Every assertion below is written against the emitted
 * triangles' *interiors*, because the old implementation was correct at exactly
 * the points a vertex-only test would have looked at.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  ISLAND_ROUTE_ARCHETYPES,
  islandBlueprint,
  type IslandBlueprint,
  type IslandRouteArchetype,
} from "./island-blueprint.js";
import {
  authoredSoilPlan,
  buildIslandGeometry,
  type IslandGeometryShape,
} from "./island-geometry.js";
import {
  barycentricXZ,
  buildSurfaceTriangleIndex,
  clipPolygonToTriangleXZ,
  doubleSignedAreaXZ,
  type SurfaceTriangle,
} from "./surface-clip.js";

const LESSON_COUNTS = [6, 24, 41] as const;

/** Route clearance above the ground, as `island-geometry.ts` emits it. */
const PATH_LIFT = 0.002;

function fixture(archetype: IslandRouteArchetype, lessonCount: number): IslandBlueprint {
  return islandBlueprint({
    studyId: "turing-pact",
    courseId: `route-${archetype}-${lessonCount}`,
    lessonCount,
    routeArchetype: archetype,
    seed: `route/${archetype}/${lessonCount}`,
  });
}

interface MeshTriangle {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly c: THREE.Vector3;
  readonly i0: number;
  readonly i1: number;
  readonly i2: number;
}

function meshTriangles(shape: IslandGeometryShape, from: number, count: number): MeshTriangle[] {
  const position = shape.terrain.getAttribute("position");
  const index = shape.terrain.getIndex();
  if (!index) throw new Error("expected an indexed terrain mesh");
  const triangles: MeshTriangle[] = [];
  for (let triangle = from; triangle < from + count; triangle += 1) {
    const i0 = index.getX(triangle * 3);
    const i1 = index.getX(triangle * 3 + 1);
    const i2 = index.getX(triangle * 3 + 2);
    triangles.push({
      a: new THREE.Vector3().fromBufferAttribute(position, i0),
      b: new THREE.Vector3().fromBufferAttribute(position, i1),
      c: new THREE.Vector3().fromBufferAttribute(position, i2),
      i0,
      i1,
      i2,
    });
  }
  return triangles;
}

function asSurface(triangle: MeshTriangle): SurfaceTriangle {
  return {
    x0: triangle.a.x,
    z0: triangle.a.z,
    y0: triangle.a.y,
    i0: triangle.i0,
    x1: triangle.b.x,
    z1: triangle.b.z,
    y1: triangle.b.y,
    i1: triangle.i1,
    x2: triangle.c.x,
    z2: triangle.c.z,
    y2: triangle.c.y,
    i2: triangle.i2,
  };
}

function heightOnIndex(
  index: ReturnType<typeof buildSurfaceTriangleIndex>,
  x: number,
  z: number,
): number | null {
  let best: number | null = null;
  let bestMin = -1;
  for (const candidate of index.candidates(x, z, x, z)) {
    const triangle = index.triangles[candidate]!;
    const weights = barycentricXZ(triangle, x, z);
    if (!weights) continue;
    if (weights[0] < -1e-6 || weights[1] < -1e-6 || weights[2] < -1e-6) continue;
    const minW = Math.min(weights[0], weights[1], weights[2]);
    const height = triangle.y0 * weights[0] + triangle.y1 * weights[1] + triangle.y2 * weights[2];
    if (best === null || minW > bestMin) {
      best = height;
      bestMin = minW;
    }
  }
  return best;
}

function areaXZ(triangle: {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}): number {
  return (
    Math.abs(
      (triangle.x1 - triangle.x0) * (triangle.z2 - triangle.z0) -
        (triangle.x2 - triangle.x0) * (triangle.z1 - triangle.z0),
    ) / 2
  );
}

/** Points strictly inside a triangle, plus points on each shared edge. */
const INTERIOR_WEIGHTS: readonly (readonly [number, number, number])[] = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.6, 0.25, 0.15],
  [0.15, 0.6, 0.25],
  [0.25, 0.15, 0.6],
  [0.5, 0.5, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
];

const STRICT_INTERIOR: readonly (readonly [number, number, number])[] = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.6, 0.25, 0.15],
  [0.15, 0.6, 0.25],
  [0.25, 0.15, 0.6],
];

/**
 * Near-edge samples of the authored ribbon. Exact shared vertices can sit in
 * a dropped 1e-9 sliver after clipping; sitting 2% inboard still covers the
 * visible verge without treating a numerical corner as a hole.
 */
const EDGE_WEIGHTS: readonly (readonly [number, number, number])[] = [
  [0.96, 0.02, 0.02],
  [0.02, 0.96, 0.02],
  [0.02, 0.02, 0.96],
  [0.49, 0.49, 0.02],
  [0.02, 0.49, 0.49],
  [0.49, 0.02, 0.49],
];

function at(triangle: MeshTriangle, weights: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(
    triangle.a.x * weights[0] + triangle.b.x * weights[1] + triangle.c.x * weights[2],
    triangle.a.y * weights[0] + triangle.b.y * weights[1] + triangle.c.y * weights[2],
    triangle.a.z * weights[0] + triangle.b.z * weights[1] + triangle.c.z * weights[2],
  );
}

function normalY(triangle: MeshTriangle): number {
  const first = new THREE.Vector3().subVectors(triangle.b, triangle.a);
  const second = new THREE.Vector3().subVectors(triangle.c, triangle.a);
  return new THREE.Vector3().crossVectors(first, second).y;
}

describe("Course route sits on the terrain it is cut from", () => {
  for (const archetype of ISLAND_ROUTE_ARCHETYPES) {
    for (const lessonCount of LESSON_COUNTS) {
      const label = `${archetype}/${lessonCount}`;

      it(`keeps every route triangle interior flush with the ground (${label})`, () => {
        const blueprint = fixture(archetype, lessonCount);
        const shape = buildIslandGeometry(blueprint, "course");
        const triangles = meshTriangles(
          shape,
          shape.counts.topTriangles,
          shape.counts.routeTriangles,
        );
        expect(triangles.length, label).toBeGreaterThan(0);
        const cellSize = Math.max(0.5, blueprint.bounds.maxHalf * 0.06);
        const top = meshTriangles(shape, 0, shape.counts.topTriangles);
        const ground = buildSurfaceTriangleIndex(top.map(asSurface), cellSize);

        let worstBelow = Infinity;
        let worstAbove = -Infinity;
        let missed = 0;
        for (const triangle of triangles) {
          for (const weights of INTERIOR_WEIGHTS) {
            const point = at(triangle, weights);
            expect(Number.isFinite(point.y), `${label} finite`).toBe(true);
            const height = heightOnIndex(ground, point.x, point.z);
            if (height === null) {
              missed += 1;
              continue;
            }
            const clearance = point.y - height;
            worstBelow = Math.min(worstBelow, clearance);
            worstAbove = Math.max(worstAbove, clearance);
          }
        }
        expect(missed, `${label} off the top mesh`).toBe(0);
        expect(Number.isFinite(worstBelow), `${label} measured`).toBe(true);
        // The route is the ground plus one constant, everywhere, not only at
        // its own vertices. Tolerance is float noise on a ~34-unit island.
        expect(worstBelow, `${label} deepest burial`).toBeGreaterThan(PATH_LIFT - 1e-4);
        expect(worstAbove, `${label} highest float`).toBeLessThan(PATH_LIFT + 1e-4);
        shape.terrain.dispose();
      });

      it(`emits upward, non-degenerate route triangles (${label})`, () => {
        const blueprint = fixture(archetype, lessonCount);
        const shape = buildIslandGeometry(blueprint, "course");
        for (const triangle of meshTriangles(
          shape,
          shape.counts.topTriangles,
          shape.counts.routeTriangles,
        )) {
          expect(normalY(triangle), `${label} winding`).toBeGreaterThan(0);
          expect(areaXZ(asSurface(triangle)), `${label} degenerate`).toBeGreaterThan(0);
        }
        shape.terrain.dispose();
      });

      it(`covers the authored route area without holes or overlapping interiors (${label})`, () => {
        const blueprint = fixture(archetype, lessonCount);
        const shape = buildIslandGeometry(blueprint, "course");
        const route = meshTriangles(shape, shape.counts.topTriangles, shape.counts.routeTriangles);
        const authored = authoredSoilPlan(blueprint);
        const cellSize = Math.max(0.5, blueprint.bounds.maxHalf * 0.06);
        const routeIndex = buildSurfaceTriangleIndex(route.map(asSurface), cellSize);

        const authoredArea = authored.reduce((sum, triangle) => sum + areaXZ(triangle), 0);
        const emittedArea = route.reduce((sum, triangle) => sum + areaXZ(asSurface(triangle)), 0);
        expect(authoredArea, `${label} authored area`).toBeGreaterThan(1);
        // Clipping may drop zero-area slivers; it must not lose a visible band
        // or stack two interiors on the same plan.
        expect(emittedArea, `${label} emitted area`).toBeGreaterThan(authoredArea * 0.97);
        expect(emittedArea, `${label} emitted area upper`).toBeLessThan(authoredArea * 1.03);

        let uncovered = 0;
        let uncoveredEdges = 0;
        let probes = 0;
        let edgeProbes = 0;
        for (const triangle of authored) {
          for (const weights of STRICT_INTERIOR) {
            const x =
              triangle.x0 * weights[0] + triangle.x1 * weights[1] + triangle.x2 * weights[2];
            const z =
              triangle.z0 * weights[0] + triangle.z1 * weights[1] + triangle.z2 * weights[2];
            probes += 1;
            let hits = 0;
            for (const candidate of routeIndex.candidates(x, z, x, z)) {
              const bary = barycentricXZ(routeIndex.triangles[candidate]!, x, z);
              if (!bary) continue;
              if (bary[0] >= -1e-7 && bary[1] >= -1e-7 && bary[2] >= -1e-7) hits += 1;
            }
            if (hits === 0) uncovered += 1;
          }
          for (const weights of EDGE_WEIGHTS) {
            const x =
              triangle.x0 * weights[0] + triangle.x1 * weights[1] + triangle.x2 * weights[2];
            const z =
              triangle.z0 * weights[0] + triangle.z1 * weights[1] + triangle.z2 * weights[2];
            edgeProbes += 1;
            let hits = 0;
            for (const candidate of routeIndex.candidates(x, z, x, z)) {
              const bary = barycentricXZ(routeIndex.triangles[candidate]!, x, z);
              if (!bary) continue;
              if (bary[0] >= -1e-5 && bary[1] >= -1e-5 && bary[2] >= -1e-5) hits += 1;
            }
            if (hits === 0) uncoveredEdges += 1;
          }
        }
        expect(probes, `${label} authored interiors`).toBeGreaterThan(100);
        expect(uncovered, `${label} uncovered authored interiors`).toBe(0);
        expect(edgeProbes, `${label} authored edges`).toBeGreaterThan(100);
        expect(uncoveredEdges, `${label} uncovered authored edges`).toBe(0);

        let overlapArea = 0;
        for (let index = 0; index < route.length; index += 1) {
          const triangle = route[index]!;
          const minX = Math.min(triangle.a.x, triangle.b.x, triangle.c.x);
          const maxX = Math.max(triangle.a.x, triangle.b.x, triangle.c.x);
          const minZ = Math.min(triangle.a.z, triangle.b.z, triangle.c.z);
          const maxZ = Math.max(triangle.a.z, triangle.b.z, triangle.c.z);
          for (const candidate of routeIndex.candidates(minX, minZ, maxX, maxZ)) {
            if (candidate <= index) continue;
            const piece = clipPolygonToTriangleXZ(
              [
                { x: triangle.a.x, z: triangle.a.z },
                { x: triangle.b.x, z: triangle.b.z },
                { x: triangle.c.x, z: triangle.c.z },
              ],
              routeIndex.triangles[candidate]!,
            );
            if (piece.length < 3) continue;
            const area = Math.abs(doubleSignedAreaXZ(piece)) / 2;
            if (area > 1e-6) overlapArea += area;
          }
        }
        expect(overlapArea, `${label} overlapping interiors`).toBeLessThan(authoredArea * 0.01);
        shape.terrain.dispose();
      });
    }
  }

  it("shades the route from the ground's own normals, not per clipped facet", () => {
    const blueprint = fixture("switchback", 41);
    const shape = buildIslandGeometry(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    const normal = shape.terrain.getAttribute("normal");
    const index = shape.terrain.getIndex()!;
    const top = meshTriangles(shape, 0, shape.counts.topTriangles);
    const ground = buildSurfaceTriangleIndex(
      top.map(asSurface),
      Math.max(0.5, blueprint.bounds.maxHalf * 0.06),
    );

    const from = shape.counts.topTriangles * 3;
    const to = from + shape.counts.routeTriangles * 3;
    const routeVertices = new Set<number>();
    for (let slot = from; slot < to; slot += 1) routeVertices.add(index.getX(slot));
    expect(routeVertices.size).toBeGreaterThan(100);

    let worstAgainstTerrain = 0;
    let compared = 0;
    let worstNeighbourAngle = 0;
    const byCell = new Map<string, THREE.Vector3[]>();
    for (const vertex of routeVertices) {
      const direction = new THREE.Vector3().fromBufferAttribute(normal, vertex);
      expect(Number.isFinite(direction.x + direction.y + direction.z)).toBe(true);
      expect(direction.length()).toBeCloseTo(1, 5);
      expect(direction.y, "route normals face up").toBeGreaterThan(0);
      const x = position.getX(vertex);
      const z = position.getZ(vertex);
      for (const candidate of ground.candidates(x, z, x, z)) {
        const triangle = ground.triangles[candidate]!;
        const weights = barycentricXZ(triangle, x, z);
        if (!weights) continue;
        if (weights[0] < -1e-5 || weights[1] < -1e-5 || weights[2] < -1e-5) continue;
        const n0 = new THREE.Vector3().fromBufferAttribute(normal, triangle.i0);
        const n1 = new THREE.Vector3().fromBufferAttribute(normal, triangle.i1);
        const n2 = new THREE.Vector3().fromBufferAttribute(normal, triangle.i2);
        const terrain = new THREE.Vector3(
          n0.x * weights[0] + n1.x * weights[1] + n2.x * weights[2],
          n0.y * weights[0] + n1.y * weights[1] + n2.y * weights[2],
          n0.z * weights[0] + n1.z * weights[1] + n2.z * weights[2],
        ).normalize();
        worstAgainstTerrain = Math.max(worstAgainstTerrain, direction.angleTo(terrain));
        compared += 1;
        break;
      }
      const key = `${Math.round(x * 4)}:${Math.round(z * 4)}`;
      const bucket = byCell.get(key);
      if (bucket) bucket.push(direction);
      else byCell.set(key, [direction]);
    }
    expect(compared).toBeGreaterThan(100);
    expect((worstAgainstTerrain * 180) / Math.PI).toBeLessThan(0.5);
    for (const bucket of byCell.values()) {
      for (let other = 1; other < bucket.length; other += 1) {
        worstNeighbourAngle = Math.max(worstNeighbourAngle, bucket[0]!.angleTo(bucket[other]!));
      }
    }
    expect((worstNeighbourAngle * 180) / Math.PI).toBeLessThan(6);
    shape.terrain.dispose();
  });

  it("keeps the mesh one draw with a bounded route share", () => {
    for (const lessonCount of LESSON_COUNTS) {
      const blueprint = fixture("serpentine", lessonCount);
      const started = performance.now();
      const shape = buildIslandGeometry(blueprint, "course");
      const elapsed = performance.now() - started;
      const index = shape.terrain.getIndex()!;
      expect(index.count / 3, `${lessonCount} total`).toBe(shape.counts.total);
      expect(
        shape.counts.topTriangles + shape.counts.routeTriangles + shape.counts.cliffTriangles,
        `${lessonCount} split`,
      ).toBe(shape.counts.total);
      const authored = (blueprint.centerline.length - 1) * 6;
      // Clipping subdivides each authored triangle against the lattice; it
      // must not explode into a second terrain.
      expect(shape.counts.routeTriangles, `${lessonCount} route growth`).toBeLessThan(
        Math.max(authored * 8, shape.counts.topTriangles * 2),
      );
      expect(elapsed, `${lessonCount} build ms`).toBeLessThan(2_500);
      shape.terrain.dispose();
    }
  });
});
