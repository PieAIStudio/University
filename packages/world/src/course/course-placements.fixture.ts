import * as THREE from "three";

import { islandBlueprint } from "../island/island-blueprint.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import type { LessonPlacement } from "../Maps.js";
import { checkpointGaps, segmentsFromPlacements } from "./learning-sites.js";

/**
 * Course placements for tests, built the way `placeCourse` builds them but
 * without a catalogue: the study and course ids pick the island recipe, the
 * unit sizes pick the segments and so the gates. Not imported by product code.
 */
export function placements(
  studyId: string,
  courseId: string,
  unitSizes: readonly number[],
): LessonPlacement[] {
  const unitIds = unitSizes.flatMap((size, unit) =>
    Array.from({ length: size }, () => `unit-${unit}`),
  );
  const lessonIds = unitIds.map((_, index) => `lesson-${index}`);
  // The same derivation `placeCourse` uses, so the gaps match the gates.
  const segments = segmentsFromPlacements(
    unitIds.map((unitId, index) => ({ unitId, unitTitle: unitId, lessonId: lessonIds[index]! })),
  );
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount: lessonIds.length,
    lessonIds,
    unitIds,
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
    checkpointGaps: checkpointGaps(segments, lessonIds.length),
  });
  return blueprint.nodes.map((node, index) => ({
    studyId,
    courseId,
    unitId: node.unitId,
    unitTitle: node.unitId,
    unitIndex: node.unitIndex,
    lessonId: node.id,
    lessonTitle: node.id,
    chars: 4000,
    position: new THREE.Vector3(node.x, node.y, node.z),
    state: index === 0 ? "live" : "idle",
    kind: "lesson",
    hueShift: 0,
    blueprint,
    visualToken: node.visualToken,
  })) as unknown as LessonPlacement[];
}

/** Three real course shapes: long, short, and many short units. */
export const COURSES = [
  ["ai-literacy", "understanding-ai", [5, 6, 7, 6, 6, 6]],
  ["browser-ai", "run-a-real-project-with-ai", [4, 4]],
  ["browser-ai", "make-the-cutout-app-yours", [2, 2, 3, 2]],
] as const;
