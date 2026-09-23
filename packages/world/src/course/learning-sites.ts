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
  LEARNING_NODE_KIND_SCALE,
  LEARNING_NODE_POST_SINK,
  LEARNING_OBJECT_OFFSET,
  LEARNING_PAD_RADIUS,
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
 *
 * Every node is also somewhere the avatar can stand, like a lesson stone: under
 * the gate, in the road; or on a pad beside the pennant or the board, with the
 * object just behind it, away from the road the camera stands on.
 */

export interface LearningSite {
  readonly id: string;
  readonly segment: LearningSegment;
  readonly kind: MapLearningKind;
  /**
   * Where the avatar lands, in blueprint space; y is the drawn terrain height.
   * The gate's road centre, or the centre of the node's pad.
   */
  readonly ground: Vector3;
  /** Where the object itself stands: the gate's centre, or just behind the pad. */
  readonly object: Vector3;
  /**
   * A fixed heading (the gate spans the road, so the road decides), or null for
   * objects that turn to face the camera.
   */
  readonly yaw: number | null;
  /** False when no free ground was found: the chip stays, no object is drawn. */
  readonly resolved: boolean;
  /** Stepping stones from the road edge to the object; empty for checkpoints. */
  readonly branch: readonly Vector3[];
  /**
   * The lesson whose state opens this node (V5 R59): the gate opens once its
   * segment is reached (the segment's first lesson), the pennant and the board
   * once the lesson they stand beside is. Until then the node is locked.
   */
  readonly opensWith: string;
}

/**
 * What the island draws for a segment (V5, R59): a gate at the end of every
 * segment, and one of the two roadside nodes, taking turns — the board first,
 * where a newcomer has nothing to play with yet. The course's opportunity list
 * still offers all three for every segment; the island is the curated subset.
 */
export function islandLearningKinds(segment: {
  readonly ordinal: number;
}): readonly MapLearningKind[] {
  return ["checkpoint", segment.ordinal % 2 === 1 ? "personal" : "challenge"];
}

/** A node is locked while the lesson that opens it is (V5 §12 decision C′, R59). */
export function learningSiteLocked(
  site: Pick<LearningSite, "opensWith">,
  lessons: readonly Pick<LessonPlacement, "lessonId" | "state">[],
): boolean {
  return lessons.find((lesson) => lesson.lessonId === site.opensWith)?.state === "locked";
}

/**
 * Ground radius each object needs around `object`, in blueprint units (lesson
 * node radius is 0.62). The gate's own footprint is its two posts; its radius
 * is only what other nodes keep clear of it. The board turns to face the
 * camera, so its whole width sweeps this circle.
 */
export const LEARNING_SITE_RADIUS: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 0.55 * LEARNING_NODE_KIND_SCALE.checkpoint,
  challenge: 0.14 * LEARNING_NODE_KIND_SCALE.challenge,
  personal: 0.32 * LEARNING_NODE_KIND_SCALE.personal,
};
/** How tall each object stands, so the DOM chip sits above it rather than inside it. */
export const LEARNING_SITE_HEIGHT: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 1.15 * LEARNING_NODE_KIND_SCALE.checkpoint,
  challenge: 1.32 * LEARNING_NODE_KIND_SCALE.challenge,
  personal: 0.9 * LEARNING_NODE_KIND_SCALE.personal,
};

/** Where the pad is first looked for, beside its lesson. */
const SIDE_OFFSET = 2.5;
const SEARCH_RINGS = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2, 3.6, 4.0];
const SEARCH_ANGLES = 16;
const NODE_GAP = 0.25;
/** Learning nodes keep this much open ground between each other, so three reads as three. */
const NODE_SPACING = 0.85;
const OBSTACLE_GAP = 0.12;
/** Steepest drop under a footprint; posts sink deeper than this (see the geometry). */
export const MAX_SLOPE_RISE = 0.22;
/**
 * How far a pad's rim may sit from its centre. The pad leans into the ground by
 * the lesson stones' own pose rule, so it can take the verge's real slopes: at
 * the R58 0.12 (a flat disc) the lesson-sized pads of R59 found ground for only
 * seven of eleven roadside nodes on a 36-lesson course; at 0.2, all eleven.
 */
