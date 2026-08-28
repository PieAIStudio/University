import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import {
  ISLAND_GRASS_LIMITS,
  ISLAND_GRASS_LOD_PROFILES,
  ISLAND_GRASS_LOD_THRESHOLDS,
  ISLAND_GRASS_TOP_MAX_RADIAL,
  islandGrassDensityAt,
  islandGrassInstanceCountForLod,
  islandGrassLodForDistance,
  planIslandGrass,
} from "./island-grass.js";
import elementalManifest from "./elemental-serenity-assets.json";
import {
  ISLAND_GRASS_CARD_WIDTH,
  ISLAND_GRASS_CLUMP_TRIANGLES,
  ISLAND_GRASS_LEAF_COUNT,
  ISLAND_GRASS_LEAF_SEGMENTS,
  createIslandGrassCardGeometry,
  createIslandGrassClumpGeometry,
  createIslandGrassBladeGeometry,
  disposeIslandGrassResources,
  projectDonorGrassBladeGeometry,
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
  it("plans a short unshadowed field under the course cap", () => {
    const plan = planIslandGrass(realCourseBlueprint, "course", {
      tier: "desktop",
    });

    expect(plan.placements.length).toBeGreaterThan(0);
    expect(plan.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.desktop);
    expect(plan.maxCount).toBe(ISLAND_GRASS_LIMITS.course.desktop);
  });

  it("keeps the elemental-serenity blade on the grass lane, not as future-use", () => {
    const blade = elementalManifest.assets.find((asset) => asset.assetId === "grass_blade");
    expect(blade?.roles).toEqual(["grass"]);
    expect(blade?.src).toBe("/models/elemental-serenity/grass_blade.glb");
  });

  it("projects a donor blade onto the unit-height kit contract", () => {
    const source = new THREE.BoxGeometry(0.4, 2, 0.05);
    source.translate(3, 4, 5);
    const geometry = projectDonorGrassBladeGeometry(source);
    const position = geometry.getAttribute("position");
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let index = 0; index < position.count; index += 1) {
      minY = Math.min(minY, position.getY(index));
      maxY = Math.max(maxY, position.getY(index));
      minX = Math.min(minX, position.getX(index));
      maxX = Math.max(maxX, position.getX(index));
    }
    expect(minY).toBeCloseTo(0, 5);
    expect(maxY).toBeCloseTo(1, 5);
    expect((minX + maxX) / 2).toBeCloseTo(0, 5);
    expect(geometry.getAttribute("aClumpOcclusion").count).toBe(position.count);
    expect(geometry.getAttribute("uv").getY(0)).toBeGreaterThanOrEqual(0);
    source.dispose();
    geometry.dispose();
  });

  it("builds a unit-height camera-facing card instead of the three-vertex donor stub", () => {
    const geometry = createIslandGrassCardGeometry();
    const position = geometry.getAttribute("position");
    expect(position.count).toBe(3);
    expect(geometry.index?.count).toBe(3);
    expect(position.getY(0)).toBe(0);
    expect(position.getY(2)).toBe(1);
    expect(Math.abs(position.getX(1) - position.getX(0))).toBeCloseTo(ISLAND_GRASS_CARD_WIDTH, 5);
    geometry.dispose();
  });

  it("builds one complete five-leaf clump with curved tapered leaves", () => {
    const geometry = createIslandGrassClumpGeometry();
    const position = geometry.getAttribute("position");
    const occlusion = geometry.getAttribute("aClumpOcclusion");
    const variation = geometry.getAttribute("aLeafVariation");

    expect(position.count).toBe(ISLAND_GRASS_LEAF_COUNT * (ISLAND_GRASS_LEAF_SEGMENTS * 2 + 1));
    expect(geometry.index?.count).toBe(ISLAND_GRASS_CLUMP_TRIANGLES * 3);
    expect(new Set(Array.from(geometry.index?.array ?? [])).size).toBe(position.count);
    expect(occlusion.count).toBe(position.count);
    expect(variation.count).toBe(position.count);
    expect(position.getY(0)).toBe(0);
    expect(position.getY(position.count - 1)).toBeGreaterThan(0.8);
    expect(position.getX(position.count - 1)).not.toBe(0);

    geometry.dispose();
  });

  it("keeps the seeded density field broad enough to form groves and bare patches", () => {
    const values = Array.from({ length: 13 * 15 }, (_, index) => {
      const x = (index % 13) * 8 - 48;
      const z = Math.floor(index / 13) * 8 - 56;
      return islandGrassDensityAt(blueprint.seed, x, z);
    });

    expect(values).toEqual(
      Array.from({ length: 13 * 15 }, (_, index) => {
        const x = (index % 13) * 8 - 48;
        const z = Math.floor(index / 13) * 8 - 56;
        return islandGrassDensityAt(blueprint.seed, x, z);
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

  it("hard-caps a caller asking for more blades than the course budget", () => {
    const plan = planIslandGrass(realCourseBlueprint, "course", {
      tier: "desktop",
      density: 3.6,
      maxCount: 5000,
    });

    expect(plan.placements.length).toBeLessThanOrEqual(ISLAND_GRASS_LIMITS.course.desktop);
    expect(plan.maxCount).toBe(ISLAND_GRASS_LIMITS.course.desktop);
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

  it("draws 45% of clumps in the middle LOD and none in the far LOD", () => {
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
    const course = planIslandGrass(blueprint, "course", { tier: "mobile" });

    expect(world.seed).toBe(blueprint.seed);
    expect(course.seed).toBe(blueprint.seed);
    expect(course.detail).toBe("course");
    expect(world.detail).toBe("world");
    expect(course.placements.length).toBeGreaterThan(0);
    expect(world.placements).toEqual([]);
  });
});
