/**
 * Per-CourseNode shape and projection cache.
 *
 * An island's blueprint (geometry, route anchors, natural theme) is an immutable
 * function of the course's content: lesson count, seed, study/course identity,
 * and theme recipe. It does NOT vary by camera focus, learner progress, or map
 * layout.
 *
 * Grids are bounded projections derived from the blueprint:
 * - `catalogue`: single-anchor remote silhouette (idle or done)
 * - `study`: multi-anchor road route (idle or done)
 *
 * Caching blueprints and grids weakly per `CourseNode` instance avoids repeated
 * synchronous work (~300ms on catalogue focus change) while letting the node
 * lifecycle naturally manage memory without permanent global leaks.
 */

import type { CourseNode } from "./course/course.js";
import { checkpointGapsForUnitSizes } from "./course/learning-sites.js";
import { buildCourseGrid, type HexMap } from "./grid/course-grid.js";
import {
  islandGeometryBlueprint,
  projectIslandBlueprint,
  type IslandBlueprint,
  type IslandThemeSelection,
} from "./island/island-blueprint.js";
import { islandLookSeedForCourse } from "./island/island-surface-style.js";
import { islandThemeSelectionForCourse } from "./island/kenney-recipes.js";

export type WorldCourseGridScope = "study" | "catalogue";
export type WorldCourseGridState = "done" | "idle";

export interface WorldCourseProjection {
  readonly blueprint: IslandBlueprint;
  readonly grid: HexMap;
}

export interface WorldCourseProjectionOptions {
  readonly lookSeed?: string;
  readonly themeSelection?: IslandThemeSelection;
}

interface CourseShapeCacheEntry {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonCount: number;
  readonly unitLessonCounts: string;
  readonly lookSeed: string | undefined;
  readonly themeRecipeId: IslandThemeSelection["recipeId"];
  readonly themeNaturalBasePackId: string;
  readonly themeAccentPackIds: string;
  readonly blueprint: IslandBlueprint;
  readonly grids: Map<string, HexMap>;
}

let courseShapeCache = new WeakMap<CourseNode, CourseShapeCacheEntry>();

export function clearWorldCourseProjectionCache(): void {
  courseShapeCache = new WeakMap<CourseNode, CourseShapeCacheEntry>();
}

function themeFingerprint(theme: IslandThemeSelection): {
  recipeId: IslandThemeSelection["recipeId"];
  naturalBasePackId: string;
  accentPackIds: string;
} {
  return {
    recipeId: theme.recipeId,
    naturalBasePackId: theme.naturalBasePackId,
    accentPackIds: theme.accentPackIds.join(","),
  };
}

function getOrCreateEntry(
  node: CourseNode,
  options?: WorldCourseProjectionOptions,
): CourseShapeCacheEntry {
  const lookSeed =
    options?.lookSeed !== undefined ? options.lookSeed : islandLookSeedForCourse(node.courseId);
  const themeSelection =
    options?.themeSelection ?? islandThemeSelectionForCourse(node.studyId, node.courseId);
  const themeFp = themeFingerprint(themeSelection);
  const unitKey = node.unitLessonCounts?.join(",") ?? "";

  let entry = courseShapeCache.get(node);

  if (
    !entry ||
    entry.studyId !== node.studyId ||
    entry.courseId !== node.courseId ||
    entry.lessonCount !== node.lessons ||
    entry.unitLessonCounts !== unitKey ||
    entry.lookSeed !== lookSeed ||
    entry.themeRecipeId !== themeFp.recipeId ||
    entry.themeNaturalBasePackId !== themeFp.naturalBasePackId ||
    entry.themeAccentPackIds !== themeFp.accentPackIds
  ) {
    const geometry = islandGeometryBlueprint({
      studyId: node.studyId,
      courseId: node.courseId,
      lessonCount: node.lessons,
      seed: lookSeed,
      themeSelection,
      // The same gate gaps the course island gets, so both build one geometry.
      checkpointGaps: node.unitLessonCounts
        ? checkpointGapsForUnitSizes(node.unitLessonCounts)
        : undefined,
    });
    const blueprint = projectIslandBlueprint(geometry);
    entry = {
      studyId: node.studyId,
      courseId: node.courseId,
      lessonCount: node.lessons,
      unitLessonCounts: unitKey,
      lookSeed,
      themeRecipeId: themeFp.recipeId,
      themeNaturalBasePackId: themeFp.naturalBasePackId,
      themeAccentPackIds: themeFp.accentPackIds,
      blueprint,
      grids: new Map<string, HexMap>(),
    };
    courseShapeCache.set(node, entry);
  }

  return entry;
}

