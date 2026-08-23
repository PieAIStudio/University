/**
 * Where things stand on the map, decided by the courses rather than by hand.
 *
 * There is no level editor and no table of coordinates in this repository, on
 * purpose. A hand-placed map is a second copy of the course structure living
 * here, which is exactly the drift the parity contract exists to prevent — and
 * it is the copy nobody reviews, because it looks like art.
 *
 * Seeds are stable ids, never package hashes. A layout keyed to content would
 * be deterministic and still wrong: an author fixing one typo would rearrange a
 * learner's whole world overnight. Determinism and stability are different
 * properties and a map needs both.
 */
import * as THREE from "three";
import { hash } from "./random.js";

/**
 * A lesson count turned into a radius.
 *
 * Courses run from 1 lesson to 41. Linear scaling makes the largest island
 * forty times the smallest and unusable; scaling by area keeps a 41 visibly
 * bigger than a 12 while both stay clickable. The map tolerates content this
 * uneven because the content is not going to be regularised first.
 */
export const radiusForLessons = (lessons: number) => 0.55 + Math.sqrt(lessons) * 0.42;

export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly depth: number;
}

/**
 * The one road shape in this product, used at both map levels.
 *
 * Both levels used to have their own: courses were a radial prerequisite tree,
 * lessons were a sine road. Two shapes meant two mental models, and the tree
 * was the one nobody could steer — islands scattered across a sea, and finding
 * the next one meant hunting rather than walking.
 *
 * So there is one shape now, and it is a road. What differs between the levels
 * is scale, not idea: a study is a road of islands, a course is a road of
 * stones on one island. That is also why `step` and `amplitude` are parameters
 * rather than two copies of this function.
 *
 * The swing is a sine, not a strict left-right alternation. Alternating every
 * step reads as a zigzag, and a zigzag is a decoration; a curve that leans out,
 * comes back and leans the other way reads as a road going somewhere.
 */
export interface PathShape {
  /** Forward spacing between two neighbours. */
  readonly step: number;
  /** How far the road leans off centre. */
  readonly amplitude: number;
  /** Nodes per full swing. Deliberately not the unit size — see below. */
  readonly period: number;
}

/**
 * Islands on the study road.
 *
 * `step` matches the spacing the radial tree happened to produce (6.4 to 7.4
 * between neighbours), so swapping the shape did not silently rescale the
 * whole world and invalidate the camera distances tuned against it.
 *
 * The period is 7 and not the number of courses in anything, because a period
 * that matched a structural size would put every boundary at the same point in
 * the curve and the road would visibly repeat.
 */
export const STUDY_PATH: PathShape = { step: 7.4, amplitude: 5.5, period: 7 };

/**
 * Stones on the course road, which now lie on one island's surface rather than
 * on 41 islands of their own.
 *
 * Tighter than the study road in both axes: these are markers on the ground,
 * not land masses, so they can sit close without touching. Amplitude is wide
 * relative to step on purpose — a shallow wiggle on a flat surface reads as a
 * straight line with a rendering error.
 */
export const COURSE_PATH: PathShape = { step: 4.4, amplitude: 6.4, period: 7 };

/** Kept for the camera: the forward spacing the course shot is framed against. */
export const COURSE_STEP = COURSE_PATH.step;
export const COURSE_AMPLITUDE = COURSE_PATH.amplitude;

/**
 * `count` nodes along one road, centred on the origin.
 *
 * Centred rather than starting at zero because both callers measure the extent
 * of what came back to size something — the sea ring at study level, the island
 * at course level — and a road that runs from 0 to −222 has a centroid nowhere
 * near its own origin, which makes every such measurement wrong by half the
 * road.
 *
 * `depth` is the index. Nothing reads it as a tree depth any more; it stays so
 * a caller can recover the order from a placement without zipping two arrays.
 */
export function layoutPath(count: number, shape: PathShape): Placed[] {
  const span = (count - 1) * shape.step;
  return Array.from({ length: count }, (_, index) => ({
    x: shape.amplitude * Math.sin((index / shape.period) * Math.PI * 2),
    y: 0,
    z: span / 2 - index * shape.step,
    depth: index,
  }));
}

/**
 * One study, laid out as a road in teaching order.
 *
 * This used to be a radial tree drawn from `prerequisiteCourseIds`, with a
 * causeway per prerequisite. The tree was the honest shape of the graph and it
 * was still the wrong drawing: nine branches opening at once is a decision the
 * learner is not being asked to make, so the map spent its pixels illustrating
 * a structure instead of answering "where do I go now".
 *
 * The order comes from the caller, which gets it from the study spine — an
 * authored teaching order that `validateSpine` already proves is a legal linear
 * extension of the prerequisite graph. So nothing pedagogical is lost by
 * drawing a line: the line *is* the prerequisites, flattened by someone who
 * decided which branch to teach first.
 *
 * What is lost is the picture of the branches. Prerequisites still gate what
 * opens; they are simply no longer drawn as roads, because a road you cannot
 * walk is furniture.
 */
