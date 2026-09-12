/** Small rooted crowns on existing rock shoulders, never a second terrain.
 * Every root is sampled on the same triangles the bank actually emits. The
 * whole crown stays within the geological reserve and retains the full
 * height-aware road/node clearance. An unsuitable shoulder simply stays bare.
 */
import type { IslandBlueprint } from "./island-blueprint.js";
import type { IslandDressingPlan } from "./island-dressing.js";
import type { CourseOutcrop } from "./course-outcrop-plan.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { courseRockTopPoints, sampleCourseRockTop } from "./course-rock-profile.js";
import { courseTreeEnvelopesClear, courseTreeIsFir } from "./course-tree-envelope.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { hash } from "./random.js";
export interface ShoulderCanopy {
  readonly id: string;
  readonly supportId: string;
  readonly asset: "fir" | "broadleaf";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly radius: number;
  readonly turn: number;
  readonly groundRange: readonly [number, number];
}
export function courseShoulderCanopy(
  bp: IslandBlueprint,
  dressing: IslandDressingPlan,
  outcrops: readonly CourseOutcrop[],
): readonly ShoulderCanopy[] {
  const result: ShoulderCanopy[] = [];
  const trees = dressing.placements
    .filter((p) => p.kind === "tree")
    .map((p) => ({
      ...p,
      y: p.y + (p.foliageRootOffset ?? 0),
      form: courseTreeIsFir(p.foliageShapeSeed ?? p.id, p.x, p.z)
        ? ("fir" as const)
        : ("broadleaf" as const),
    }));
  for (const site of outcrops) {
    if (site.feature === "ruin") continue;
    const points = courseRockTopPoints(site);
    // Broad uphill part of the geological profile, not view-dependent world coordinates.
    for (const [index, [u, v]] of [
      [-0.1, -0.06],
      [-0.12, -0.4],
    ].entries()) {
      const size = Math.min(3.8, Math.max(1.7, site.radius * (index ? 0.3 : 0.43)));
      const radius = size * 0.44;
      const x = site.x + (u! * Math.cos(site.turn) - v! * Math.sin(site.turn)) * site.radius;
      const z = site.z + (u! * Math.sin(site.turn) + v! * Math.cos(site.turn)) * site.radius;
      if (Math.hypot(x - site.x, z - site.z) + radius > site.radius) continue;
      if (
        distanceToIslandRoute(bp, { x, z }) <
        islandRouteClearance(bp) + radius + (site.height + size) * 1.4
      )
        continue;
      if (
        bp.nodes.some(
          (n) =>
            Math.hypot(x - n.x, z - n.z) <
            bp.route.nodeRadius + radius + (site.height + size) * 1.4,
        )
      )
        continue;
      const roots = [{ x, z }, ...landscapeFootprint(x, z, size * 0.12)].map((p) =>
        sampleCourseRockTop(points, p.x, p.z),
      );
      if (roots.some((y) => y === null)) continue;
      const low = Math.min(...(roots as number[])),
        high = Math.max(...(roots as number[]));
      if (high - low > 0.14) continue;
      const asset = index ? "broadleaf" : "fir";
      const pose = { x, y: low - 0.012, z, height: size, form: asset } as const;
      if (
        trees.some((t) => !courseTreeEnvelopesClear(pose, t)) ||
        result.some((t) => !courseTreeEnvelopesClear(pose, { ...t, height: t.size, form: t.asset }))
      )
        continue;
      result.push({
        id: `${site.id}/canopy/${index}`,
        supportId: site.id,
        asset,
        x,
        z,
        y: pose.y,
        size,
        radius,
        turn: hash(`${bp.seed}/${site.id}/canopy/${index}`) * Math.PI * 2,
        groundRange: [low, high],
      });
    }
  }
  return result;
}