function generateCatalogueGrid(
  node: CourseNode,
  state: WorldCourseGridState,
  lookSeed: string | undefined,
): HexMap {
  return buildCourseGrid({
    studyId: node.studyId,
    courseId: node.courseId,
    seed: lookSeed ?? `${node.studyId}/${node.courseId}`,
    activeLessonIndex: -1,
    projection: "world",
    footprintLessons: node.lessons,
    lessons: [
      {
        lessonId: `${node.courseId}/world-anchor`,
        unitId: `${node.courseId}/world-unit`,
        unitIndex: 0,
        state,
      },
    ],
  });
}

function generateStudyGrid(
  node: CourseNode,
  blueprint: IslandBlueprint,
  state: WorldCourseGridState,
): HexMap {
  return buildCourseGrid({
    studyId: node.studyId,
    courseId: node.courseId,
    seed: blueprint.seed,
    routeArchetype: blueprint.route.archetype,
    routeAnchors: blueprint.geometryNodes,
    activeLessonIndex: -1,
    projection: "world",
    footprintLessons: node.lessons,
    lessons: blueprint.nodes.map((routeNode) => ({
      lessonId: routeNode.id,
      unitId: routeNode.unitId,
      unitIndex: routeNode.unitIndex,
      state,
    })),
  });
}

/**
 * Project a CourseNode into its cached blueprint and scope/state-specific grid.
 *
 * Blueprint is computed once per node shape and cached across calls.
 * Grids are cached per (scope, state) pair (maximum 4 entries: study/catalogue x done/idle).
 */
export function projectWorldCourse(
  node: CourseNode,
  scope: WorldCourseGridScope = "catalogue",
  state: WorldCourseGridState = "idle",
  options?: WorldCourseProjectionOptions,
): WorldCourseProjection {
  const entry = getOrCreateEntry(node, options);
  const gridKey = `${scope}:${state}`;
  let grid = entry.grids.get(gridKey);
  if (!grid) {
    grid =
      scope === "catalogue"
        ? generateCatalogueGrid(node, state, entry.lookSeed)
        : generateStudyGrid(node, entry.blueprint, state);
    entry.grids.set(gridKey, grid);
  }
  return {
    blueprint: entry.blueprint,
    grid,
  };
}

/**
 * Access the cached blueprint for a course node directly.
 */
export function getWorldCourseBlueprint(
  node: CourseNode,
  options?: WorldCourseProjectionOptions,
): IslandBlueprint {
  return getOrCreateEntry(node, options).blueprint;
}

/**
 * Access the cached grid for a course node in a given scope and state.
 */
export function getWorldCourseGrid(
  node: CourseNode,
  scope: WorldCourseGridScope,
  state: WorldCourseGridState = "idle",
  options?: WorldCourseProjectionOptions,
): HexMap {
  return projectWorldCourse(node, scope, state, options).grid;
}

/**
 * Build the one remote silhouette used by the catalogue and the planet.
 *
 * A planet course is still a world course: its cells, palette, height breaks
 * and footprint come from the same projection as the catalogue. Keeping this
 * helper beside `placeWorld` makes it impossible for the picker to quietly
 * grow a second island generator.
 */
export function buildWorldCourseGrid(
  node: CourseNode,
  state: WorldCourseGridState = "idle",
  options?: WorldCourseProjectionOptions,
): HexMap {
  return projectWorldCourse(node, "catalogue", state, options).grid;
}
