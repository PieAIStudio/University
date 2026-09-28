import * as THREE from "three";

/** Room the waiting avatar needs around its feet, in blueprint units. */
export const AVATAR_CLEARANCE = 0.55;

/**
 * A waiting spot on the real ground beside the route, never on a lesson stone,
 * and clear of everything else that stands there: chests, rocks and tents,
 * learning pads and gates, a boss beside its gate. It used to keep off the
 * stones alone, and the avatar waited inside the chest beside the first stone.
 * The caller supplies the existing visible-terrain sampler; no second terrain.
 */
export function courseAvatarIdlePosition(
  nodes: readonly { readonly position: THREE.Vector3; readonly state?: string }[],
  nodeRadius: number,
  heightAt: (x: number, z: number) => { readonly y: number; readonly inside: boolean },
  obstacles: readonly { readonly x: number; readonly z: number; readonly r: number }[] = [],
): THREE.Vector3 | null {
  const first = nodes.find((node) => node.state === "live")?.position ?? nodes[0]?.position;
  if (!first) return null;
  const distance = Math.max(2, nodeRadius * 2.5);
  // Nearest first: half-ring steps and sixteen headings, so a crowded verge
  // still finds the free patch beside the stone before one farther out.
  for (let ring = 1; ring <= 8; ring += 0.5) {
    for (let turn = 0; turn < 16; turn += 1) {
      // Left, right, behind, ahead first, as before; then the diagonals between.
      const angle = HEADINGS[turn]!;
      const x = first.x + Math.sin(angle) * distance * ring;
      const z = first.z + Math.cos(angle) * distance * ring;
      if (!nodes.every((node) => Math.hypot(node.position.x - x, node.position.z - z) >= distance))
        continue;
      if (
        !obstacles.every((item) => Math.hypot(item.x - x, item.z - z) >= item.r + AVATAR_CLEARANCE)
      )
        continue;
      const ground = heightAt(x, z);
      if (ground.inside && Number.isFinite(ground.y)) return new THREE.Vector3(x, ground.y, z);
    }
  }
  // Fail closed for a degenerate/absent surface, rather than floating on water
  // or inventing an implicit selection. Normal generated islands have shoulders.
  return null;
}

const QUARTER = Math.PI / 4;
const EIGHTH = Math.PI / 8;
const HEADINGS = [
  -2 * QUARTER,
  2 * QUARTER,
  4 * QUARTER,
  0,
  -QUARTER,
  QUARTER,
  -3 * QUARTER,
  3 * QUARTER,
  -EIGHTH,
  EIGHTH,
  -3 * EIGHTH,
  3 * EIGHTH,
  -5 * EIGHTH,
  5 * EIGHTH,
  -7 * EIGHTH,
  7 * EIGHTH,
];
