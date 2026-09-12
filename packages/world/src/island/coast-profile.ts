/** One blueprint-derived geological mask for the field and both projections. */
import type { IslandGeometryBlueprint } from "./island-blueprint.js";
import { hash } from "./random.js";

export function cliffLobeAtAngle(phase: number, angle: number): number {
  return (
    0.62 * Math.sin(angle + phase) +
    0.18 * Math.sin(angle * 3 - phase * 0.61) +
    0.36 * Math.sin(angle * 7 + phase * 0.83)
  );
}

function smooth(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function coastalRockMask(
  blueprint: IslandGeometryBlueprint,
  x: number,
  z: number,
  radial: number,
  height: number,
): number {
  if (radial < 0.74) return 0;
  const angle = Math.atan2(z / blueprint.bounds.halfZ, x / blueprint.bounds.halfX);
  const lobe = cliffLobeAtAngle(hash(`${blueprint.seed}/cliff-root`) * Math.PI * 2, angle);
  // Projecting buttresses expose rock; gathered bays retain grassy shoulders.
  // Actual height varies exposure instead of painting identical radial stripes.
  const buttress = smooth(0.32, -0.7, lobe);
  const raised = 0.5 + 0.5 * smooth(0.015, 0.075, height / blueprint.bounds.maxHalf);
  // Stone reaches inland on projecting headlands, while sheltered bays keep
  // their rolled turf. A constant radial start painted a uniform pale rim
  // at catalogue scale even though the cliff itself had geological lobes.
  const stoneStart = 0.91 - buttress * 0.17;
  return smooth(stoneStart, 0.995, radial) * buttress * raised;
}
