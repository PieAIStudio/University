/** Large scenery is reserved after semantic facilities and BEFORE small
 * vegetation. This module owns no dressing/renderer imports or heightfield.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandTerrainFootprintRange, sampleIslandTerrainTop } from "./island-geometry.js";
import {
  distanceToIslandRoute,
  islandRouteClearance,
  islandRouteFrameAtFraction,
} from "./island-route-geometry.js";
import { hash } from "./random.js";
import { COURSE_ROCK_BANK_POINTS, COURSE_ROCK_BANK_TRIANGLES } from "./course-rock-profile.js";

export const COURSE_LANDSCAPE_LIMITS = {
  outcrops: 4,
  flora: 220,
  triangles: 50_000,
  outcropSides: 12,
  outcropTriangles: COURSE_ROCK_BANK_TRIANGLES,
  groundEmbed: 0.16,
  ruinTriangles: 348,
} as const;

export interface CourseOutcrop extends IslandPoint {
  readonly id: string;
  /** Art within the same proven volume, never an additional teaching place. */
  readonly feature?: "buttress" | "ruin";
  readonly radius: number;
  readonly height: number;
  readonly baseY: number;
  readonly groundRange: readonly [number, number];
  readonly turn: number;
  readonly footprint: readonly IslandPoint[];
  readonly meadow: number;
  /** Exact drawn-ground samples for the one closed bank, in model-point order. */
  readonly groundHeights?: readonly number[];
}

export function landscapeFootprint(
  x: number,
  z: number,
  radius: number,
  sides = 12,
): IslandPoint[] {
  return Array.from({ length: sides }, (_, i) => ({
    x: x + (Math.cos((i * Math.PI * 2) / sides) * radius) / Math.cos(Math.PI / sides),
    z: z + (Math.sin((i * Math.PI * 2) / sides) * radius) / Math.cos(Math.PI / sides),
  }));
}