export const PAD_SLOPE_RISE = 0.2;
/**
 * Where a road crosses a side slope, the gate's two posts stand at different
 * heights. The posts sink 0.69 below the road centre, so a post on the low
 * side still meets the ground up to this drop; the high side just buries more
 * post. Holding the gate to the 0.22 of free-standing objects left a quarter of
 * the gates on a real 36-lesson course undrawn.
 */
export const GATE_SLOPE_RISE = 0.5;
if (
  LEARNING_NODE_POST_SINK * Math.min(...Object.values(LEARNING_NODE_KIND_SCALE)) <=
    MAX_SLOPE_RISE ||
  LEARNING_NODE_POST_SINK * LEARNING_NODE_KIND_SCALE.checkpoint <= GATE_SLOPE_RISE + 0.1
)
  throw new Error("learning-node posts must sink deeper than the steepest accepted ground");
/** The avatar's ring under a gate must not overlap either lesson stone beside it. */
const AVATAR_RING_RADIUS = 0.72;
const STONE_SPACING = 0.42;
const MAX_STONES = 6;

interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/**
 * The road gap each segment's gate spans: after the segment's last lesson, or
 * before it when the segment ends the course (the road ends at that lesson).
 * The blueprint widens exactly these gaps (`checkpointGaps`), so the planner
 * and the geometry cannot disagree about where a gate goes.
 */
export function checkpointGapOf(
  segment: { readonly lastIndex: number },
  lessonCount: number,
): number | null {
  const gap = segment.lastIndex < lessonCount - 1 ? segment.lastIndex : segment.lastIndex - 1;
  return gap >= 0 ? gap : null;
}

/** The same gaps from nothing but lessons per unit: what a catalogue node knows. */
export function checkpointGapsForUnitSizes(unitLessonCounts: readonly number[]): readonly number[] {
  let next = 0;
  const units = unitLessonCounts.map((count, unit) => ({
    id: `unit-${unit}`,
    title: "",
    lessons: Array.from({ length: count }, () => ({ id: `lesson-${next++}` })),
  }));
  return checkpointGaps(learningSegments({ units }), next);
}

export function checkpointGaps(
  segments: readonly { readonly lastIndex: number }[],
  lessonCount: number,
): readonly number[] {
  return [
    ...new Set(
      segments
        .map((segment) => checkpointGapOf(segment, lessonCount))
        .filter((gap): gap is number => gap !== null),
    ),
  ].sort((a, b) => a - b);
}

