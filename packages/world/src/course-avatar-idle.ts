import * as THREE from "three";

/** A waiting spot on the real ground beside the route, never on a lesson stone.
 * The caller supplies the existing visible-terrain sampler; no second terrain.
 */
export function courseAvatarIdlePosition(
  nodes: readonly { readonly position: THREE.Vector3; readonly state?: string }[],
  nodeRadius: number,
  heightAt: (x: number, z: number) => { readonly y: number; readonly inside: boolean },
): THREE.Vector3 | null {
  const first = nodes.find((node) => node.state === "live")?.position ?? nodes[0]?.position;
  if (!first) return null;
  const distance = Math.max(2, nodeRadius * 2.5);
  for (let ring = 1; ring <= 8; ring++) {
    for (const angle of [
      -Math.PI / 2,
      Math.PI / 2,
      Math.PI,
      0,
      -Math.PI / 4,
      Math.PI / 4,
      (-3 * Math.PI) / 4,
      (3 * Math.PI) / 4,
    ]) {
      const x = first.x + Math.sin(angle) * distance * ring;
      const z = first.z + Math.cos(angle) * distance * ring;
      if (!nodes.every((node) => Math.hypot(node.position.x - x, node.position.z - z) >= distance))
        continue;
      const ground = heightAt(x, z);
      if (ground.inside && Number.isFinite(ground.y)) return new THREE.Vector3(x, ground.y, z);
    }
  }
  // Fail closed for a degenerate/absent surface, rather than floating on water
  // or inventing an implicit selection. Normal generated islands have shoulders.
  return null;
}