export function layoutStudyRoad(orderedCourseIds: readonly string[]): Map<string, Placed> {
  const points = layoutPath(orderedCourseIds.length, STUDY_PATH);
  const placed = new Map<string, Placed>();
  orderedCourseIds.forEach((id, index) => {
    const point = points[index]!;
    // A hair of jitter so a long straight-ish stretch does not read as a ruler.
    // Two percent of a step is below the threshold where anyone reads it as
    // disorder and above the one where the eye starts seeing a grid.
    placed.set(id, {
      ...point,
      x: point.x + (hash(`${id}:sway`) * 2 - 1) * STUDY_PATH.step * 0.02,
    });
  });
  return placed;
}

/**
 * One course as a road of stones, flat, because it is lying on an island.
 *
 * The climb this function used to have was the best thing about it — looking
 * back down a course showed distance rather than a percentage. It is gone
 * because the stones are no longer islands in the air; they sit on one surface,
 * and a surface that steps up under every fourth stone is a staircase, not
 * ground. The island's own dome supplies what rise there is.
 *
 * `unitSizes` still comes in, and is still ignored for the shape. Unit
 * boundaries are a label on the ground now, not a shelf in the terrain: a unit
 * is a chapter heading, and a chapter heading does not change the floor.
 */
export function layoutCourse(unitSizes: readonly number[]): Placed[] {
  const total = unitSizes.reduce((sum, count) => sum + count, 0);
  const points = layoutCourseRoad(total);
  const out: Placed[] = [];
  let index = 0;
  unitSizes.forEach((count, unitIndex) => {
    for (let slot = 0; slot < count; slot += 1) {
      out.push({ ...points[index]!, depth: unitIndex });
      index += 1;
    }
  });
  return out;
}

/**
 * A course road is compact without becoming a maze.
 *
 * The old road advanced `COURSE_PATH.step` along Z for every lesson. Forty-one
 * lessons therefore needed 176 world units of ground while the whole lateral
 * swing was only 13, which is the long green strip the course screenshot
 * exposed. Making the markers smaller would only hide the symptom.
 *
 * This road spends the same distance by meandering. A Catmull-Rom curve gives
 * it a continuous tangent (the island generator uses that tangent for its
 * shoreline), and `getSpacedPoints` keeps neighbouring lesson markers evenly
 * separated even where the curve turns. Short courses keep the quieter road;
 * there is no reason to draw a full S for three lessons.
 */
export function layoutCourseRoad(count: number): Placed[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0, z: 0, depth: 0 }];
  if (count <= 6) {
    return layoutPath(count, {
      ...COURSE_PATH,
      amplitude: Math.min(COURSE_PATH.amplitude, 1.8 + count * 0.55),
      period: 9,
    });
  }

  const swings = Math.max(1, Math.ceil(count / 16));
  const span = Math.max(COURSE_PATH.step * 5, (count - 1) * COURSE_PATH.step * 0.34);
  const amplitude = Math.min(14.5, 5.5 + Math.sqrt(count) * 1.35);
  const controls = Array.from({ length: swings * 6 + 1 }, (_, index) => {
    const t = index / (swings * 6);
    return new THREE.Vector3(
      Math.sin(t * swings * Math.PI * 2) * amplitude,
      0,
      span / 2 - t * span,
    );
  });
  const curve = new THREE.CatmullRomCurve3(controls, false, "centripetal", 0.5);
  return curve.getSpacedPoints(count - 1).map((point, index) => ({
    x: point.x,
    y: 0,
    z: point.z,
    depth: index,
  }));
}

/**
 * The island a course road lies on, as half-extents.
 *
 * Sized from the road rather than from the lesson count so the ground always
 * contains its own path — a 41-lesson course is a long ridge because it *is*
 * long, and inventing a rounder island for it would put stones in the sea.
 */
export function courseIslandExtent(lessons: number): { readonly x: number; readonly z: number } {
  const points = layoutCourseRoad(Math.max(lessons, 1));
  const halfX = Math.max(...points.map((point) => Math.abs(point.x)), COURSE_PATH.amplitude);
  const halfZ = Math.max(...points.map((point) => Math.abs(point.z)), COURSE_PATH.step);
  // Margin is a step's worth of shore — enough that the outermost marker is not
  // sitting on the rim where the lathe profile has already started falling
  // away. It was 1.8 steps, which put 60% of the island's width outside the
  // road: the markers then read as specks on a field rather than as the thing
  // the field is for.
  return { x: halfX + COURSE_PATH.step * 1.4, z: halfZ + COURSE_PATH.step * 1.4 };
}
