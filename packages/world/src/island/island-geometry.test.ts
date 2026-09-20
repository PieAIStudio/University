import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { ISLAND_ROUTE_ARCHETYPES, islandBlueprint } from "./island-blueprint.js";
import {
  buildIslandGeometry,
  ISLAND_GEOMETRY_PALETTE,
  islandCliffDarkFor,
  islandGeometryKey,
  sampleIslandTerrainTop,
} from "./island-geometry.js";

const blueprint = islandBlueprint({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
  routeArchetype: "switchback",
  themeSelection: {
    naturalBasePackId: "nature-kit",
    accentPackIds: ["fantasy-town-kit"],
    recipeId: "R01-forest-academy",
  },
});

function dispose(shape: ReturnType<typeof buildIslandGeometry>): void {
  shape.terrain.dispose();
}

const CLIFF_RING_COUNT = 5;

function expectedCliffTriangles(shape: ReturnType<typeof buildIslandGeometry>, segments: number) {
  const { panelCount, panelStats } = shape.terrain.userData.cliffTopology;
  expect(panelStats.bevelled + panelStats.plain).toBe(panelCount * 3 + panelStats.divided);
  expect(panelStats.bevelled).toBeGreaterThanOrEqual(panelCount * 2);
  return segments * 21 + panelCount * 18 + panelStats.divided * 6 - panelStats.plain * 10;
}

/** Same per-vertex/per-face limits, without constructing millions of matcher
 * objects on the valid path. Failures still identify the exact fixture and
 * offending vertex/face; no sample, timeout or tolerance is weakened. */
function geometryInvariant(valid: boolean, context: string, value?: number): void {
  if (!valid) throw new Error(`${context}${value === undefined ? "" : `: ${value}`}`);
}

function projectionSegments(
  blueprint: ReturnType<typeof islandBlueprint>,
  detail: "course" | "world",
): number {
  return detail === "course"
    ? blueprint.outline.length
    : Math.min(32, Math.max(16, blueprint.outline.length));
}

function cliffRingsFromMesh(
  shape: ReturnType<typeof buildIslandGeometry>,
  segments: number,
): {
  readonly rings: readonly (readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[])[];
  readonly ringIds: readonly (readonly number[])[];
  readonly bottom: { readonly x: number; readonly y: number; readonly z: number };
} {
  const position = shape.terrain.getAttribute("position");
  const index = shape.terrain.getIndex()!;
  const topology = shape.terrain.userData.cliffTopology;
  const ringIds: number[][] = topology.ringIndices;
  expect(ringIds).toHaveLength(CLIFF_RING_COUNT);
  for (const ring of ringIds) {
    expect(ring).toHaveLength(segments);
    expect(ring.every((id) => Number.isInteger(id) && id >= 0 && id < position.count)).toBe(true);
  }
  const rings = ringIds.map((ring) =>
    ring.map((id) => ({
      x: position.getX(id),
      y: position.getY(id),
      z: position.getZ(id),
    })),
  );
  const bottomId = topology.bottomIndex;
  expect(index.getX(topology.bottomStart)).toBe(bottomId);
  return {
    rings,
    ringIds,
    bottom: {
      x: position.getX(bottomId),
      y: position.getY(bottomId),
      z: position.getZ(bottomId),
    },
  };
}

