import { describe, expect, it } from "vitest";

import {
  DEFAULT_NATURAL_BASE_PACK_ID_V2,
  ISLAND_BLUEPRINT_V2_LAYOUT_REVISION,
  ISLAND_ROUTE_ARCHETYPES_V2,
  islandBlueprintV2,
  islandGeometryBlueprintV2,
  islandGeometryProjectionV2,
  projectIslandBlueprintV2,
  sampleIslandSurfaceV2,
  selectRouteArchetypeV2,
  unitVisualTokenV2,
  validateIslandBlueprintV2,
} from "./island-blueprint-v2";

const INPUT = {
  studyId: "turing-pact",
  courseId: "island-v2-fixtures",
  seed: "stable-fixture-seed",
} as const;

function distanceToSegment(
  point: { readonly x: number; readonly z: number },
  first: { readonly x: number; readonly z: number },
  second: { readonly x: number; readonly z: number },
): number {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - first.x) * dx + (point.z - first.z) * dz) / lengthSquared),
        );
  return Math.hypot(point.x - (first.x + dx * amount), point.z - (first.z + dz * amount));
}

function distanceToPolyline(
  point: { readonly x: number; readonly z: number },
  path: readonly { readonly x: number; readonly z: number }[],
): number {
  return Math.min(
    ...path.slice(1).map((next, index) => distanceToSegment(point, path[index]!, next)),
  );
}

function geometryProjection(blueprint: ReturnType<typeof islandBlueprintV2>) {
  return islandGeometryProjectionV2(blueprint);
}

function sampledRelief(blueprint: ReturnType<typeof islandBlueprintV2>): number {
  const values: number[] = [];
  for (let x = -blueprint.bounds.halfX * 0.92; x <= blueprint.bounds.halfX * 0.92; x += 1.5) {
    for (let z = -blueprint.bounds.halfZ * 0.92; z <= blueprint.bounds.halfZ * 0.92; z += 1.5) {
      const sample = sampleIslandSurfaceV2(blueprint, x, z);
      if (sample.inside) values.push(sample.y);
    }
  }
  return Math.max(...values) - Math.min(...values);
}

