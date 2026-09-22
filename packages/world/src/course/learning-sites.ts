import { Vector3 } from "three";
import {
  learningNodeId,
  learningSegments,
  type LearningSegment,
  type MapLearningKind,
} from "@pieai/university-core";

import type { IslandBlueprint, IslandPoint } from "../island/island-blueprint.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import {
  islandDressingSafetyZones,
  planIslandDressing,
  placementFootprintRadius,
} from "../island/island-dressing.js";
import { courseLandscapePlan } from "../island/course-landscape-plan.js";
import type { LessonPlacement } from "../Maps.js";
import {
  LEARNING_GATE_HALF_SPAN,
  LEARNING_NODE_POST_SINK,
  LEARNING_NODE_SCALE,
} from "./learning-node-geometry.js";

/**
 * Where each learning node stands on the course island.
 *
 * The three nodes of a segment used to be DOM glyphs floated at a fixed offset
 * from the segment's last lesson, and nothing on the island knew they were
 * there — so the offset could, and did, land them on a tree. This module is the
 * one answer to "where is this node": the DOM chip and the 3D object both read
 * it. It never moves an existing tree, rock or path. It searches outward from
 * the old offset for ground that is actually free, and when there is none it
 * reports that instead of drawing into something (the meadow-bed rule: no safe
 * site, no object).
 */

export interface LearningSite {
  readonly id: string;
  readonly segment: LearningSegment;
  readonly kind: MapLearningKind;
  /** Ground point in blueprint space; y is the drawn terrain height. */
  readonly ground: Vector3;
  /**
   * A fixed heading (the gate spans the road, so the road decides), or null for
   * objects that turn to face the camera.
   */
  readonly yaw: number | null;
  /** False when no free ground was found: the chip stays, no object is drawn. */
  readonly resolved: boolean;
  /** Stepping stones from the road edge to the object; empty for checkpoints. */
  readonly branch: readonly Vector3[];
}

/**
 * Ground radius each object needs, in blueprint units (lesson node radius is
 * 0.62). The gate's own footprint is its two posts; this radius is only what
 * other nodes keep clear of it.
 */
export const LEARNING_SITE_RADIUS: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 0.55 * LEARNING_NODE_SCALE,
  challenge: 0.32 * LEARNING_NODE_SCALE,
  personal: 0.42 * LEARNING_NODE_SCALE,
};
/** How tall each object stands, so the DOM chip sits above it rather than inside it. */
export const LEARNING_SITE_HEIGHT: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 1.15 * LEARNING_NODE_SCALE,
  challenge: 1.32 * LEARNING_NODE_SCALE,
  personal: 0.9 * LEARNING_NODE_SCALE,
};

const SIDE_OFFSET = 3.2;
const SEARCH_RINGS = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2];
const SEARCH_ANGLES = 16;
const NODE_GAP = 0.25;
/** Learning nodes keep this much open ground between each other, so three reads as three. */
const NODE_SPACING = 0.85;
const OBSTACLE_GAP = 0.12;
/** Steepest drop under a footprint; posts sink deeper than this (see the geometry). */
export const MAX_SLOPE_RISE = 0.22;
if (LEARNING_NODE_POST_SINK * LEARNING_NODE_SCALE <= MAX_SLOPE_RISE)
  throw new Error("learning-node posts must sink deeper than the steepest accepted ground");
const STONE_SPACING = 0.42;
const MAX_STONES = 6;

interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** Segments as the app derives them, rebuilt from the placements' own order. */
export function segmentsFromPlacements(lessons: readonly LessonPlacement[]) {
  const units: { id: string; title: string; lessons: { id: string }[] }[] = [];
  for (const lesson of lessons) {
    const last = units.at(-1);
    if (last?.id === lesson.unitId) last.lessons.push({ id: lesson.lessonId });
    else
      units.push({
        id: lesson.unitId,
        title: lesson.unitTitle,
        lessons: [{ id: lesson.lessonId }],
      });
  }
  return learningSegments({ units });
}

