import * as THREE from "three";
import { expect, it } from "vitest";

import { layoutCourseLessons, type LessonPlacement } from "../Maps.js";
import { islandBlueprint } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { buildIslandGeometry, sampleIslandTerrainTop } from "./island-geometry.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

it.each([6, 24, 41])("measures the actual delivery components for %i lessons", (lessonCount) => {
  const blueprint = islandBlueprint({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonCount,
    routeArchetype: "switchback",
    themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
  });
  const terrainStart = performance.now();
  const terrain = buildIslandGeometry(blueprint, "course");
  const terrainMs = performance.now() - terrainStart;
  const planStart = performance.now();
  const plan = planIslandDressing(blueprint, "course");
  const planMs = performance.now() - planStart;
  const warmStart = performance.now();
  expect(planIslandDressing(blueprint, "course")).toBe(plan);
  const warmPlanMs = performance.now() - warmStart;
  const lessons: LessonPlacement[] = blueprint.nodes.map((node, index) => ({
    studyId: blueprint.studyId,
    courseId: blueprint.courseId,
    unitId: node.unitId,
    unitTitle: node.unitId,
    unitIndex: node.unitIndex,
    lessonId: node.id,
    lessonTitle: node.id,
    chars: 1200,
    position: new THREE.Vector3(
      node.x,
      sampleIslandTerrainTop(blueprint, "course", node.x, node.z).y,
      node.z,
    ),
    state: index === 0 ? "live" : "idle",
    kind: "lesson",
    hueShift: 0,
    blueprint,
    visualToken: node.visualToken,
  }));
  const markerStart = performance.now();
  const layout = layoutCourseLessons(blueprint, lessons);
  const markerMs = performance.now() - markerStart;
  try {
    expect(terrain.counts.total).toBeLessThan(30_000);
    expect(layout.markers).toHaveLength(lessonCount);
    expect(plan.placements.length).toBeGreaterThan(0);
    if (process.env.UNIVERSITY_WORLD_BENCHMARK === "1") {
      console.log(
        JSON.stringify({
          lessonCount,
          bounds: blueprint.bounds,
          cpuMs: { terrainMs, planMs, warmPlanMs, markerMs },
          geometry: {
            terrain: terrain.counts,
            footing: layout.footing.triangleCount,
            inlay: layout.inlays.triangleCount,
            recoveries: layout.recoveries,
          },
          counts: Object.fromEntries(
            ["tree", "bush", "rock", "prop", "landmark"].map((kind) => [
              kind,
              plan.placements.filter((placement) => placement.kind === kind).length,
            ]),
          ),
          groves: plan.placements
            .filter((placement) => placement.kind === "tree")
            .map(({ x, z, height, clusterId }) => ({ x, z, height, clusterId })),
          decisions: plan.decisions,
        }),
      );
    }
  } finally {
    terrain.terrain.dispose();
    layout.footing.geometry?.dispose();
    layout.inlays.geometry?.dispose();
  }
});
