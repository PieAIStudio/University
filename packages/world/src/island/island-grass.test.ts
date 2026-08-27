import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import {
  ISLAND_GRASS_LIMITS,
  ISLAND_GRASS_TOP_MAX_RADIAL,
  planIslandGrass,
} from "./island-grass.js";
import {
  createIslandGrassBladeGeometry,
  disposeIslandGrassResources,
} from "./island-grass-render.js";

const blueprint = islandBlueprint({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
  routeArchetype: "switchback",
});

const realCourseBlueprint = islandBlueprint({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
});

describe("Island grass plan", () => {
  it("keeps the real generated TuringPact course eligible for ground cover", () => {
    const plan = planIslandGrass(realCourseBlueprint, "course", {
      tier: "desktop",
    });

    expect(plan.placements.length).toBeGreaterThan(0);
  });

  it("builds one complete two-segment blade without duplicate triangles", () => {
    const geometry = createIslandGrassBladeGeometry();

    expect(geometry.getAttribute("position").count).toBe(15);
    expect(geometry.index?.count).toBe(27);
    expect(new Set(Array.from(geometry.index?.array ?? [])).size).toBe(15);

    geometry.dispose();
  });

  it("disposes only the grass-owned geometry and material", () => {
    const geometry = createIslandGrassBladeGeometry();
    const material = new THREE.MeshBasicMaterial();
    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });

    disposeIslandGrassResources(geometry, material);

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });

  it("is deterministic for the same blueprint, detail, tier, and seed", () => {
    const first = planIslandGrass(blueprint, "course", {
      tier: "desktop",
      maxCount: 160,
    });
    const second = planIslandGrass(blueprint, "course", {
      tier: "desktop",
      maxCount: 160,
    });

    expect(first).toEqual(second);
  });

  it("samples only the blueprint top surface and keeps the canonical height", () => {
    const plan = planIslandGrass(blueprint, "course", {
      tier: "mobile",
      maxCount: 160,
    });

    expect(plan.placements.length).toBeGreaterThan(0);
    for (const placement of plan.placements) {
      const surface = sampleIslandSurface(blueprint, placement.x, placement.z);
      const renderedTop = sampleIslandTerrainTop(blueprint, "course", placement.x, placement.z);
      expect(surface.inside).toBe(true);
      expect(surface.radial).toBeLessThanOrEqual(ISLAND_GRASS_TOP_MAX_RADIAL);
      expect(placement.radial).toBeLessThanOrEqual(ISLAND_GRASS_TOP_MAX_RADIAL);
      expect(placement.y).toBeCloseTo(renderedTop.y, 8);
    }
  });

  it("keeps route, lesson nodes, and hero readable", () => {
    const plan = planIslandGrass(realCourseBlueprint, "course", {
      tier: "desktop",
      maxCount: 180,
    });
    const routeClearance =
      realCourseBlueprint.route.roadWidth / 2 + realCourseBlueprint.route.shoulderWidth + 0.1;

    for (const placement of plan.placements) {
      expect(distanceToIslandRoute(realCourseBlueprint, placement)).toBeGreaterThanOrEqual(
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
    const plan = planIslandGrass(blueprint, "course", {
      tier: "desktop",
      density: 1,
      maxCount: 180,
      safetyZones: [{ x: 0, z: 0, radius: 100, kind: "landmark" }],
    });

    expect(plan.placements).toEqual([]);
  });

  it("hard-caps mobile and desktop detail and keeps world grass empty", () => {
    const desktop = planIslandGrass(blueprint, "course", { tier: "desktop" });
    const mobile = planIslandGrass(blueprint, "course", { tier: "mobile" });
    const world = planIslandGrass(blueprint, "world", { tier: "desktop" });

    expect(desktop.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.desktop);
    expect(mobile.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.mobile);
    expect(world.placements).toEqual([]);
    expect(world.maxCount).toBe(0);
  });

  it("changes semantic detail without changing the blueprint or its seed", () => {
    const world = planIslandGrass(blueprint, "world", { tier: "mobile" });
    const course = planIslandGrass(blueprint, "course", { tier: "mobile" });

    expect(world.seed).toBe(blueprint.seed);
    expect(course.seed).toBe(blueprint.seed);
    expect(course.detail).toBe("course");
    expect(world.detail).toBe("world");
    expect(course.placements.length).toBeGreaterThan(world.placements.length);
  });
});
