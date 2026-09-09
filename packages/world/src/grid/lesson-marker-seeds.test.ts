import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { layoutCourseLessons, type LessonPlacement } from "../Maps.js";
import { ISLAND_ROUTE_ARCHETYPES, islandBlueprint } from "../island/island-blueprint.js";
import { sampleIslandTerrainTop } from "../island/island-geometry.js";
import { FOOTING_MAX_EXPOSED } from "./lesson-medallion.js";

const cases = ISLAND_ROUTE_ARCHETYPES.flatMap((routeArchetype) =>
  [1, 6, 12, 24, 41, 80].flatMap((lessonCount) =>
    ["meadow", "coast", "ridge", "garden"].map((seed) => ({ routeArchetype, lessonCount, seed })),
  ),
);

describe("course marker seed envelope", () => {
  it.each(cases)(
    "retains every target: $routeArchetype/$lessonCount/$seed",
    ({ routeArchetype, lessonCount, seed }) => {
      const blueprint = islandBlueprint({
        studyId: "marker-envelope",
        courseId: `course-${lessonCount}`,
        seed: `marker-envelope/${seed}/${lessonCount}`,
        routeArchetype,
        lessonCount,
      });
      const lessons: LessonPlacement[] = blueprint.nodes.map((node, index) => ({
        studyId: blueprint.studyId,
        courseId: blueprint.courseId,
        unitId: node.unitId,
        unitTitle: node.unitId,
        unitIndex: node.unitIndex,
        lessonId: node.id,
        lessonTitle: node.id,
        chars: index % 2 ? 12_000 : 0,
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
      const layout = layoutCourseLessons(blueprint, lessons);
      try {
        expect(layout.markers.map((marker) => marker.lesson.lessonId)).toEqual(
          lessons.map((lesson) => lesson.lessonId),
        );
        expect(layout.footing.maxExposed).toBeLessThanOrEqual(FOOTING_MAX_EXPOSED);
        for (const recovery of layout.recoveries) {
          expect(recovery.grounding.attempts).toBeLessThanOrEqual(26);
        }
        for (const marker of layout.markers) {
          expect(marker.surface?.normal.toArray().every(Number.isFinite)).toBe(true);
          expect(marker.surface?.normal.y).toBeGreaterThan(0);
          expect(Number.isFinite(marker.surface?.lift)).toBe(true);
        }
      } finally {
        layout.footing.geometry?.dispose();
        layout.inlays.geometry?.dispose();
      }
    },
  );
});