export function planCourseOutcrops(
  blueprint: IslandBlueprint,
  occupied: readonly (IslandPoint & { readonly radius: number })[],
) {
  const field = islandFieldFor(blueprint),
    clear = islandRouteClearance(blueprint);
  const outcrops: CourseOutcrop[] = [];
  const search = {
    field: 0,
    route: 0,
    nodes: 0,
    hero: 0,
    occupied: 0,
    coast: 0,
    acceptedCandidate: 0,
    relief: 0,
    unknownFootprints: occupied.filter((p) => !Number.isFinite(p.radius)).length,
  };
  const nominal = Math.min(7.8, Math.max(2.7, blueprint.bounds.maxHalf * 0.132));
  const quota = blueprint.lessonCount <= 8 ? 1 : blueprint.lessonCount <= 24 ? 2 : 4;
  const candidates: {
    point: IslandPoint;
    radius: number;
    height: number;
    key: string;
    score: number;
  }[] = [];
  const consider = (point: IslandPoint, shrink: number, key: string) => {
    const radius = nominal * shrink;
    // A substantial leading stone, rather than a turf-covered low mound.
    // Its true height enters the existing route/node clearance below; a
    // bigger silhouette must find a safe reserve, never inherit a shorter one.
    const height = radius * (0.72 + hash(`${blueprint.seed}/terrace-height/${key}`) * 0.18);
    const sample = sampleIslandField(field, point.x, point.z);
    if (!sample.inside || sample.shore > 0.72 || sample.rock > 0.82) {
      search.field++;
      return;
    }
    const routeDistance = distanceToIslandRoute(blueprint, point);
    if (routeDistance < clear + radius + height * 1.4) {
      search.route++;
      return;
    }
    if (
      blueprint.nodes.some(
        (n) =>
          Math.hypot(n.x - point.x, n.z - point.z) <
          radius + height * 1.4 + blueprint.route.nodeRadius,
      )
    ) {
      search.nodes++;
      return;
    }
    if (
      Math.hypot(blueprint.hero.x - point.x, blueprint.hero.z - point.z) <
      blueprint.hero.radius + radius + 1
    ) {
      search.hero++;
      return;
    }
    if (occupied.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < radius + p.radius + 0.45)) {
      search.occupied++;
      return;
    }
    if (
      landscapeFootprint(point.x, point.z, radius).some(
        (p) => !sampleIslandField(field, p.x, p.z).inside,
      )
    ) {
      search.coast++;
      return;
    }
    search.acceptedCandidate++;
    candidates.push({
      point,
      radius,
      height,
      key,
      score:
        shrink * 4 +
        sample.rock * 1.2 +
        sample.grass * 0.35 -
        routeDistance * 0.025 +
        hash(`${blueprint.seed}/terrace/${key}`) * 0.6,
    });
  };
  for (let beat = 0; beat < 32; beat++) {
    const frame = islandRouteFrameAtFraction(blueprint, (beat + 0.5) / 32);
    if (!frame) continue;
    for (const shrink of [1, 0.8, 0.64, 0.56])
      for (const side of [-1, 1])
        for (const depth of [0, 2.5, 5, 8]) {
          const radius = nominal * shrink,
            distance = clear + radius * 2.12 + 0.8 + depth;
          consider(
            {
              x: frame.point.x + frame.baseNormal.x * distance * side,
              z: frame.point.z + frame.baseNormal.z * distance * side,
            },
            shrink,
            `route/${beat}/${shrink}/${side}/${depth}`,
          );
        }
  }
  for (let ix = -6; ix <= 6; ix++)
    for (let iz = -6; iz <= 6; iz++)
      for (const shrink of [1, 0.8, 0.64])
        consider(
          {
            x: (ix / 7) * blueprint.bounds.halfX * 0.9,
            z: (iz / 7) * blueprint.bounds.halfZ * 0.9,
          },
          shrink,
          `field/${ix}/${iz}/${shrink}`,
        );
  candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  for (const { point, radius, height, key } of candidates) {
    if (outcrops.length >= quota) break;
    if (outcrops.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < radius + p.radius + 7))
      continue;
    const footprint = landscapeFootprint(point.x, point.z, radius);
    const ground = islandTerrainFootprintRange(blueprint, footprint, "course");
    if (!ground || ground.maxY - ground.minY > Math.min(height * 0.65, 1.8)) {
      search.relief++;
      continue;
    }
    const closestRoute = blueprint.centerline.reduce(
      (best, p) =>
        Math.hypot(p.x - point.x, p.z - point.z) < Math.hypot(best.x - point.x, best.z - point.z)
          ? p
          : best,
      blueprint.centerline[0]!,
    );
    // The mass leans into the actual uphill shoulder. On effectively level
    // ground keep a stable authored variation, not a noisy slope direction.
    const uphill = footprint.reduce(
      (best, p) =>
        sampleIslandTerrainTop(blueprint, "course", p.x, p.z).y >
        sampleIslandTerrainTop(blueprint, "course", best.x, best.z).y
          ? p
          : best,
      footprint[0]!,
    );
    // The exposed face addresses the nearby teaching walk, not the camera.
    // Its back still seats against the actual sampled terrain. Previously
    // uphill-only facing often presented a featureless grassy dome to the walk.
    const away = { x: point.x - closestRoute.x, z: point.z - closestRoute.z };
    const shoulderTurn =
      Math.hypot(away.x, away.z) > 0.01
        ? Math.atan2(away.z, away.x)
        : Math.atan2(uphill.z - point.z, uphill.x - point.x);
    outcrops.push({
      ...point,
      id: `outcrop/${key}`,
      feature:
        outcrops.length === 1 && blueprint.themeSelection.accentPackIds.includes("fantasy-town-kit")
          ? "ruin"
          : "buttress",
      radius,
      height,
      baseY: ground.minY - COURSE_LANDSCAPE_LIMITS.groundEmbed,
      groundRange: [ground.minY, ground.maxY],
      footprint,
      turn:
        outcrops.length === 1 && blueprint.themeSelection.accentPackIds.includes("fantasy-town-kit")
          ? Math.atan2(point.x - closestRoute.x, closestRoute.z - point.z)
          : shoulderTurn,
      meadow: sampleIslandField(field, point.x, point.z).grass,
      groundHeights: COURSE_ROCK_BANK_POINTS.map(
        (p) =>
          sampleIslandTerrainTop(
            blueprint,
            "course",
            point.x + (p.x * Math.cos(shoulderTurn) - p.z * Math.sin(shoulderTurn)) * radius,
            point.z + (p.x * Math.sin(shoulderTurn) + p.z * Math.cos(shoulderTurn)) * radius,
          ).y,
      ),
    });
  }
  return { outcrops, search };
}
