import * as THREE from "three";

/** Authored surface identity survives the one opaque scenery batch. This is
 * not a guess from a pixel's colour; each builder names its real material.
 * Coordinates belong to the unplaced model, so pans/rotations cannot swim.
 */
export const CRAFT_SURFACE = {
  natural: 0,
  timber: 1,
  roof: 2,
  plaster: 3,
  cloth: 4,
  glazing: 5,
} as const;
export type CraftSurfaceRole = (typeof CRAFT_SURFACE)[keyof typeof CRAFT_SURFACE];

export function prepareCraftSurface(
  geometry: THREE.BufferGeometry,
  role: CraftSurfaceRole = CRAFT_SURFACE.natural,
): void {
  if (geometry.hasAttribute("craftSurface")) return;
  const p = geometry.getAttribute("position");
  const data = new Float32Array(p.count * 3);
  if (role !== CRAFT_SURFACE.natural) {
    for (let i = 0; i < p.count; i++) {
      const horizontal = role === CRAFT_SURFACE.roof || role === CRAFT_SURFACE.cloth;
      data[i * 3] = horizontal ? p.getZ(i) : p.getX(i) + p.getZ(i) * 0.37;
      data[i * 3 + 1] = horizontal ? p.getX(i) : p.getY(i);
      data[i * 3 + 2] = role;
    }
  }
  geometry.setAttribute("craftSurface", new THREE.BufferAttribute(data, 3));
}
