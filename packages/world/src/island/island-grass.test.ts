import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import { islandFieldFor } from "./island-field.js";
import {
  ISLAND_GRASS_LIMITS,
  ISLAND_GRASS_LOD_PROFILES,
  ISLAND_GRASS_LOD_THRESHOLDS,
  ISLAND_GRASS_TOP_MAX_RADIAL,
  islandGrassDensityAt,
  islandGrassGroundNormalAt,
  islandGrassInstanceCountForLod,
  islandGrassLodForDistance,
  planIslandGrass,
} from "./island-grass.js";
import {
  ISLAND_GRASS_CLUMP_TRIANGLES,
  ISLAND_GRASS_LEAF_COUNT,
  ISLAND_GRASS_LEAF_SEGMENTS,
  ISLAND_GRASS_BLADE_TRIANGLES,
  createIslandGrassClumpGeometry,
  createIslandGrassBladeGeometry,
  createIslandGrassMaterial,
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
      maxCount: 16,
    });

    expect(plan.placements.length).toBeGreaterThan(0);
  });

  it("builds one indexed three-vertex blade card", () => {
    const geometry = createIslandGrassClumpGeometry();
    const position = geometry.getAttribute("position");

    expect(position.count).toBe(ISLAND_GRASS_LEAF_COUNT * (ISLAND_GRASS_LEAF_SEGMENTS * 2 + 1));
    expect(ISLAND_GRASS_BLADE_TRIANGLES).toBe(1);
    expect(geometry.index?.count).toBe(ISLAND_GRASS_CLUMP_TRIANGLES * 3);
    expect(new Set(Array.from(geometry.index?.array ?? [])).size).toBe(position.count);
    expect(position.getY(0)).toBe(0);
    expect(position.getY(position.count - 1)).toBe(1);
    expect(position.getX(position.count - 1)).toBe(0);
    expect(geometry.getAttribute("normal").getZ(0)).toBeCloseTo(1);

    geometry.dispose();
  });

  it("injects donor billboard, wind, normal, and nonlinear root-ramp shader code", () => {
    const material = createIslandGrassMaterial();
    const shader = {
      uniforms: {},
      vertexShader:
        "#include <common>\n#include <beginnormal_vertex>\n#include <defaultnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>",
      fragmentShader: "#include <common>\n#include <color_fragment>",
    } as Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];

    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(shader.vertexShader).toContain("aGrassGroundNormal");
    expect(shader.vertexShader).toContain("grassBillboardAngle");
    expect(shader.vertexShader).toContain("grassRotateAxis");
    expect(shader.vertexShader).toContain("uGroundNormalStrength");
    expect(shader.fragmentShader).toContain("pow(smoothstep(0.2, 0.98, grassBladeMask), 0.5)");
    expect(shader.fragmentShader).toContain("uGrassShadow");

    material.dispose();
  });

  it("keeps the seeded density field broad enough to form groves and bare patches", () => {
    const field = islandFieldFor(blueprint);
    const values = Array.from({ length: 13 * 15 }, (_, index) => {
      const x = (index % 13) * 8 - 48;
      const z = Math.floor(index / 13) * 8 - 56;
      return islandGrassDensityAt(field, x, z);
    });

    expect(values).toEqual(
      Array.from({ length: 13 * 15 }, (_, index) => {
        const x = (index % 13) * 8 - 48;
        const z = Math.floor(index / 13) * 8 - 56;
        return islandGrassDensityAt(field, x, z);
      }),
    );
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.2);
    expect(values.some((value) => value <= 0.26)).toBe(true);
    expect(values.some((value) => value >= 0.68)).toBe(true);
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
      expect(placement.groundNormal[1]).toBeGreaterThan(0);
      expect(Math.hypot(...placement.groundNormal)).toBeCloseTo(1, 5);
    }
  });

  it("derives the same terrain normal for the same root", () => {
    const point = { x: -12.5, z: 9.25 };
    expect(islandGrassGroundNormalAt(blueprint, point)).toEqual(
      islandGrassGroundNormalAt(blueprint, point),
    );
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
    const desktop = planIslandGrass(blueprint, "course", { tier: "desktop", maxCount: 100 });
    const mobile = planIslandGrass(blueprint, "course", { tier: "mobile", maxCount: 100 });
    const world = planIslandGrass(blueprint, "world", { tier: "desktop" });

    expect(desktop.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.desktop);
    expect(mobile.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.mobile);
    expect(world.placements).toEqual([]);
    expect(world.maxCount).toBe(0);
  });

  it("uses the measured blade budgets and keeps the real course dense", () => {
    const plan = planIslandGrass(realCourseBlueprint, "course", {
      tier: "desktop",
      density: 23,
      maxCount: ISLAND_GRASS_LIMITS.course.desktop,
    });

    // The one-triangle card is intentionally small; this test protects the
    // higher instance budget and the deterministic placement range instead of
    // allowing the old five-leaf geometry to return by accident.
    expect(plan.placements.length).toBe(ISLAND_GRASS_LIMITS.course.desktop);
    expect(plan.placements.every((placement) => placement.width >= 0.6)).toBe(true);
    expect(plan.placements.every((placement) => placement.width < 0.85)).toBe(true);
    expect(plan.placements.every((placement) => placement.height >= 0.42)).toBe(true);
    expect(plan.placements.every((placement) => placement.height < 0.65)).toBe(true);
  }, 30000);

  it("keeps the donor blade budget below one quarter of the old clump cost", () => {
    const legacyGrassTriangles = 16_000 * 45;
    const desktopGrassTriangles = ISLAND_GRASS_LIMITS.course.desktop * ISLAND_GRASS_BLADE_TRIANGLES;
    const mobileGrassTriangles = ISLAND_GRASS_LIMITS.course.mobile * ISLAND_GRASS_BLADE_TRIANGLES;

    expect(desktopGrassTriangles).toBe(80_000);
    expect(desktopGrassTriangles).toBeLessThan(legacyGrassTriangles / 4);
    expect(mobileGrassTriangles).toBeLessThan(desktopGrassTriangles);
  });

  it("resolves deterministic distance LOD with hysteresis", () => {
    expect(islandGrassLodForDistance(34)).toBe("near");
    expect(islandGrassLodForDistance(76)).toBe("mid");
    expect(islandGrassLodForDistance(112)).toBe("far");

    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.nearToMid - 0.01, "near")).toBe(
      "near",
    );
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.nearToMid, "near")).toBe("mid");
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.midToNear, "mid")).toBe("mid");
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.midToNear - 0.01, "mid")).toBe(
      "near",
    );
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.midToFar - 0.01, "mid")).toBe(
      "mid",
    );
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.midToFar, "mid")).toBe("far");
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.farToMid + 0.01, "far")).toBe(
      "far",
    );
    expect(islandGrassLodForDistance(ISLAND_GRASS_LOD_THRESHOLDS.farToMid, "far")).toBe("mid");
  });

  it("draws 45% of blades in the middle LOD and none in the far LOD", () => {
    const plan = {
      placements: Array.from({ length: 16000 }, () => ({
        x: 0,
        z: 0,
        y: 0,
        width: 0.8,
        height: 0.8,
        rotation: 0,
        phase: 0,
        radial: 0,
        groundNormal: [0, 1, 0] as const,
      })),
    };

    expect(ISLAND_GRASS_LOD_PROFILES.mid.densityMultiplier).toBe(0.45);
    expect(ISLAND_GRASS_LOD_PROFILES.mid.heightMultiplier).toBe(1.15);
    expect(islandGrassInstanceCountForLod(plan, "near")).toBe(16000);
    expect(islandGrassInstanceCountForLod(plan, "mid")).toBe(7200);
    expect(islandGrassInstanceCountForLod(plan, "far")).toBe(0);
  });

  it("changes semantic detail without changing the blueprint or its seed", () => {
    const world = planIslandGrass(blueprint, "world", { tier: "mobile" });
    const course = planIslandGrass(blueprint, "course", { tier: "mobile", maxCount: 32 });

    expect(world.seed).toBe(blueprint.seed);
    expect(course.seed).toBe(blueprint.seed);
    expect(course.detail).toBe("course");
    expect(world.detail).toBe("world");
    expect(course.placements.length).toBeGreaterThan(world.placements.length);
  });
});
