import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprintV2, sampleIslandSurfaceV2 } from "./island-blueprint-v2.js";
import { sampleIslandTerrainTopV2 } from "./island-geometry-v2.js";
import { distanceToIslandRouteV2 } from "./island-dressing-v2.js";
import {
  ISLAND_GRASS_V2_LIMITS,
  ISLAND_GRASS_V2_TOP_MAX_RADIAL,
  planIslandGrassV2,
} from "./island-grass-v2.js";
import {
  createIslandGrassBladeGeometryV2,
  disposeIslandGrassV2Resources,
} from "./island-grass-v2-render.js";

const blueprint = islandBlueprintV2({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
  routeArchetype: "switchback",
});

const realCourseBlueprint = islandBlueprintV2({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
});

describe("Island V2 grass plan", () => {
  it("keeps the real generated TuringPact course eligible for ground cover", () => {
    const plan = planIslandGrassV2(realCourseBlueprint, "course", {
      tier: "desktop",
    });

    expect(plan.placements.length).toBeGreaterThan(0);
  });

  it("builds one complete two-segment blade without duplicate triangles", () => {
    const geometry = createIslandGrassBladeGeometryV2();

    expect(geometry.getAttribute("position").count).toBe(15);
    expect(geometry.index?.count).toBe(27);
    expect(new Set(Array.from(geometry.index?.array ?? [])).size).toBe(15);

    geometry.dispose();
  });

  it("disposes only the grass-owned geometry and material", () => {
    const geometry = createIslandGrassBladeGeometryV2();
    const material = new THREE.MeshBasicMaterial();
    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });

    disposeIslandGrassV2Resources(geometry, material);

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });

  it("is deterministic for the same blueprint, detail, tier, and seed", () => {
    const first = planIslandGrassV2(blueprint, "course", {
      tier: "desktop",
      maxCount: 160,
    });
    const second = planIslandGrassV2(blueprint, "course", {
      tier: "desktop",
      maxCount: 160,
    });

    expect(first).toEqual(second);
  });

  it("samples only the blueprint top surface and keeps the canonical height", () => {
    const plan = planIslandGrassV2(blueprint, "course", {
      tier: "mobile",
      maxCount: 160,
    });

    expect(plan.placements.length).toBeGreaterThan(0);
    for (const placement of plan.placements) {
      const surface = sampleIslandSurfaceV2(blueprint, placement.x, placement.z);
      const renderedTop = sampleIslandTerrainTopV2(blueprint, "course", placement.x, placement.z);
      expect(surface.inside).toBe(true);
      expect(surface.radial).toBeLessThanOrEqual(ISLAND_GRASS_V2_TOP_MAX_RADIAL);
      expect(placement.radial).toBeLessThanOrEqual(ISLAND_GRASS_V2_TOP_MAX_RADIAL);
      expect(placement.y).toBeCloseTo(renderedTop.y, 8);
    }
  });

  it("keeps route, lesson nodes, and hero readable", () => {
    const plan = planIslandGrassV2(realCourseBlueprint, "course", {
      tier: "desktop",
      maxCount: 180,
    });
    const routeClearance =
      realCourseBlueprint.route.roadWidth / 2 + realCourseBlueprint.route.shoulderWidth + 0.1;

    for (const placement of plan.placements) {
      expect(distanceToIslandRouteV2(realCourseBlueprint, placement)).toBeGreaterThanOrEqual(
        routeClearance,
      );
      for (const node of realCourseBlueprint.nodes) {
        expect(Math.hypot(placement.x - node.x, placement.z - node.z)).toBeGreaterThanOrEqual(
          realCourseBlueprint.route.nodeRadius + 0.52,
        );
      }
      expect(
        Math.hypot(
          placement.x - realCourseBlueprint.hero.x,
          placement.z - realCourseBlueprint.hero.z,
        ),
      ).toBeGreaterThanOrEqual(realCourseBlueprint.hero.radius + 0.78);
    }
  });

  it("honours explicit accent/landmark keep-clear zones", () => {
    const plan = planIslandGrassV2(blueprint, "course", {
      tier: "desktop",
      density: 1,
      maxCount: 180,
      safetyZones: [{ x: 0, z: 0, radius: 100, kind: "landmark" }],
    });

    expect(plan.placements).toEqual([]);
  });

  it("hard-caps mobile and desktop detail and keeps world grass empty", () => {
    const desktop = planIslandGrassV2(blueprint, "course", { tier: "desktop" });
    const mobile = planIslandGrassV2(blueprint, "course", { tier: "mobile" });
    const world = planIslandGrassV2(blueprint, "world", { tier: "desktop" });

    expect(desktop.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_V2_LIMITS.course.desktop);
    expect(mobile.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_V2_LIMITS.course.mobile);
    expect(world.placements).toEqual([]);
    expect(world.maxCount).toBe(0);
  });

  it("changes semantic detail without changing the blueprint or its seed", () => {
    const world = planIslandGrassV2(blueprint, "world", { tier: "mobile" });
    const course = planIslandGrassV2(blueprint, "course", { tier: "mobile" });

    expect(world.seed).toBe(blueprint.seed);
    expect(course.seed).toBe(blueprint.seed);
    expect(course.detail).toBe("course");
    expect(world.detail).toBe("world");
    expect(course.placements.length).toBeGreaterThan(world.placements.length);
  });
});