describe("IslandBlueprint V2", () => {
  it.each([3, 12, 24, 41])("builds a valid linear blueprint for %i lessons", (lessonCount) => {
    const blueprint = islandBlueprintV2({ ...INPUT, lessonCount });
    expect(blueprint.version).toBe(2);
    expect(blueprint.layoutRevision).toBe(ISLAND_BLUEPRINT_V2_LAYOUT_REVISION);
    expect(blueprint.lessonCount).toBe(lessonCount);
    expect(blueprint.nodes).toHaveLength(lessonCount);
    expect(blueprint.centerline.length).toBeGreaterThan(lessonCount);
    expect(blueprint.route.semantic).toBe("linear");
    expect(ISLAND_ROUTE_ARCHETYPES_V2).toContain(blueprint.route.archetype);
    expect(blueprint.route.centerlineSamples).toBe(blueprint.centerline.length);
    expect(blueprint.route.roadWidth).toBeGreaterThan(0);
    expect(blueprint.route.shoulderWidth).toBeGreaterThanOrEqual(0);
    expect(blueprint.route.nodeRadius).toBeGreaterThan(0);
    expect(blueprint.route.clearance).toBeGreaterThan(0);
    expect(blueprint.terrainPatches.length).toBeGreaterThanOrEqual(2);
    expect(blueprint.terrainPatches.length).toBeLessThanOrEqual(4);
    expect(blueprint.themeSelection).toEqual({
      naturalBasePackId: DEFAULT_NATURAL_BASE_PACK_ID_V2,
      accentPackIds: [],
    });
    expect(validateIslandBlueprintV2(blueprint)).toEqual([]);
  });

  it("keeps the authored road subordinate to the lesson stones", () => {
    const blueprint = islandBlueprintV2({ ...INPUT, lessonCount: 41 });
    const nodeDiameter = blueprint.route.nodeRadius * 2;
    const roadRatio = blueprint.route.roadWidth / nodeDiameter;
    const fullPathRatio =
      (blueprint.route.roadWidth + blueprint.route.shoulderWidth * 2) / nodeDiameter;

    expect(roadRatio).toBeGreaterThanOrEqual(0.35);
    expect(roadRatio).toBeLessThanOrEqual(0.5);
    expect(fullPathRatio).toBeLessThanOrEqual(0.58);
  });

  it("validates multiple stable seeds at every supported fixture size", () => {
    for (const seedIndex of Array.from({ length: 8 }, (_, index) => index)) {
      for (const lessonCount of [3, 12, 24, 41]) {
        const blueprint = islandBlueprintV2({
          ...INPUT,
          lessonCount,
          seed: `island-v2-seed-${seedIndex}`,
        });
        expect(validateIslandBlueprintV2(blueprint), `${lessonCount}/${seedIndex}`).toEqual([]);
      }
    }
  });

  it("keeps one ordered route and terminal next identity", () => {
    const blueprint = islandBlueprintV2({ ...INPUT, lessonCount: 41 });
    expect(blueprint.route.branchCount).toBe(0);
    expect(blueprint.nodes.map((node) => node.index)).toEqual(
      Array.from({ length: 41 }, (_, index) => index),
    );
    expect(
      blueprint.nodes
        .slice(0, -1)
        .every((node, index) => node.next === blueprint.nodes[index + 1]!.id),
    ).toBe(true);
    expect(blueprint.nodes.at(-1)?.next).toBeNull();
    expect(blueprint.nodes.every((node) => node.t >= 0 && node.t <= 1)).toBe(true);
    expect(
      blueprint.nodes.slice(1).every((node, index) => node.t > blueprint.nodes[index]!.t),
    ).toBe(true);
  });

  it("round-trips real lesson identities without rewriting them", () => {
    const lessonIds = ["lesson/arrival", "lesson/shape", "lesson/finish"];
    const blueprint = islandBlueprintV2({
      ...INPUT,
      courseId: "real-course",
      lessonIds,
      unitIds: ["unit-foundations", "unit-foundations", "unit-practice"],
    });
    expect(blueprint.lessonCount).toBe(lessonIds.length);
    expect(blueprint.nodes.map((node) => node.id)).toEqual(lessonIds);
    expect(blueprint.nodes.map((node) => node.next)).toEqual([lessonIds[1], lessonIds[2], null]);
    expect(JSON.parse(JSON.stringify(blueprint))).toEqual(blueprint);
    expect(validateIslandBlueprintV2(blueprint)).toEqual([]);
  });

  it("projects world and course semantics from one serializable geometry base", () => {
    const geometry = islandGeometryBlueprintV2({
      ...INPUT,
      courseId: "shared-course",
      lessonCount: 3,
    });
    const world = projectIslandBlueprintV2(geometry);
    const course = projectIslandBlueprintV2(geometry, {
      lessonIds: ["lesson/one", "lesson/two", "lesson/three"],
      unitIds: ["unit/one", "unit/one", "unit/two"],
    });

    expect(JSON.parse(JSON.stringify(geometry))).toEqual(geometry);
    expect(islandGeometryProjectionV2(world)).toEqual(geometry);
    expect(islandGeometryProjectionV2(course)).toEqual(geometry);
    expect(world.nodes.map((node) => node.id)).toEqual([
      "shared-course/fixture-lesson-1",
      "shared-course/fixture-lesson-2",
      "shared-course/fixture-lesson-3",
    ]);
    expect(course.nodes.map((node) => node.id)).toEqual([
      "lesson/one",
      "lesson/two",
      "lesson/three",
    ]);
    expect(course.nodes.map(({ index, t, x, y, z }) => ({ index, t, x, y, z }))).toEqual(
      geometry.geometryNodes,
    );
    expect(validateIslandBlueprintV2(world)).toEqual([]);
    expect(validateIslandBlueprintV2(course)).toEqual([]);
  });

  it("rejects malformed lesson identity input", () => {
    expect(() =>
      islandBlueprintV2({ ...INPUT, lessonCount: 3, lessonIds: ["a", "a", "b"] }),
    ).toThrow(/unique/);
    expect(() => islandBlueprintV2({ ...INPUT, lessonCount: 3, lessonIds: ["a", "b"] })).toThrow(
      /length/,
    );
    expect(() => islandBlueprintV2({ ...INPUT, lessonIds: ["a", "", "b"] })).toThrow(/non-empty/);
  });

  it("uses only the natural base by default and preserves an explicit recipe", () => {
    const naturalOnly = islandBlueprintV2({ ...INPUT, lessonCount: 12 });
    const explicit = islandBlueprintV2({
      ...INPUT,
      lessonCount: 12,
      themeSelection: {
        naturalBasePackId: "nature-kit",
        accentPackIds: ["fantasy-town-kit", "modular-space-kit"],
        recipeId: "foundations-before-zero-v1",
      },
    });
    expect(naturalOnly.themeSelection.accentPackIds).toEqual([]);
    expect(explicit.themeSelection).toEqual({
      naturalBasePackId: "nature-kit",
      accentPackIds: ["fantasy-town-kit", "modular-space-kit"],
      recipeId: "foundations-before-zero-v1",
    });
    expect(
      islandBlueprintV2({ ...INPUT, courseId: "another-course", lessonCount: 12 }).themeSelection,
    ).toEqual(naturalOnly.themeSelection);
    const broken = structuredClone(explicit);
    const mutableAccentPackIds = broken.themeSelection.accentPackIds as unknown as string[];
    mutableAccentPackIds.splice(
      0,
      mutableAccentPackIds.length,
      "fantasy-town-kit",
      "fantasy-town-kit",
      "third-pack",
    );
    expect(
      validateIslandBlueprintV2(broken).some((issue) => issue.includes("themeSelection")),
    ).toBe(true);
  });

  it("accepts an explicit compact switchback for the 41-lesson island", () => {
    const blueprint = islandBlueprintV2({
      ...INPUT,
      lessonCount: 41,
      routeArchetype: "switchback",
    });
    expect(blueprint.route.archetype).toBe("switchback");
    expect(validateIslandBlueprintV2(blueprint)).toEqual([]);
  });

  it("retains deterministic default route selection and covers all archetypes", () => {
    const seen = new Set<string>();
    for (const seedIndex of Array.from({ length: 32 }, (_, index) => index)) {
      seen.add(selectRouteArchetypeV2(12, `archetype-seed-${seedIndex}`));
    }
    expect(seen).toEqual(new Set(ISLAND_ROUTE_ARCHETYPES_V2));
  });

  it("keeps every explicit route archetype valid across fixture sizes and seeds", () => {
    for (const archetype of ISLAND_ROUTE_ARCHETYPES_V2) {
      for (const seedIndex of Array.from({ length: 8 }, (_, index) => index)) {
        for (const lessonCount of [3, 12, 24, 41]) {
          const blueprint = islandBlueprintV2({
            ...INPUT,
            lessonCount,
            seed: `explicit-${archetype}-${seedIndex}`,
            routeArchetype: archetype,
          });
          expect(
            validateIslandBlueprintV2(blueprint),
            `${archetype}/${lessonCount}/${seedIndex}`,
          ).toEqual([]);
        }
      }
    }
  });

  it("keeps the stable surface rule for nodes, centerline, and offset hero", () => {
    const blueprint = islandBlueprintV2({
      ...INPUT,
      lessonCount: 41,
      routeArchetype: "switchback",
    });
    for (const point of [...blueprint.nodes, ...blueprint.centerline, blueprint.hero]) {
      const sample = sampleIslandSurfaceV2(blueprint, point.x, point.z);
      expect(sample.inside).toBe(true);
      expect(sample.y).toBeCloseTo(point.y, 8);
      expect(Number.isFinite(sample.y)).toBe(true);
    }
    const heroRouteDistance = distanceToPolyline(blueprint.hero, blueprint.centerline);
    const expectedRouteGap =
      blueprint.route.roadWidth / 2 +
      blueprint.route.shoulderWidth +
      blueprint.route.nodeRadius +
      blueprint.route.clearance +
      blueprint.hero.radius;
    expect(heroRouteDistance).toBeGreaterThanOrEqual(expectedRouteGap - 1e-6);
    const nearestNode = Math.min(
      ...blueprint.nodes.map((node) =>
        Math.hypot(node.x - blueprint.hero.x, node.z - blueprint.hero.z),
      ),
    );
    expect(nearestNode).toBeGreaterThanOrEqual(
      blueprint.route.nodeRadius + blueprint.hero.radius + blueprint.route.clearance - 1e-6,
    );
  });

  it("rejects route self-intersection and derives non-adjacent clearance from route widths", () => {
    const blueprint = islandBlueprintV2({ ...INPUT, lessonCount: 12, routeArchetype: "arc" });
    const crossing = structuredClone(blueprint) as typeof blueprint & {
      centerline: Array<(typeof blueprint.centerline)[number]>;
    };
    crossing.centerline[8] = { ...crossing.centerline[8]!, x: -8, z: -8 };
    crossing.centerline[9] = { ...crossing.centerline[9]!, x: 8, z: 8 };
    crossing.centerline[10] = { ...crossing.centerline[10]!, x: -8, z: 8 };
    crossing.centerline[11] = { ...crossing.centerline[11]!, x: 8, z: -8 };
    const crossingIssues = validateIslandBlueprintV2(crossing);
    expect(crossingIssues.some((issue) => issue.includes("self-intersects"))).toBe(true);

    const tooClose = structuredClone(blueprint);
    (tooClose.route as unknown as { clearance: number }).clearance = 1000;
    const clearanceIssues = validateIslandBlueprintV2(tooClose);
    expect(
      clearanceIssues.some(
        (issue) => issue.includes("non-adjacent") || issue.includes("clearance"),
      ),
    ).toBe(true);
  });

  it("gives medium and long islands visible macro relief", () => {
    for (const lessonCount of [24, 41]) {
      const blueprint = islandBlueprintV2({ ...INPUT, lessonCount, seed: `relief-${lessonCount}` });
      const relief = sampledRelief(blueprint);
      expect(relief, `${lessonCount} relief`).toBeGreaterThanOrEqual(2.5);
      expect(relief, `${lessonCount} relief`).toBeLessThanOrEqual(4.5);
    }
  });

  it("keeps route, terrain, theme, and anchor geometry independent of unit identity", () => {
    const lessonIds = Array.from({ length: 24 }, (_, index) => `lesson-${index + 1}`);
    const first = islandBlueprintV2({
      ...INPUT,
      lessonCount: lessonIds.length,
      lessonIds,
      unitIds: lessonIds.map(() => "unit-a"),
    });
    const second = islandBlueprintV2({
      ...INPUT,
      lessonCount: lessonIds.length,
      lessonIds: lessonIds.map((_, index) => `other-lesson-${index + 1}`),
      unitIds: lessonIds.map((_, index) => `unit-${Math.floor(index / 3) + 1}`),
    });
    expect(geometryProjection(first)).toEqual(geometryProjection(second));
    expect(
      first.nodes.map(({ unitId, unitIndex, visualToken }) => ({ unitId, unitIndex, visualToken })),
    ).not.toEqual(
      second.nodes.map(({ unitId, unitIndex, visualToken }) => ({
        unitId,
        unitIndex,
        visualToken,
      })),
    );
    expect(validateIslandBlueprintV2(first)).toEqual([]);
    expect(validateIslandBlueprintV2(second)).toEqual([]);
  });

  it("keeps unit visual tokens stable within a unit and distinct without relying on colour", () => {
    const tokenA = unitVisualTokenV2(INPUT.studyId, INPUT.courseId, "unit-a", 0);
    const tokenB = unitVisualTokenV2(INPUT.studyId, INPUT.courseId, "unit-b", 1);
    expect(tokenA).toEqual(unitVisualTokenV2(INPUT.studyId, INPUT.courseId, "unit-a", 0));
    expect(
      tokenA.sigil !== tokenB.sigil ||
        tokenA.motionVariant !== tokenB.motionVariant ||
        tokenA.variant !== tokenB.variant,
    ).toBe(true);
  });
});