function ringScaleFactors(
  lip: readonly { readonly x: number; readonly z: number }[],
  ring: readonly { readonly x: number; readonly z: number }[],
  axis: { readonly x: number; readonly z: number },
): number[] {
  return ring.map((point, index) => {
    const coast = Math.hypot(lip[index]!.x - axis.x, lip[index]!.z - axis.z);
    return coast < 1e-8 ? 0 : Math.hypot(point.x - axis.x, point.z - axis.z) / coast;
  });
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function triangleCross(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  first: number,
  second: number,
  third: number,
): readonly [number, number, number] {
  const abx = position.getX(second) - position.getX(first);
  const aby = position.getY(second) - position.getY(first);
  const abz = position.getZ(second) - position.getZ(first);
  const acx = position.getX(third) - position.getX(first);
  const acy = position.getY(third) - position.getY(first);
  const acz = position.getZ(third) - position.getZ(first);
  return [aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx];
}

function edgeBoundary(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: THREE.BufferAttribute,
  start: number,
  end: number,
): { readonly open: readonly string[]; readonly nonManifold: number } {
  const edges = new Map<string, { readonly a: number; readonly b: number; count: number }>();
  const pointKeys: Array<string | undefined> = [];
  const pointKey = (id: number): string =>
    (pointKeys[id] ??= [position.getX(id), position.getY(id), position.getZ(id)]
      .map((value) => Math.round(value * 1e5))
      .join(","));
  for (let face = start; face < end; face += 3) {
    for (let corner = 0; corner < 3; corner += 1) {
      const a = index.getX(face + corner);
      const b = index.getX(face + ((corner + 1) % 3));
      const pointA = pointKey(a);
      const pointB = pointKey(b);
      const key = pointA < pointB ? `${pointA}/${pointB}` : `${pointB}/${pointA}`;
      const edge = edges.get(key);
      if (edge) edge.count += 1;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  return {
    open: [...edges.values()]
      .filter((edge) => edge.count === 1)
      .map((edge) => [pointKey(edge.a), pointKey(edge.b)].sort().join("/"))
      .sort(),
    nonManifold: [...edges.values()].filter((edge) => edge.count > 2).length,
  };
}

function rootLightStats(
  shape: ReturnType<typeof buildIslandGeometry>,
  blueprint: ReturnType<typeof islandBlueprint>,
  detail: "course" | "world",
): {
  readonly rings: readonly (readonly {
    readonly scale: number;
    readonly light: number;
  }[])[];
  readonly bottom: { readonly x: number; readonly y: number; readonly z: number };
} {
  const colour = shape.terrain.getAttribute("color");
  const segments = projectionSegments(blueprint, detail);
  const cliff = cliffRingsFromMesh(shape, segments);
  const rings = cliff.rings.map((ring, ringIndex) => {
    const scales = ringScaleFactors(cliff.rings[0]!, ring, cliff.bottom);
    return ring.map((_, index) => {
      const id = cliff.ringIds[ringIndex]![index]!;
      return {
        scale: scales[index]!,
        light: luminance(colour.getX(id), colour.getY(id), colour.getZ(id)),
      };
    });
  });
  return { rings, bottom: cliff.bottom };
}

describe("Island geometry projections", () => {
  it.each(ISLAND_ROUTE_ARCHETYPES)(
    "keeps finite, correctly indexed upward terrain across seeds and sizes: %s",
    (routeArchetype) => {
      for (const lessonCount of [6, 12, 24, 41]) {
        for (const seed of ["coast", "upland", "grove"]) {
          const blueprint = islandBlueprint({
            studyId: "mesh-envelope",
            courseId: `course-${lessonCount}`,
            lessonCount,
            routeArchetype,
            seed: `mesh-envelope/${routeArchetype}/${lessonCount}/${seed}`,
          });
          const shape = buildIslandGeometry(blueprint, "course");
          try {
            const mesh = shape.terrain;
            const positions = mesh.getAttribute("position");
            const indices = mesh.getIndex()!;
            const context = `${routeArchetype}/${lessonCount}/${seed}`;
            for (const name of ["position", "normal", "color"]) {
              expect(
                Array.from(mesh.getAttribute(name).array).every(Number.isFinite),
                context,
              ).toBe(true);
            }
            expect(indices.count % 3, context).toBe(0);
            let topFaces = 0;
            let invalidFaces = 0;
            for (let face = 0; face < indices.count; face += 3) {
              const [a, b, c] = [
                indices.getX(face),
                indices.getX(face + 1),
                indices.getX(face + 2),
              ];
              if (
                ![a!, b!, c!].every((id) => Number.isInteger(id) && id >= 0 && id < positions.count)
              ) {
                invalidFaces += 1;
                continue;
              }
              // Membership comes from the builder's index range, not normals:
              // an inverted face must not exclude itself from this check.
              if (face >= shape.counts.topTriangles * 3) continue;
              topFaces += 1;
              const crossY =
                (positions.getZ(b!) - positions.getZ(a!)) *
                  (positions.getX(c!) - positions.getX(a!)) -
                (positions.getX(b!) - positions.getX(a!)) *
                  (positions.getZ(c!) - positions.getZ(a!));
              if (crossY < -1e-8) invalidFaces += 1;
            }
            expect(topFaces, context).toBeGreaterThan(100);
            expect(invalidFaces, context).toBe(0);

            const boundary = (start: number, end: number) => {
              const edges = new Map<string, { a: number; b: number; count: number }>();
              const vertex = (id: number) =>
                [positions.getX(id), positions.getY(id), positions.getZ(id)]
                  .map((value) => Math.round(value * 1e5))
                  .join(",");
              for (let face = start; face < end; face += 3) {
                for (let corner = 0; corner < 3; corner += 1) {
                  const a = indices.getX(face + corner);
                  const b = indices.getX(face + ((corner + 1) % 3));
                  const pointA = vertex(a);
                  const pointB = vertex(b);
                  const key = pointA < pointB ? `${pointA}/${pointB}` : `${pointB}/${pointA}`;
                  const edge = edges.get(key);
                  if (edge) edge.count += 1;
                  else edges.set(key, { a, b, count: 1 });
                }
              }
              expect(
                [...edges.values()].every((edge) => edge.count <= 2),
                context,
              ).toBe(true);
              return [...edges.values()]
                .filter((edge) => edge.count === 1)
                .map(({ a, b }) => [vertex(a), vertex(b)].sort().join("/"))
                .sort();
            };
            const coast = boundary(0, shape.counts.topTriangles * 3);
            const cliffLip = boundary(
              (shape.counts.topTriangles + shape.counts.routeTriangles) * 3,
              indices.count,
            );
            // Separate shading vertices are intentional. Their open boundaries
            // must coincide: an interior hole, missing cliff face or split lip fails.
            expect(coast.length, context).toBeGreaterThan(12);
            expect(cliffLip, context).toEqual(coast);

            const segments = projectionSegments(blueprint, "course");
            const cliff = cliffRingsFromMesh(shape, segments);
            const topRings = (shape.counts.topTriangles / segments + 1) / 2;
            const outerStart = 1 + (topRings - 1) * segments;
            for (let index = 0; index < segments; index += 1) {
              const lip = cliff.rings[0]![index]!;
              // The near projection owns a real shallow sod edge, not a
              // multi-metre green wall. The deeper five-ring root still obeys
              // the original contraction, winding and depth assertions.
              const sodDepth = lip.y - cliff.rings[1]![index]!.y;
              expect(sodDepth, `${context} shallow turf ${index}`).toBeGreaterThan(0.1);
              expect(sodDepth, `${context} shallow turf ${index}`).toBeLessThan(0.55);
              expect(positions.getX(outerStart + index), `${context} lip x ${index}`).toBeCloseTo(
                lip.x,
                5,
              );
              expect(positions.getY(outerStart + index), `${context} lip y ${index}`).toBeCloseTo(
                lip.y,
                5,
              );
              expect(positions.getZ(outerStart + index), `${context} lip z ${index}`).toBeCloseTo(
                lip.z,
                5,
              );
            }

            const means: number[] = [];
            let minY = Infinity;
            let maxY = -Infinity;
            for (let ring = 0; ring < CLIFF_RING_COUNT; ring += 1) {
              const scales = ringScaleFactors(cliff.rings[0]!, cliff.rings[ring]!, cliff.bottom);
              means.push(mean(scales));
              for (let index = 0; index < segments; index += 1) {
                const point = cliff.rings[ring]![index]!;
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
                const next = scales[(index + 1) % segments]!;
                expect(
                  Math.abs(scales[index]! - next),
                  `${context} spike ring ${ring} sector ${index}`,
                ).toBeLessThan(0.14);
              }
              if (ring >= 3) {
                expect(
                  Math.max(...scales) - Math.min(...scales),
                  `${context} root variation ring ${ring}`,
                ).toBeGreaterThan(0.12);
              }
            }
            for (let ring = 0; ring < CLIFF_RING_COUNT - 1; ring += 1) {
              expect(means[ring]!, `${context} contract ${ring}`).toBeGreaterThan(
                means[ring + 1]! + 0.015,
              );
            }
            expect(means[1]!, `${context} thick collar`).toBeGreaterThan(0.9);
            expect(means[2]!, `${context} thick body`).toBeGreaterThan(0.78);
            expect(Number.isFinite(cliff.bottom.x), context).toBe(true);
            expect(Number.isFinite(cliff.bottom.y), context).toBe(true);
            expect(Number.isFinite(cliff.bottom.z), context).toBe(true);
            expect(cliff.bottom.y, `${context} root tip`).toBeLessThan(
              Math.min(...cliff.rings[CLIFF_RING_COUNT - 1]!.map((point) => point.y)) + 1e-6,
            );
            for (let index = 0; index < positions.count; index += 1) {
              minY = Math.min(minY, positions.getY(index));
              maxY = Math.max(maxY, positions.getY(index));
            }
            expect(maxY, `${context} top extrema`).toBeGreaterThan(0.4);
            expect(Number.isFinite(minY), `${context} root finite`).toBe(true);
            expect(Number.isFinite(shape.bounds.depth), `${context} bounds finite`).toBe(true);
            expect(shape.bounds.depth, `${context} real bounds`).toBeCloseTo(-minY, 5);
            expect(minY, `${context} root extrema`).toBeLessThan(-shape.bounds.depth * 0.7);
            expect(shape.counts.cliffTriangles, context).toBe(
              expectedCliffTriangles(shape, segments),
            );
          } finally {
            dispose(shape);
          }
        }
      }
    },
  );

  it("keeps both projections finite, closed, and depth-aligned across the 60-shape matrix", () => {
    for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES) {
      for (const lessonCount of [6, 12, 24, 41]) {
        for (const seed of ["coast", "upland", "grove"]) {
          const blueprint = islandBlueprint({
            studyId: "mesh-contract",
            courseId: `course-${lessonCount}`,
            lessonCount,
            routeArchetype,
            seed: `mesh-contract/${routeArchetype}/${lessonCount}/${seed}`,
          });
          const context = `${routeArchetype}/${lessonCount}/${seed}`;
          const projected: Partial<
            Record<
              "course" | "world",
              { readonly x: number; readonly y: number; readonly z: number }
            >
          > = {};

          for (const detail of ["course", "world"] as const) {
            const shape = buildIslandGeometry(blueprint, detail);
            try {
              const mesh = shape.terrain;
              const position = mesh.getAttribute("position");
              const normal = mesh.getAttribute("normal");
              const colour = mesh.getAttribute("color");
              const index = mesh.getIndex();
              expect(index, `${context}/${detail} index`).not.toBeNull();
              if (!index) continue;

              expect(position.count, `${context}/${detail} position/color`).toBe(colour.count);
              expect(position.count, `${context}/${detail} position/normal`).toBe(normal.count);
              expect(index.count, `${context}/${detail} index triplets`).toBe(
                shape.counts.total * 3,
              );
              expect(index.count % 3, `${context}/${detail} index alignment`).toBe(0);
              expect(
                Array.from(position.array).every(Number.isFinite) &&
                  Array.from(normal.array).every(Number.isFinite) &&
                  Array.from(colour.array).every(Number.isFinite) &&
                  Array.from(index.array).every(Number.isFinite),
                `${context}/${detail} finite buffers`,
              ).toBe(true);

              let minY = Infinity;
              let maxY = -Infinity;
              for (let vertex = 0; vertex < position.count; vertex += 1) {
                const y = position.getY(vertex);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                const normalLength = Math.hypot(
                  normal.getX(vertex),
                  normal.getY(vertex),
                  normal.getZ(vertex),
                );
                geometryInvariant(
                  normalLength > 0.5,
                  `${context}/${detail} normal ${vertex} > 0.5`,
                  normalLength,
                );
              }
              expect(maxY, `${context}/${detail} vertical span`).toBeGreaterThan(minY);
              expect(shape.bounds.depth, `${context}/${detail} real minY`).toBeCloseTo(-minY, 5);
              const relativeDepth = -minY / shape.scale / blueprint.bounds.maxHalf;
              expect(relativeDepth, `${context}/${detail} authored depth`).toBeGreaterThan(1.1);
              expect(relativeDepth, `${context}/${detail} authored depth`).toBeLessThan(1.41);

              const segments = projectionSegments(blueprint, detail);
              const cliffStart = (shape.counts.topTriangles + shape.counts.routeTriangles) * 3;
              const cliffBottomStart = index.count - segments * 3;
              const capIndex = index.getX(cliffBottomStart);
              const rootAxis = { x: position.getX(capIndex), z: position.getZ(capIndex) };
              for (let face = 0; face < index.count; face += 3) {
                const first = index.getX(face);
                const second = index.getX(face + 1);
                const third = index.getX(face + 2);
                geometryInvariant(
                  [first, second, third].every(
                    (vertex) => Number.isInteger(vertex) && vertex >= 0 && vertex < position.count,
                  ),
                  `${context}/${detail} face ${face / 3} indices`,
                );
                const cross = triangleCross(position, first, second, third);
                const area = Math.hypot(cross[0], cross[1], cross[2]);
                geometryInvariant(
                  area > 1e-12,
                  `${context}/${detail} face ${face / 3} area > 1e-12`,
                  area,
                );
                if (face < shape.counts.topTriangles * 3) {
                  geometryInvariant(
                    cross[1] > 1e-10,
                    `${context}/${detail} top face ${face / 3} winding > 1e-10`,
                    cross[1],
                  );
                } else if (face >= cliffStart && face < cliffBottomStart) {
                  const centreX =
                    (position.getX(first) + position.getX(second) + position.getX(third)) / 3 -
                    rootAxis.x;
                  const centreZ =
                    (position.getZ(first) + position.getZ(second) + position.getZ(third)) / 3 -
                    rootAxis.z;
                  // The offset root's kernel is the interior reference, not
                  // the world origin, which can lie outside a lower ring.
                  // Consistency across faces is independently checked by
                  // the directed-edge regression, not repaired by flips.
                  const radial = Math.hypot(centreX, centreZ);
                  const outward = (cross[0] * centreX + cross[2] * centreZ) / radial;
                  geometryInvariant(
                    outward > 1e-8,
                    `${context}/${detail} cliff face ${face / 3} outward winding > 1e-8`,
                    outward,
                  );
                  const crossLength = Math.hypot(cross[0], cross[1], cross[2]);
                  const normalLength = Math.hypot(
                    normal.getX(first),
                    normal.getY(first),
                    normal.getZ(first),
                  );
                  const normalAlignment =
                    (cross[0] * normal.getX(first) +
                      cross[1] * normal.getY(first) +
                      cross[2] * normal.getZ(first)) /
                    (crossLength * normalLength);
                  geometryInvariant(
                    normalAlignment > 0.4,
                    `${context}/${detail} cliff face ${face / 3} normal alignment > 0.4`,
                    normalAlignment,
                  );
                } else if (face >= cliffBottomStart) {
                  geometryInvariant(
                    cross[1] < -1e-10,
                    `${context}/${detail} bottom face ${face / 3} winding < -1e-10`,
                    cross[1],
                  );
                  geometryInvariant(
                    normal.getY(first) < -0.99,
                    `${context}/${detail} bottom face ${face / 3} normal < -0.99`,
                    normal.getY(first),
                  );
                }
              }

              const topEnd = shape.counts.topTriangles * 3;
              const topBoundary = edgeBoundary(position, index, 0, topEnd);
              const cliffBoundary = edgeBoundary(position, index, cliffStart, index.count);
              expect(topBoundary.nonManifold, `${context}/${detail} top manifold`).toBe(0);
              expect(cliffBoundary.nonManifold, `${context}/${detail} cliff manifold`).toBe(0);
              expect(topBoundary.open.length, `${context}/${detail} shoreline`).toBeGreaterThan(12);
              expect(cliffBoundary.open, `${context}/${detail} closed cliff boundary`).toEqual(
                topBoundary.open,
              );

              expect(shape.counts.cliffTriangles, `${context}/${detail} cliff capacity`).toBe(
                expectedCliffTriangles(shape, segments),
              );
              const root = rootLightStats(shape, blueprint, detail);
              const rootScales = root.rings[CLIFF_RING_COUNT - 1]!.map((point) => point.scale);
              const ringOneLight = mean(root.rings[1]!.map((point) => point.light));
              const rootLight = root.rings[CLIFF_RING_COUNT - 1]!;
              const lastBandIds = cliffRingsFromMesh(shape, segments).ringIds[
                CLIFF_RING_COUNT - 2
              ]!;
              const adjacentNormalDeltas = Array.from({ length: segments }, (_, sector) => {
                const firstVertex = lastBandIds[sector]!;
                const nextVertex = lastBandIds[(sector + 1) % segments]!;
                return Math.hypot(
                  normal.getX(firstVertex) - normal.getX(nextVertex),
                  normal.getY(firstVertex) - normal.getY(nextVertex),
                  normal.getZ(firstVertex) - normal.getZ(nextVertex),
                );
              });
              expect(
                Math.max(...adjacentNormalDeltas),
                `${context}/${detail} cliff geological normal boundaries`,
              ).toBeGreaterThan(0.02);
              expect(
                Math.max(...rootScales) - Math.min(...rootScales),
                `${context}/${detail} root silhouette variation`,
              ).toBeGreaterThan(0.1);
              expect(
                Math.max(
                  ...rootScales.map((scale, index) =>
                    Math.abs(scale - rootScales[(index + Math.floor(segments / 2)) % segments]!),
                  ),
                ),
                `${context}/${detail} root non-axis variation`,
              ).toBeGreaterThan(0.04);
              expect(
                Math.min(...rootLight.map((point) => point.light)),
                `${context}/${detail} root value floor`,
              ).toBeGreaterThan(0.12);
              expect(
                ringOneLight - mean(rootLight.map((point) => point.light)),
                `${context}/${detail} root depth strata`,
              ).toBeGreaterThan(0.06);
              expect(root.bottom.y, `${context}/${detail} root tip`).toBeLessThan(
                Math.min(
                  ...cliffRingsFromMesh(shape, segments).rings[CLIFF_RING_COUNT - 1]!.map(
                    (point) => point.y,
                  ),
                ) + 1e-6,
              );

              const bottomRadius = Math.hypot(root.bottom.x, root.bottom.z);
              expect(
                bottomRadius / shape.scale / blueprint.bounds.maxHalf,
                `${context}/${detail} root tip offset`,
              ).toBeGreaterThan(0.03);
              expect(
                bottomRadius / shape.scale / blueprint.bounds.maxHalf,
                `${context}/${detail} root tip offset`,
              ).toBeLessThanOrEqual(0.12 + 1e-6);
              projected[detail] = {
                x: root.bottom.x / shape.scale / blueprint.bounds.maxHalf,
                y: root.bottom.y / shape.scale / blueprint.bounds.maxHalf,
                z: root.bottom.z / shape.scale / blueprint.bounds.maxHalf,
              };

              if (detail === "world") {
                expect(shape.counts.topTriangles, `${context}/world top budget`).toBe(352);
                expect(
                  shape.counts.cliffTriangles,
                  `${context}/world cliff budget`,
                ).toBeLessThanOrEqual(1248);
                expect(shape.counts.total, `${context}/world total budget`).toBeLessThanOrEqual(
                  1600,
                );
              }
            } finally {
              dispose(shape);
            }
          }

          expect(projected.course?.y, `${context} course/world depth source`).toBeCloseTo(
            projected.world?.y ?? NaN,
            5,
          );
        }
      }
    }
  });

  it("keeps meadow, route soil, and rock in separate warm value bands", () => {
    const meadow = new THREE.Color(ISLAND_GEOMETRY_PALETTE.grass);
    const soil = new THREE.Color(ISLAND_GEOMETRY_PALETTE.soilHint);
    const rock = new THREE.Color(ISLAND_GEOMETRY_PALETTE.rock);
    const meadowHsl = { h: 0, s: 0, l: 0 };
    const soilHsl = { h: 0, s: 0, l: 0 };
    const rockHsl = { h: 0, s: 0, l: 0 };
    meadow.getHSL(meadowHsl);
    soil.getHSL(soilHsl);
    rock.getHSL(rockHsl);

    // These are broad art-direction guards, not exact screenshots: the route
    // must be the light cream band and exposed slopes must be visibly brown.
    expect(soilHsl.l).toBeGreaterThan(meadowHsl.l);
    expect(soilHsl.h).toBeGreaterThan(0.06);
    expect(soilHsl.h).toBeLessThan(0.16);
    expect(rockHsl.h).toBeGreaterThan(0.03);
    expect(rockHsl.h).toBeLessThan(0.1);
    expect(rockHsl.s).toBeGreaterThan(0.25);
  });

  it("compiles one finite terrain mesh with the route colour baked into its surface", () => {
    const shape = buildIslandGeometry(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    const colour = shape.terrain.getAttribute("color");

    expect(position.count).toBeGreaterThan(0);
    expect(colour.count).toBe(position.count);
    for (let index = 0; index < position.count; index += 1) {
      geometryInvariant(
        [
          position.getX(index),
          position.getY(index),
          position.getZ(index),
          colour.getX(index),
          colour.getY(index),
          colour.getZ(index),
        ].every(Number.isFinite),
        `compiled terrain vertex ${index} finite`,
      );
    }

    // There is deliberately no independent road/shoulder/path object. The
    // route is part of the same terrain colour field and grass exclusion rule.
    expect("path" in shape).toBe(false);
    dispose(shape);
  });

  it("keeps terrain colour deterministic for one blueprint", () => {
    const first = buildIslandGeometry(blueprint, "course");
    const second = buildIslandGeometry(blueprint, "course");

    expect(Array.from(first.terrain.getAttribute("color").array)).toEqual(
      Array.from(second.terrain.getAttribute("color").array),
    );
    dispose(first);
    dispose(second);
  });

  it("keeps each projection's underside in its own palette family", () => {
    const first = islandBlueprint({
      studyId: "turing-pact",
      courseId: "underside-green",
      lessonCount: 12,
      seed: "underside-green",
    });
    const second = islandBlueprint({
      studyId: "turing-pact",
      courseId: "underside-warm",
      lessonCount: 12,
      seed: "underside-warm",
    });
    expect(islandCliffDarkFor(first)).not.toBe(islandCliffDarkFor(second));
  });

  it("samples the same top-mesh height used by overlay roots", () => {
    const shape = buildIslandGeometry(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    // The vertices are read out of the mesh rather than reconstructed from a
    // hard-coded ring table. The earlier version of this test spelled out the
    // radials 0.06 and 0.65 and the index arithmetic that went with a
    // thirteen-ring fan, so raising the ring count silently pointed it at
    // vertices that were no longer where it thought they were and it failed
    // for a reason that had nothing to do with the invariant it exists to
    // protect. The invariant is that an overlay root placed at a top vertex's
    // x/z gets that vertex's height back.
    const centre = { x: position.getX(0), y: position.getY(0), z: position.getZ(0) };
    expect(centre.x).toBeCloseTo(0, 9);
    expect(centre.z).toBeCloseTo(0, 9);
    const samples = [0, 137, 1601, 3407];

    for (const index of samples) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const top = sampleIslandTerrainTop(blueprint, "course", x, z);
      expect(top.inside, `vertex ${index}`).toBe(true);
      expect(top.y, `vertex ${index}`).toBeCloseTo(position.getY(index), 6);
    }
    dispose(shape);
  });

  it("keeps course and world roots on the same authored depth and reports real minY", () => {
    const course = buildIslandGeometry(blueprint, "course");
    const world = buildIslandGeometry(blueprint, "world");
    try {
      const minYOf = (shape: typeof course) => {
        const position = shape.terrain.getAttribute("position");
        let minY = Infinity;
        for (let index = 0; index < position.count; index += 1) {
          const y = position.getY(index);
          geometryInvariant(Number.isFinite(y), `terrain vertex ${index} finite y`, y);
          minY = Math.min(minY, y);
        }
        return minY;
      };
      const courseMinY = minYOf(course);
      const worldMinY = minYOf(world);
      expect(course.bounds.depth).toBeCloseTo(-courseMinY, 5);
      expect(world.bounds.depth).toBeCloseTo(-worldMinY, 5);
      expect(courseMinY / course.scale).toBeCloseTo(worldMinY / world.scale, 5);
      expect(Math.abs(courseMinY / course.scale)).toBeCloseTo(blueprint.underside.depth * 1.08, 4);
      expect("path" in course).toBe(false);
      expect(course.counts.cliffTriangles).toBe(
        expectedCliffTriangles(course, projectionSegments(blueprint, "course")),
      );
      expect(world.counts.cliffTriangles).toBe(
        expectedCliffTriangles(world, projectionSegments(blueprint, "world")),
      );
    } finally {
      dispose(course);
      dispose(world);
    }
  });

  it("uses semantic LOD without creating a miniature road mesh", () => {
    const targetRadius = 3.2;
    const course = buildIslandGeometry(blueprint, "course");
    const world = buildIslandGeometry(blueprint, "world", targetRadius);

    expect(world.scale).toBeCloseTo(targetRadius / blueprint.bounds.maxHalf, 8);
    expect(world.bounds.halfX).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.bounds.halfZ).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.terrain.getAttribute("position").count).toBeLessThan(
      course.terrain.getAttribute("position").count,
    );
    expect("path" in course).toBe(false);
    expect("path" in world).toBe(false);
    expect(islandGeometryKey(blueprint, "world", targetRadius)).not.toBe(
      islandGeometryKey(blueprint, "course"),
    );
    dispose(course);
    dispose(world);
  });

  it("paints the coast from local slope instead of a constant-width sand halo", () => {
    const shape = buildIslandGeometry(blueprint, "course");
    const colour = shape.terrain.getAttribute("color");
    const segments = projectionSegments(blueprint, "course");
    const topRings = (shape.counts.topTriangles / segments + 1) / 2;
    const outerStart = 1 + (topRings - 1) * segments;
    const innerStart = 1 + Math.floor(topRings * 0.5) * segments;
    let outerSand = 0;
    let outerGrass = 0;
    let innerGrass = 0;
    for (let index = 0; index < segments; index += 1) {
      const outerR = colour.getX(outerStart + index);
      const outerG = colour.getY(outerStart + index);
      if (outerG > outerR + 0.02) outerGrass += 1;
      if (outerR > outerG + 0.06 && outerR > 0.72) outerSand += 1;
      const innerR = colour.getX(innerStart + index);
      const innerG = colour.getY(innerStart + index);
      if (innerG > innerR) innerGrass += 1;
    }
    expect(innerGrass / segments).toBeGreaterThan(0.7);
    expect(outerGrass / segments).toBeGreaterThan(0.25);
    expect(outerSand / segments).toBeLessThan(0.55);
    dispose(shape);
  });

  it("keeps the lower cliff modelled as rock with thickness variation, not a black cone", () => {
    for (const detail of ["course", "world"] as const) {
      const shape = buildIslandGeometry(blueprint, detail);
      try {
        const segments = projectionSegments(blueprint, detail);
        const colour = shape.terrain.getAttribute("color");
        const cliff = cliffRingsFromMesh(shape, segments);
        const last = cliff.rings[CLIFF_RING_COUNT - 1]!;
        const scales = ringScaleFactors(cliff.rings[0]!, last, cliff.bottom);
        expect(Math.max(...scales) - Math.min(...scales), detail).toBeGreaterThan(0.12);
        const lights: number[] = [];
        for (let index = 0; index < segments; index += 1) {
          const id = cliff.ringIds[CLIFF_RING_COUNT - 1]![index]!;
          lights.push(luminance(colour.getX(id), colour.getY(id), colour.getZ(id)));
        }
        expect(Math.min(...lights), `${detail} not crushed black`).toBeGreaterThan(0.08);
        expect(Math.max(...lights) - Math.min(...lights), `${detail} root tone`).toBeGreaterThan(
          0.025,
        );
        if (detail === "world") {
          expect(shape.counts.topTriangles).toBe(352);
          expect(shape.counts.cliffTriangles).toBe(expectedCliffTriangles(shape, segments));
          expect(shape.counts.total).toBeLessThanOrEqual(1600);
          expect(
            mean(ringScaleFactors(cliff.rings[0]!, cliff.rings[2]!, cliff.bottom)),
          ).toBeGreaterThan(0.78);
        }
      } finally {
        dispose(shape);
      }
    }
  });
});

it("uses the same full-depth geological root in course and distant projections", () => {
  for (const lessonCount of [6, 24, 41]) {
    const source = islandBlueprint({
      studyId: "turing-pact",
      courseId: `root-${lessonCount}`,
      lessonCount,
    });
    const course = buildIslandGeometry(source, "course");
    const world = buildIslandGeometry(source, "world", 2);
    try {
      const depths = [course, world].map((shape) => {
        const positions = shape.terrain.getAttribute("position");
        let minY = Infinity;
        for (let i = 0; i < positions.count; i++) minY = Math.min(minY, positions.getY(i));
        expect(shape.bounds.depth).toBeCloseTo(-minY, 5);
        const relative = -minY / shape.scale / source.bounds.maxHalf;
        expect(relative).toBeGreaterThan(1.1);
        expect(relative).toBeLessThan(1.41);
        return -minY / shape.scale;
      });
      expect(depths[0]).toBeCloseTo(depths[1]!, 4);
      expect(world.counts.total).toBeLessThanOrEqual(1600);
    } finally {
      course.terrain.dispose();
      world.terrain.dispose();
    }
  }
});
