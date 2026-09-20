/** Structural stone joints, not a second terrain/ecology field. Coordinates
 * are angular so both projections sample the same eight structural buttresses.
 * Recesses are deliberately broad enough for the 32-sector distant mesh.
 */
import { hash } from "./random.js";

const TAU = Math.PI * 2;
export const STONE_JOINT_COUNT = 8;

/** Sixteen stone masses, paired around the eight structural buttresses.
 * A wide mass borrows a sector from its neighbour: the complete contour is
 * covered exactly once. Both projections use the same angular boundaries;
 * close geometry only resolves the boundary more finely. Not another field.
 */
export function cliffPanelSpans(seed: string, segments: number, band: number) {
  if (!Number.isInteger(segments) || segments < 32 || segments % 32 !== 0)
    throw new RangeError("Stone contours require a multiple of 32 sectors");
  const unit = segments / 32;
  const shift = band === 2 ? unit : 0;
  const spans: { start: number; width: number; character: number }[] = [];
  for (let pair = 0; pair < STONE_JOINT_COUNT; pair++) {
    const roll = hash(`${seed}/${pair}/${band}/stone-width`);
    const left = roll < 0.3 ? 1 : roll > 0.7 ? 3 : 2;
    let start = pair * 4 * unit + shift;
    for (const [side, width] of [left * unit, (4 - left) * unit].entries()) {
      spans.push({
        start: start % segments,
        width,
        character: hash(`${seed}/${pair}/${side}/${band}/stone-face`),
      });
      start += width;
    }
  }
  return spans;
}

export function stoneJointAt(seed: string, angle: number, band: number) {
  const turn = Math.floor(hash(`${seed}/stone-strike`) * STONE_JOINT_COUNT);
  const around = ((angle / TAU) * STONE_JOINT_COUNT + turn + STONE_JOINT_COUNT) % STONE_JOINT_COUNT;
  const block = Math.floor(around);
  const u = around - block;
  const bevel = Math.max(0, 1 - Math.min(u, 1 - u) / 0.24);
  // The bounded shoulder break differs by rock mass, not by every vertex.
  // Interpolation returns the same coordinate from either side of a joint.
  const a = hash(`${seed}/${block}/stone-seat`);
  const b = hash(`${seed}/${(block + 1) % STONE_JOINT_COUNT}/stone-seat`);
  // Broad buttresses and individual mineral breaks are different scales of
  // the same contour. Sixteen continuous break samples stop the joints from
  // joining into one waist-high horizontal belt around the island.
  const cut = (around * 2) % (STONE_JOINT_COUNT * 2);
  const cutId = Math.floor(cut),
    cutU = cut - cutId;
  const first = hash(`${seed}/${cutId}/${band}/mineral-break`);
  const second = hash(`${seed}/${(cutId + 1) % (STONE_JOINT_COUNT * 2)}/${band}/mineral-break`);
  const seat = (first + (second - first) * cutU) * 0.8 + (a + (b - a) * u) * 0.2;
  const relief = band === 1 ? 0 : band === 2 ? 0.11 : band === 3 ? 0.085 : 0.025;
  return {
    block,
    recess: bevel,
    gather: relief * (bevel - 0.3),
    drop: band === 2 ? (seat - 0.5) * 0.2 : band === 3 ? (seat - 0.5) * 0.1 : 0,
    mineral: 0.82 + hash(`${seed}/${block}/stone-mineral`) * 0.23,
  };
}