/** Segments as the app derives them, rebuilt from the placements' own order. */
export function segmentsFromPlacements(
  lessons: readonly Pick<LessonPlacement, "unitId" | "unitTitle" | "lessonId">[],
) {
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

/**
 * Everything already standing on a course island, as circles: dressing
 * footprints, landmark courtyards, multi-part assemblies and every landscape
 * item. The learning nodes and the wildflowers both keep off exactly this.
 */
export function courseStandingFootprints(blueprint: IslandBlueprint): readonly Obstacle[] {
  return obstaclesOf(blueprint);
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
    const free = (x: number, z: number, radius: number, rise = MAX_SLOPE_RISE) => {
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
        if (!rim.inside || Math.abs(rim.y - centre.y) > rise) return null;
      }
      return centre.y;
    };
    /** Unit vector pointing away from the road at a point: where "behind the pad" is. */
    const awayFromRoad = (x: number, z: number) => {
      const e = 0.05;
      const dx =
        distanceToIslandRoute(blueprint, { x: x + e, z }) -
        distanceToIslandRoute(blueprint, { x: x - e, z });
      const dz =
        distanceToIslandRoute(blueprint, { x, z: z + e }) -
        distanceToIslandRoute(blueprint, { x, z: z - e });
      const away = new Vector3(dx, 0, dz);
      return away.lengthSq() > 1e-9 ? away.normalize() : null;
    };
    /** A pad centre and the object behind it, both on free ground, or null. */
    const standing = (x: number, z: number, kind: "challenge" | "personal") => {
      const padY = free(x, z, LEARNING_PAD_RADIUS, PAD_SLOPE_RISE);
      if (padY === null) return null;
      const away = awayFromRoad(x, z);
      if (!away) return null;
      const ox = x + away.x * LEARNING_OBJECT_OFFSET[kind];
      const oz = z + away.z * LEARNING_OBJECT_OFFSET[kind];
      const objectY = free(ox, oz, LEARNING_SITE_RADIUS[kind]);
      if (objectY === null) return null;
      return { pad: new Vector3(x, padY, z), object: new Vector3(ox, objectY, oz) };
    };
    const search = (desired: IslandPoint, kind: "challenge" | "personal") => {
      for (const ring of SEARCH_RINGS) {
        const count = ring === 0 ? 1 : SEARCH_ANGLES;
        for (let step = 0; step < count; step += 1) {
          const a = (step / count) * Math.PI * 2;
          const found = standing(
            desired.x + Math.cos(a) * ring,
            desired.z + Math.sin(a) * ring,
            kind,
          );
          if (found) return found;
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

      for (const kind of islandLearningKinds(segment)) {
        // The gate closes the segment; the board or the pennant stands beside
        // the segment's middle lesson, clear of the gate's posts at its end.
        const baseId =
          kind === "checkpoint"
            ? segment.lessonIds.at(-1)
            : segment.lessonIds[Math.floor((segment.lessonIds.length - 1) / 2)];
        const base =
          lessons.find(
            (lesson) => lesson.lessonId === baseId && lesson.unitId === segment.unitId,
          ) ?? anchor;
        const desired = base.position
          .clone()
          .addScaledVector(side, kind === "personal" ? -SIDE_OFFSET : SIDE_OFFSET);
        let found: { pad: Vector3; object: Vector3 } | null = null;
        let yaw: number | null = null;
        let branchFrom = base;
        if (kind === "checkpoint") {
          // Across the road in the gap the blueprint widened for it: you walk
          // through it when the segment ends. Only the two posts need free verge.
          const gap = checkpointGapOf(segment, lessons.length);
          const nodeT = (at: number) => blueprint.nodes[at]?.t;
          const from = gap === null ? undefined : nodeT(gap);
          const to = gap === null ? undefined : nodeT(gap + 1);
          if (from !== undefined && to !== undefined) {
            for (const share of [0.5, 0.42, 0.58, 0.35, 0.65]) {
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
                  blueprint.route.nodeRadius + AVATAR_RING_RADIUS + 0.04,
              );
              const postsFree = posts.every((post) => {
                const sample = ground.heightAt(post.x, post.z);
                return (
                  sample.inside &&
                  Math.abs(sample.y - centre.y) <= GATE_SLOPE_RISE &&
                  clearOf(
                    post.x,
                    post.z,
                    0.1 * LEARNING_NODE_KIND_SCALE.checkpoint,
                    obstacles,
                    taken,
                  )
                );
              });
              if (centre.inside && clearOfLessons && postsFree) {
                const at = new Vector3(road.x, centre.y, road.z);
                found = { pad: at, object: at };
                yaw = Math.atan2(-normal.z, normal.x);
                break;
              }
            }
          }
        } else {
          found = search(desired, kind);
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
            for (const lesson of [base, ...alternates.filter((item) => item !== base), anchor]) {
              if (found) break;
              if (lesson === base && offset === own) continue;
              found = search(lesson.position.clone().addScaledVector(side, offset), kind);
              if (found) branchFrom = lesson;
            }
        }
        const fallback = new Vector3(desired.x, ground.heightAt(desired.x, desired.z).y, desired.z);
        if (found && kind !== "checkpoint") {
          // A gate's own ground is its two posts; its circle only spaces the others.
          taken.push({ x: found.pad.x, z: found.pad.z, r: LEARNING_PAD_RADIUS });
          taken.push({ x: found.object.x, z: found.object.z, r: LEARNING_SITE_RADIUS[kind] });
          nodes.push({ x: found.pad.x, z: found.pad.z, r: LEARNING_PAD_RADIUS });
        }
        if (found)
          nodes.push({ x: found.object.x, z: found.object.z, r: LEARNING_SITE_RADIUS[kind] });
        const branch =
          found && kind !== "checkpoint"
            ? stonesBetween(found.pad, branchFrom.position, LEARNING_PAD_RADIUS)
            : [];
        for (const stone of branch) taken.push({ x: stone.x, z: stone.z, r: 0.16 });
        sites.push({
          id: learningNodeId(segment, kind),
          segment,
          kind,
          ground: found?.pad ?? fallback,
          object: found?.object ?? fallback,
          yaw,
          resolved: found !== null,
          branch,
          opensWith:
            kind === "checkpoint" ? (segment.lessonIds[0] ?? anchor.lessonId) : branchFrom.lessonId,
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
