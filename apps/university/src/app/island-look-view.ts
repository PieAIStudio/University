import { useMemo } from "react";

import type { View } from "@pieai/university-core";
import { buildCourseGrid, hexToWorld } from "@pieai/university-world";
import type { CourseNode } from "@pieai/university-world/course.js";
import {
  islandLookSceneSource,
  type IslandLookDebugOptions,
  type IslandLookSceneSource,
} from "@pieai/university-world/island-look.js";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";

interface IslandLookViewOptions {
  readonly lookDebug: IslandLookDebugOptions | null;
  readonly nodes: readonly CourseNode[] | null;
  readonly routeView: View;
}

/** Apply the DEV-only island judge route override without changing real routes. */
export function useIslandLookView({ lookDebug, nodes, routeView }: IslandLookViewOptions) {
  const lookSeedNode = useMemo(() => {
    if (!import.meta.env.DEV || !lookDebug?.shot || !lookDebug.seed || !nodes) return null;
    const routeMatch =
      (routeView.kind === "course" ||
        routeView.kind === "lesson" ||
        routeView.kind === "settled") &&
      routeView.courseId === lookDebug.seed
        ? nodes.find(
            (node) => node.studyId === routeView.studyId && node.courseId === routeView.courseId,
          )
        : undefined;
    return routeMatch ?? nodes.find((node) => node.courseId === lookDebug.seed) ?? null;
  }, [lookDebug?.seed, lookDebug?.shot, nodes, routeView]);

  const view = useMemo(() => {
    if (!import.meta.env.DEV || !lookSeedNode || !lookDebug?.shot) return routeView;
    if (lookDebug.shot === "world-design") return { kind: "world" } as const;
    return {
      kind: "course",
      studyId: lookSeedNode.studyId,
      courseId: lookSeedNode.courseId,
    } as const;
  }, [lookDebug?.shot, lookSeedNode, routeView]);

  return { lookSeedNode, view };
}

interface IslandLookSourceOptions {
  readonly inCourse: boolean;
  readonly lessons: readonly LessonPlacement[];
  readonly lookDebug: IslandLookDebugOptions | null;
  readonly lookShotIsCourse: boolean;
  readonly viewKind: View["kind"];
  readonly world: WorldMap | null;
}

/** Build the measured DEV scene from the same world/course data as the learner view. */
export function useIslandLookSource({
  inCourse,
  lessons,
  lookDebug,
  lookShotIsCourse,
  viewKind,
  world,
}: IslandLookSourceOptions): IslandLookSceneSource | null {
  return useMemo(() => {
    if (!import.meta.env.DEV || !lookDebug?.shot) return null;
    if (lookShotIsCourse && inCourse) {
      const blueprint = lessons[0]?.blueprint;
      if (!blueprint) return null;
      const grid = buildCourseGrid({
        studyId: blueprint.studyId,
        courseId: blueprint.courseId,
        seed: blueprint.seed,
        routeArchetype: blueprint.route.archetype,
        routeAnchors: blueprint.geometryNodes,
        activeLessonIndex: lessons.findIndex((lesson) => lesson.state === "live"),
        lessons: lessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          unitId: lesson.unitId,
          unitIndex: lesson.unitIndex,
          state: lesson.state,
        })),
      });
      return islandLookSceneSource(
        "course",
        [blueprint],
        lessons.map((lesson) => ({ x: lesson.position.x, z: lesson.position.z })),
        {
          dressingPlacementCount: grid.props.length,
          dressingAssetPlacementCount: grid.props.filter(
            (prop) => prop.kind === "territory" && prop.visibleInCourse !== false,
          ).length,
          detailBounds: { halfX: grid.bounds.halfX, halfZ: grid.bounds.halfZ },
          dressingRimPlacementCount: grid.props.filter((prop) => {
            const point = hexToWorld(prop.coord, grid.hexSize);
            return (
              Math.hypot(
                point.x / Math.max(grid.bounds.halfX, Number.EPSILON),
                point.z / Math.max(grid.bounds.halfZ, Number.EPSILON),
              ) > 0.76
            );
          }).length,
        },
      );
    }
    if (lookDebug.shot === "world-design" && viewKind === "world" && world) {
      return islandLookSceneSource(
        "world",
        world.placements
          .map((entry) => entry.blueprint)
          .filter((blueprint): blueprint is NonNullable<typeof blueprint> => blueprint !== null),
        world.placements.map((entry) => ({ x: entry.position.x, z: entry.position.z })),
        {
          dressingPlacementCount: world.placements.reduce(
            (sum, entry) => sum + entry.grid.props.length,
            0,
          ),
          dressingAssetPlacementCount: world.placements.reduce(
            (sum, entry) => sum + entry.grid.props.length,
            0,
          ),
        },
      );
    }
    return null;
  }, [inCourse, lessons, lookDebug?.shot, lookShotIsCourse, viewKind, world]);
}