function obstaclesOf(blueprint: IslandBlueprint): readonly Obstacle[] {
  const dressing = planIslandDressing(blueprint, "course");
  const landscape = courseLandscapePlan(blueprint, dressing);
  const obstacles: Obstacle[] = [];
  for (const placement of dressing.placements) {
    const r = placementFootprintRadius(placement);
    // An unregistered footprint is unknown, not zero: keep a conservative apron.
    obstacles.push({ x: placement.x, z: placement.z, r: Number.isFinite(r) ? r : 1 });
  }
  // A landmark owns its whole courtyard, not just the ground under each part:
  // a pennant between the tent and its fire would read as part of the camp.
  for (const zone of islandDressingSafetyZones(dressing))
    obstacles.push({ x: zone.x, z: zone.z, r: zone.radius });
  const groups = new Map<string, { x: number; z: number; r: number }[]>();
  for (const placement of dressing.placements) {
    const group = placement.outpostId ?? placement.assemblyId;
    if (!group) continue;
    const r = placementFootprintRadius(placement);
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { x: placement.x, z: placement.z, r: Number.isFinite(r) ? r : 1 },
    ]);
  }
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    const cx = parts.reduce((sum, part) => sum + part.x, 0) / parts.length;
    const cz = parts.reduce((sum, part) => sum + part.z, 0) / parts.length;
    const r = Math.max(...parts.map((part) => Math.hypot(part.x - cx, part.z - cz) + part.r));
    obstacles.push({ x: cx, z: cz, r });
  }
  const round = (items: readonly (IslandPoint & { readonly radius: number })[] | undefined) => {
    for (const item of items ?? []) obstacles.push({ x: item.x, z: item.z, r: item.radius });
  };
  round(landscape.outcrops);
  round(landscape.flora);
  round(landscape.stones);
  round(landscape.canopy);
  round(landscape.borders);
  round(landscape.stalls as readonly (IslandPoint & { radius: number })[] | undefined);
  round(landscape.academies as readonly (IslandPoint & { radius: number })[] | undefined);
  if (landscape.spring) {
    const basin = landscape.spring.basin;
    obstacles.push({ x: basin.x, z: basin.z, r: basin.radius });
    for (const section of landscape.spring.channel) {
      const width = (section as { width?: number }).width ?? 0.4;
      obstacles.push({ x: section.x, z: section.z, r: width });
    }
  }
  return obstacles;
}

function clearOf(
  x: number,
  z: number,
  radius: number,
  obstacles: readonly Obstacle[],
  taken: readonly Obstacle[],
): boolean {
  for (const o of obstacles)
    if (Math.hypot(x - o.x, z - o.z) < o.r + radius + OBSTACLE_GAP) return false;
  for (const o of taken)
    if (Math.hypot(x - o.x, z - o.z) < o.r + radius + OBSTACLE_GAP) return false;
  return true;
}

/** The road at route fraction t: centre point, height and unit tangent. */
function roadAt(blueprint: IslandBlueprint, t: number) {
  const line = blueprint.centerline;
  let index = line.findIndex((point) => point.t >= t);
  if (index <= 0) index = Math.max(1, index === -1 ? line.length - 1 : 1);
  const a = line[index - 1]!;
  const b = line[index]!;
  const span = b.t - a.t;
  const k = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
  const tangent = new Vector3(b.x - a.x, 0, b.z - a.z);
  if (tangent.lengthSq() < 1e-9) tangent.set(0, 0, -1);
  tangent.normalize();
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, tangent };
}

const cache = new WeakMap<IslandBlueprint, Map<string, readonly LearningSite[]>>();

