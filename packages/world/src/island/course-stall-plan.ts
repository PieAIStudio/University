import type { IslandBlueprint } from "./island-blueprint.js";
import type { IslandDressingPlan, IslandDressingPlacement } from "./island-dressing.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { COURSE_STALL_FEET, COURSE_STALL_SIZE } from "./course-stall-geometry.js";

export const isCourseCraftedStall = (p: IslandDressingPlacement) =>
  p.packId === "fantasy-town-kit" && p.assetId === "stall";

/** A replacement body on the existing semantic placement, not new scenery.
 * The complete registered plan footprint still owns clearance; only four
 * support cuts read terrain, with the unchanged rigid countertop/roof datum.
 */
export function courseStallPlan(blueprint: IslandBlueprint, dressing: IslandDressingPlan) {
  return dressing.placements.filter(isCourseCraftedStall).flatMap((p) => {
    const size = p.height / COURSE_STALL_SIZE.y;
    if (!(size > 0) || !Number.isFinite(size)) return [];
    const transform = (x: number, z: number) => ({
      x: p.x + (x * Math.cos(p.turn) + z * Math.sin(p.turn)) * size,
      z: p.z + (-x * Math.sin(p.turn) + z * Math.cos(p.turn)) * size,
    });
    const feet = COURSE_STALL_FEET.map(([x, z]) => {
      const range = islandTerrainFootprintRange(
        blueprint,
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([dx, dz]) => transform(x + dx! * 0.017, z + dz! * 0.017)),
        "course",
      );
      if (!range || range.maxY - range.minY > 0.08) return null;
      return (range.minY - 0.008 - p.y) / size;
    });
    // A short extension/cut is carpentry. Beyond that, retain the registered
    // model rather than building a stretched or unsupported replacement.
    if (feet.some((y) => y === null || !Number.isFinite(y) || Math.abs(y) > 0.14)) return [];
    return [{ id: p.id, x: p.x, y: p.y, z: p.z, turn: p.turn, size, feet: feet as number[] }];
  });
}
export type CourseCraftedStall = ReturnType<typeof courseStallPlan>[number];
