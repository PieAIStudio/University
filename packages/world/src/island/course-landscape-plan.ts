/** Low scenery follows the canonical dressing plan's large rock reservations.
 * No camera/progress input, second heightfield or per-course coordinate table.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandTerrainFootprintRange, sampleIslandTerrainTop } from "./island-geometry.js";
import { placementFootprintRadius, type IslandDressingPlan } from "./island-dressing.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { miniatureMetrics } from "./miniature-layout.js";
import { seeded } from "./random.js";
import { courseGardenEdges, type CourseGardenEdge } from "./course-garden-edges.js";
import { courseGroundStones, type CourseGroundStone } from "./course-ground-stone.js";
import { courseStallPlan, type CourseCraftedStall } from "./course-stall-plan.js";
import { COURSE_STALL_TRIANGLE_CEILING } from "./course-stall-geometry.js";
import { courseShoulderCanopy, type ShoulderCanopy } from "./course-shoulder-canopy.js";
import { COURSE_SCENIC_TREE_TRIANGLES } from "./miniature-assets.js";
import { courseAcademyPlan, type CourseAcademy } from "./course-academy-plan.js";
import { COURSE_ACADEMY_TRIANGLE_CEILING } from "./course-academy-geometry.js";
import { courseRockTopPoints, sampleCourseRockTop } from "./course-rock-profile.js";
import {
  overlapsCourseSpring,
  COURSE_SPRING_TRIANGLE_CEILING,
  type CourseSpring,
} from "./course-spring-plan.js";
import {
  COURSE_LANDSCAPE_LIMITS,
  landscapeFootprint,
  type CourseOutcrop,
} from "./course-outcrop-plan.js";
export { COURSE_LANDSCAPE_LIMITS, type CourseOutcrop } from "./course-outcrop-plan.js";

export interface CourseFlora extends IslandPoint {
  readonly supportId?: string;
  readonly id: string;
  readonly asset: "flowers" | "grass";
  readonly y: number;
  readonly size: number;
  readonly radius: number;
  readonly turn: number;
  readonly anchorId: string;
  readonly groundRange: readonly [number, number];
}
export interface CourseLandscapePlan {
  readonly academies?: readonly CourseAcademy[];
  readonly canopy?: readonly ShoulderCanopy[];
  readonly borders?: readonly CourseGardenEdge[];
  readonly stones?: readonly CourseGroundStone[];
  readonly stalls?: readonly CourseCraftedStall[];
  readonly outcrops: readonly CourseOutcrop[];
  readonly flora: readonly CourseFlora[];
  readonly spring: CourseSpring | null;
  readonly search: Readonly<Record<string, number>>;
}

/** Only a successfully fitted replacement owns a source placement. Eligibility
 * is not ownership: a rejected support must leave the registered donor drawn.
 * Renderer and inspector consume this same set, never parallel kind filters.
 */
export function courseReplacementIds(plan: CourseLandscapePlan): ReadonlySet<string> {
  return new Set([
    ...[...(plan.stones ?? []), ...(plan.stalls ?? [])].map((p) => p.id),
    ...(plan.academies ?? []).flatMap((p) => p.sourceIds),
  ]);
}
const plans = new WeakMap<IslandBlueprint, WeakMap<IslandDressingPlan, CourseLandscapePlan>>();