/** Every learning node on the course, in segment order: checkpoint, personal, challenge. */
export function courseLearningSites(lessons: readonly LessonPlacement[]): readonly LearningSite[] {
  const blueprint = lessons[0]?.blueprint;
  if (!blueprint) return [];
  const segments = segmentsFromPlacements(lessons);
  const key = segments.map((segment) => segment.id).join("|");
  let perBlueprint = cache.get(blueprint);
  const hit = perBlueprint?.get(key);
  if (hit) return hit;

  const routeClearance = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
  const nodeClearance = blueprint.route.nodeRadius + NODE_GAP;
  const obstacles = obstaclesOf(blueprint);
  const taken: Obstacle[] = [];
  const nodes: Obstacle[] = [];
  const ground = createIslandHeightSampler(blueprint);
  const sites: LearningSite[] = [];
  try {
    const free = (x: number, z: number, radius: number) => {
      const centre = ground.heightAt(x, z);
      if (!centre.inside) return null;
      if (distanceToIslandRoute(blueprint, { x, z }) < routeClearance + radius) return null;
      if (
        lessons.some(
          (lesson) =>
            Math.hypot(x - lesson.position.x, z - lesson.position.z) < nodeClearance + radius,
        )
      )
        return null;
      if (!clearOf(x, z, radius, obstacles, taken)) return null;
      if (nodes.some((node) => Math.hypot(x - node.x, z - node.z) < node.r + radius + NODE_SPACING))
        return null;
      // The object stands on its own feet; refuse ground that falls away under them.
      for (let step = 0; step < 6; step += 1) {
        const a = (step / 6) * Math.PI * 2;
        const rim = ground.heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
        if (!rim.inside || Math.abs(rim.y - centre.y) > MAX_SLOPE_RISE) return null;
      }
      return centre.y;
    };
    const search = (desired: IslandPoint, radius: number) => {
      for (const ring of SEARCH_RINGS) {
        const count = ring === 0 ? 1 : SEARCH_ANGLES;
        for (let step = 0; step < count; step += 1) {
          const a = (step / count) * Math.PI * 2;
          const x = desired.x + Math.cos(a) * ring;
          const z = desired.z + Math.sin(a) * ring;
          const y = free(x, z, radius);
          if (y !== null) return new Vector3(x, y, z);
        }
      }
      return null;
    };
    const stonesBetween = (from: Vector3, to: Vector3, radius: number) => {
      const stones: Vector3[] = [];
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      for (
        let d = radius + STONE_SPACING * 0.7;
        d < length && stones.length < MAX_STONES;
        d += STONE_SPACING
      ) {
        const x = from.x + ((to.x - from.x) * d) / length;
        const z = from.z + ((to.z - from.z) * d) / length;
        if (distanceToIslandRoute(blueprint, { x, z }) < routeClearance) break;
        const sample = ground.heightAt(x, z);
        if (!sample.inside || !clearOf(x, z, 0.16, obstacles, taken)) continue;
        stones.push(new Vector3(x, sample.y, z));
      }
      return stones;
    };

    for (const segment of segments) {
      const index = lessons.findIndex(
        (lesson) => lesson.lessonId === segment.anchorLessonId && lesson.unitId === segment.unitId,
      );
      const anchor = lessons[index];
      if (!anchor) continue;
      const next = lessons[index + 1];
      const previous = lessons[index - 1];
      const tangent = next
        ? next.position.clone().sub(anchor.position)
        : previous
          ? anchor.position.clone().sub(previous.position)
          : new Vector3(0, 0, -1);
      tangent.y = 0;
      if (tangent.lengthSq() < 0.001) tangent.set(0, 0, -1);
      tangent.normalize();
      const side = new Vector3(-tangent.z, 0, tangent.x);

      for (const kind of ["checkpoint", "personal", "challenge"] as const) {
        const radius = LEARNING_SITE_RADIUS[kind];
        // The old glyph offsets are kept as the starting point, so a node still
        // appears where a returning learner last saw it whenever that is free.
        const desired = anchor.position
          .clone()
          .addScaledVector(side, kind === "personal" ? -SIDE_OFFSET : SIDE_OFFSET)
          .addScaledVector(tangent, -0.5);
        let found: Vector3 | null = null;
        let yaw: number | null = null;
        let branchFrom = anchor;
        if (kind === "checkpoint") {
          // Across the road, halfway to the next lesson: you walk through it
          // when the segment ends. Only the two posts need free verge.
          const nodeT = (id: string | undefined) =>
            blueprint.nodes.find((node) => node.id === id)?.t;
          const from = nodeT(anchor.lessonId);
          const to = nodeT(next?.lessonId) ?? nodeT(previous?.lessonId);
          if (from !== undefined && to !== undefined) {
            for (const share of [0.5, 0.38, 0.62, 0.28, 0.72]) {
              const road = roadAt(blueprint, from + (to - from) * share);
              const normal = new Vector3(-road.tangent.z, 0, road.tangent.x);
              const posts = [1, -1].map((sign) => ({
                x: road.x + normal.x * sign * LEARNING_GATE_HALF_SPAN,
                z: road.z + normal.z * sign * LEARNING_GATE_HALF_SPAN,
              }));
              const centre = ground.heightAt(road.x, road.z);
              const clearOfLessons = lessons.every(
                (lesson) =>
                  Math.hypot(road.x - lesson.position.x, road.z - lesson.position.z) >
                  nodeClearance + 0.2,
              );
              const postsFree = posts.every((post) => {
                const sample = ground.heightAt(post.x, post.z);
                return (
                  sample.inside &&
                  Math.abs(sample.y - centre.y) <= MAX_SLOPE_RISE &&
                  clearOf(post.x, post.z, 0.1 * LEARNING_NODE_SCALE, obstacles, taken)
                );
              });
              if (centre.inside && clearOfLessons && postsFree) {
                found = new Vector3(road.x, centre.y, road.z);
                yaw = Math.atan2(-normal.z, normal.x);
                break;
              }
            }
          }
        } else {
          found = search(desired, radius);
          // Still this segment's node wherever it stands: try the segment's
          // other lessons on the same side, then the far side of the road.
          const own = kind === "personal" ? -SIDE_OFFSET : SIDE_OFFSET;
          const alternates = segment.lessonIds
            .slice(0, -1)
            .reverse()
            .map((id) =>
              lessons.find((lesson) => lesson.lessonId === id && lesson.unitId === segment.unitId),
            )
            .filter((lesson): lesson is LessonPlacement => lesson !== undefined);
          for (const offset of [own, -own])
            for (const lesson of [anchor, ...alternates]) {
              if (found) break;
              if (lesson === anchor && offset === own) continue;
              found = search(lesson.position.clone().addScaledVector(side, offset), radius);
              if (found) branchFrom = lesson;
            }
        }
        const at =
          found ?? new Vector3(desired.x, ground.heightAt(desired.x, desired.z).y, desired.z);
        if (found) {
          // A gate's own ground is its two posts; its circle only spaces the others.
          if (kind !== "checkpoint") taken.push({ x: found.x, z: found.z, r: radius });
          nodes.push({ x: found.x, z: found.z, r: radius });
        }
        const branch =
          found && kind !== "checkpoint" ? stonesBetween(found, branchFrom.position, radius) : [];
        for (const stone of branch) taken.push({ x: stone.x, z: stone.z, r: 0.16 });
        sites.push({
          id: learningNodeId(segment, kind),
          segment,
          kind,
          ground: at,
          yaw,
          resolved: found !== null,
          branch,
        });
      }
    }
  } finally {
    ground.dispose();
  }
  if (!perBlueprint) {
    perBlueprint = new Map();
    cache.set(blueprint, perBlueprint);
  }
  perBlueprint.set(key, sites);
  return sites;
}
