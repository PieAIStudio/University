/** A bounded coastal spring from the SAME rendered course terrain. No fluid
 * simulation, second heightfield, per-course coordinates, or new route. */
import { pointInsideOutline, type IslandBlueprint, type IslandPoint } from "./island-blueprint.js";
import { islandTerrainFootprintRange, sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { hash } from "./random.js";

export interface SpringSection extends IslandPoint {
  readonly y: number;
  readonly halfWidth: number;
  readonly groundRange: readonly [number, number];
}
export interface CourseSpring {
  readonly id: string;
  readonly basin: SpringSection & { readonly radius: number };
  readonly direction: IslandPoint;
  readonly channel: readonly SpringSection[];
  /** First cross-section entirely outside the canonical island outline. */
  readonly lip: IslandPoint;
  readonly drop: number;
}
export const COURSE_SPRING_TRIANGLE_CEILING = 800;

/** Retain shallow head over a small bed ripple instead of greedily dropping
 * to each low vertex and then demanding that water climb the next one. This
 * never raises the preceding water level or the existing 0.26 depth limit. */
export function springWaterLevel(previous: number, low: number, high: number): number | null {
  if (![previous, low, high].every(Number.isFinite) || low > high) return null;
  const y = Math.min(previous, low + 0.24);
  return y >= high + 0.005 && y - low <= 0.26 ? y : null;
}

/** Conservative occupancy for later flowers. The decorative falling part is
 * outside the course land; only the basin and stream reserve growing space. */
export function overlapsCourseSpring(
  spring: CourseSpring,
  p: IslandPoint,
  radius: number,
): boolean {
  if (Math.hypot(p.x - spring.basin.x, p.z - spring.basin.z) < spring.basin.radius * 1.18 + radius)
    return true;
  return spring.channel.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < s.halfWidth + 0.32 + radius);
}

export function planCourseSpring(
  blueprint: IslandBlueprint,
  occupied: readonly (IslandPoint & { readonly radius: number })[],
): CourseSpring | null {
  if (blueprint.lessonCount < 12 || occupied.some((p) => !Number.isFinite(p.radius))) return null;
  const clearance = islandRouteClearance(blueprint);
  const nominal = Math.min(2.1, Math.max(1.25, blueprint.bounds.maxHalf * 0.053));
  const clearAt = (p: IslandPoint, radius: number) =>
    distanceToIslandRoute(blueprint, p) >= clearance + radius + 0.25 &&
    Math.hypot(p.x - blueprint.hero.x, p.z - blueprint.hero.z) >= blueprint.hero.radius + radius &&
    blueprint.nodes.every(
      (n) => Math.hypot(n.x - p.x, n.z - p.z) >= blueprint.route.nodeRadius + radius + 0.35,
    ) &&
    occupied.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= radius + o.radius + 0.2);
  // All coordinates come from the coast. The stable +X/+Z viewing approach
  // breaks otherwise equal art candidates; safety never depends on a camera.
  const candidates = blueprint.outline
    .filter((_, i) => i % 3 === 0)
    .map((point, i) => {
      const length = Math.hypot(point.x, point.z);
      return {
        point,
        id: i,
        score:
          point.x / length +
          (point.z / length) * 0.45 +
          hash(`${blueprint.seed}/spring/${i}`) * 0.08,
      };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);

  for (const candidate of candidates)
    for (const shrink of [1, 0.82, 0.68]) {
      const radius = nominal * shrink;
      const length = Math.hypot(candidate.point.x, candidate.point.z);
      const direction = { x: candidate.point.x / length, z: candidate.point.z / length };
      const x = candidate.point.x - direction.x * (radius * 1.3 + 1.2);
      const z = candidate.point.z - direction.z * (radius * 1.3 + 1.2);
      const footprint = landscapeFootprint(x, z, radius * 1.18, 16);
      if (
        !clearAt({ x, z }, radius * 1.18) ||
        footprint.some((p) => !pointInsideOutline(p, blueprint.outline))
      )
        continue;
      const ground = islandTerrainFootprintRange(blueprint, footprint, "course");
      if (!ground || ground.maxY - ground.minY > 0.2) continue;
      const basin = {
        x,
        z,
        radius,
        halfWidth: radius,
        y: ground.maxY + 0.05,
        groundRange: [ground.minY, ground.maxY] as const,
      };
      const halfWidth = radius * 0.29;
      const channel: SpringSection[] = [];
      let previousY = basin.y;
      let rejected = false;
      let reachedCoast = false;
      for (let step = 0; step < 32; step++) {
        const distance = radius * 0.67 + step * 0.3;
        const point = { x: x + direction.x * distance, z: z + direction.z * distance };
        const bankWidth = halfWidth + 0.16;
        const points = [-1, 0, 1].map((side) => ({
          x: point.x - direction.z * bankWidth * side,
          z: point.z + direction.x * bankWidth * side,
        }));
        const sampled = points.map((p) => sampleIslandTerrainTop(blueprint, "course", p.x, p.z));
        if (sampled.some((p) => !p.inside)) {
          reachedCoast = true;
          break;
        }
        if (!clearAt(point, bankWidth + 0.15)) {
          rejected = true;
          break;
        }
        const strip = [-1, 1].flatMap((along) =>
          [-1, 1].map((side) => ({
            x: point.x + direction.x * along * 0.15 - direction.z * bankWidth * side,
            z: point.z + direction.z * along * 0.15 + direction.x * bankWidth * side,
          })),
        );
        // The polygon must be cyclic for the exact triangle clipper.
        [strip[2], strip[3]] = [strip[3]!, strip[2]!];
        const range = islandTerrainFootprintRange(blueprint, strip, "course");
        if (!range) {
          reachedCoast = true;
          break;
        }
        const low = range.minY,
          high = range.maxY;
        // Water may stay level over small bed variation, but never climb uphill
        // or float over a deep ravine. Banks cover the proved shallow margin.
        const y = springWaterLevel(previousY, low, high);
        if (y === null) {
          rejected = true;
          break;
        }
        channel.push({ ...point, y, halfWidth, groundRange: [low, high] });
        previousY = y;
      }
      const last = channel.at(-1);
      if (rejected || !reachedCoast || !last || channel.length < 3) continue;
      let lip: IslandPoint | null = null;
      for (const offset of [0.3, 0.6, 0.9, 1.2, 1.5]) {
        const p = { x: last.x + direction.x * offset, z: last.z + direction.z * offset };
        const across = [-1, 0, 1].map((side) => ({
          x: p.x - direction.z * halfWidth * side,
          z: p.z + direction.x * halfWidth * side,
        }));
        const samples = across.map((p) => sampleIslandTerrainTop(blueprint, "course", p.x, p.z));
        if (samples.some((s) => s.inside && s.y > last.y - 0.005)) break;
        if (across.every((q) => !pointInsideOutline(q, blueprint.outline))) {
          lip = p;
          break;
        }
      }
      if (!lip) continue;
      return {
        id: `spring/coast/${candidate.id}/${shrink}`,
        basin,
        direction,
        channel,
        lip,
        drop: Math.min(18, Math.max(6, blueprint.underside.depth * 0.48)),
      };
    }
  return null;
}