export function courseLandscapePlan(
  blueprint: IslandBlueprint,
  dressing: IslandDressingPlan,
): CourseLandscapePlan {
  const previous = plans.get(blueprint)?.get(dressing);
  if (previous) return previous;
  const field = islandFieldFor(blueprint),
    clear = islandRouteClearance(blueprint);
  const occupied = dressing.placements.map((p) => ({ ...p, radius: placementFootprintRadius(p) }));
  const outcrops = dressing.landscape?.outcrops ?? [];
  const spring = dressing.landscape?.spring ?? null;
  const flora: CourseFlora[] = [];
  const borders = courseGardenEdges(blueprint, dressing);
  const stones = courseGroundStones(blueprint, dressing);
  const stalls = courseStallPlan(blueprint, dressing);
  const canopy = courseShoulderCanopy(blueprint, dressing, outcrops);
  const academies = courseAcademyPlan(blueprint, dressing);
  const anchors = [
    ...borders.map((p) => ({ ...p, count: 2 })),
    ...outcrops.map((p) => ({ ...p, count: 10 })),
    ...occupied
      .filter((p) => p.kind !== "bush")
      .map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        radius: p.radius,
        count: p.kind === "tree" ? 3 : 4,
      })),
  ];
  let triangleBudget = outcrops.reduce(
    (sum, site) =>
      sum +
      (site.feature === "ruin"
        ? COURSE_LANDSCAPE_LIMITS.ruinTriangles
        : COURSE_LANDSCAPE_LIMITS.outcropTriangles),
    0,
  );
  if (spring) triangleBudget += COURSE_SPRING_TRIANGLE_CEILING;
  triangleBudget += borders.length * miniatureMetrics("fence").triangles;
  triangleBudget += stones.length * miniatureMetrics("stone").triangles;
  triangleBudget += stalls.length * COURSE_STALL_TRIANGLE_CEILING;
  triangleBudget += canopy.reduce((sum, p) => sum + COURSE_SCENIC_TREE_TRIANGLES[p.asset], 0);
  triangleBudget += academies.length * COURSE_ACADEMY_TRIANGLE_CEILING;
  for (const anchor of anchors) {
    const random = seeded(`${blueprint.seed}/flora/${anchor.id}`);
    const closestPath = blueprint.centerline.reduce(
      (best, p) =>
        Math.hypot(p.x - anchor.x, p.z - anchor.z) <
        Math.hypot(best.x - anchor.x, best.z - anchor.z)
          ? p
          : best,
      blueprint.centerline[0]!,
    );
    const forestEdge = Math.atan2(closestPath.z - anchor.z, closestPath.x - anchor.x);
    for (let member = 0; member < anchor.count; member++) {
      if (flora.length >= COURSE_LANDSCAPE_LIMITS.flora) break;
      const asset = member % 3 === 2 ? "grass" : "flowers";
      const triangles = miniatureMetrics(asset).triangles;
      if (triangleBudget + triangles > COURSE_LANDSCAPE_LIMITS.triangles) continue;
      // Fewer legible bouquets rather than subpixel flower confetti; the
      // original footprint, node and path tests still decide whether they fit.
      const nominalSize = asset === "flowers" ? 2.1 + random() * 0.65 : 2.2 + random() * 0.9;
      for (let attempt = 0; attempt < 14; attempt++) {
        // Narrow shoulders retain a smaller real bouquet after the larger
        // fit has failed. Keep coverage without relaxing support/route gates.
        const size = nominalSize * (attempt >= 10 ? 0.76 : 1);
        const radius = miniatureMetrics(asset).radius * size;
        // A broken, route-facing crescent around each place/forest edge,
        // rather than separate flowers evenly surrounding every object.
        const angle = forestEdge + (random() - 0.5) * 2.1;
        const distance = anchor.radius + radius + 0.22 + random() * 0.85;
        const x = anchor.x + Math.cos(angle) * distance,
          z = anchor.z + Math.sin(angle) * distance;
        const sample = sampleIslandField(field, x, z);
        if (!sample.inside || sample.shore > 0.84 || sample.grass < 0.05) continue;
        if (spring && overlapsCourseSpring(spring, { x, z }, radius)) continue;
        if (distanceToIslandRoute(blueprint, { x, z }) < clear + radius + 0.16) continue;
        if (
          blueprint.nodes.some(
            (n) => Math.hypot(n.x - x, n.z - z) < blueprint.route.nodeRadius + radius + 0.5,
          )
        )
          continue;
        if (outcrops.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.1)) continue;
        if (borders.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.04)) continue;
        if (
          occupied.some(
            (p) =>
              Math.hypot(p.x - x, p.z - z) <
              (p.kind === "tree" ? p.height * 0.12 : p.radius) + radius + 0.08,
          )
        )
          continue;
        if (flora.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.04)) continue;
        const ground = islandTerrainFootprintRange(
          blueprint,
          landscapeFootprint(x, z, radius, 8),
          "course",
        );
        if (!ground || ground.maxY - ground.minY > 0.15) continue;
        flora.push({
          id: `${anchor.id}/${member}`,
          asset,
          x,
          z,
          y: ground.minY - 0.012,
          size,
          radius,
          turn: random() * Math.PI * 2,
          anchorId: anchor.id,
          groundRange: [ground.minY, ground.maxY],
        });
        triangleBudget += triangles;
        break;
      }
    }
  }
  // A few living shoulder tufts, seated on the actual rock triangles. These
  // read as mossy landscape continuity rather than a sterile model on a lawn.
  // They use the same two miniature plant assets and the same existing draw.
  for (const site of outcrops) {
    if (site.feature === "ruin") continue;
    const points = courseRockTopPoints(site);
    for (const [i, local] of [
      [-0.12, -0.42],
      [0.11, 0.07],
      [-0.02, 0.39],
    ].entries()) {
      const asset = i === 1 ? "flowers" : "grass";
      const size = asset === "flowers" ? 1.45 : 1.9;
      const metrics = miniatureMetrics(asset),
        radius = size * metrics.radius;
      if (
        flora.length >= COURSE_LANDSCAPE_LIMITS.flora ||
        triangleBudget + metrics.triangles > COURSE_LANDSCAPE_LIMITS.triangles
      )
        continue;
      const x =
        site.x + (local[0]! * Math.cos(site.turn) - local[1]! * Math.sin(site.turn)) * site.radius;
      const z =
        site.z + (local[0]! * Math.sin(site.turn) + local[1]! * Math.cos(site.turn)) * site.radius;
      if (
        distanceToIslandRoute(blueprint, { x, z }) <
        clear + radius + (site.height + size * metrics.height) * 1.4
      )
        continue;
      const samples = [{ x, z }, ...landscapeFootprint(x, z, radius)].map((p) =>
        sampleCourseRockTop(points, p.x, p.z),
      );
      if (samples.some((y) => y === null)) continue;
      const heights = samples as number[],
        low = Math.min(...heights),
        high = Math.max(...heights);
      if (high - low > 0.12) continue;
      if (canopy.some((p) => Math.hypot(p.x - x, p.z - z) < p.size * 0.13 + radius + 0.05))
        continue;
      flora.push({
        id: `${site.id}/shoulder/${i}`,
        anchorId: site.id,
        supportId: site.id,
        asset,
        x,
        z,
        y: low - 0.012,
        size,
        radius,
        turn: site.turn + i * 1.7,
        groundRange: [low, high],
      });
      triangleBudget += metrics.triangles;
    }
  }
  const result = {
    outcrops,
    flora,
    borders,
    stones,
    stalls,
    canopy,
    academies,
    spring,
    search: dressing.landscape?.search ?? {},
  };
  let byDressing = plans.get(blueprint);
  if (!byDressing) {
    byDressing = new WeakMap();
    plans.set(blueprint, byDressing);
  }
  byDressing.set(dressing, result);
  return result;
}

export { courseTreeIsFir } from "./course-tree-envelope.js";
export const courseLandscapeGround = (blueprint: IslandBlueprint, p: IslandPoint) =>
  sampleIslandTerrainTop(blueprint, "course", p.x, p.z);
