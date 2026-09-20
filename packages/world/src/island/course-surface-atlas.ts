/** Course-only packed surface masks, derived from the existing field and scenery.
 * This is not another biome/heightfield: every mark belongs to an actual tree,
 * geological reserve or facility. No random scatter and no painted shadows.
 */
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { planIslandDressing, placementFootprintRadius } from "./island-dressing.js";
import { recipeById } from "./kenney-recipes.js";

export const COURSE_SURFACE_SIZE = 256;
/** Dry, warm earth at actual facilities, not an invented path. */
export const COURSE_COURTYARD_COLOUR = 0xb9aa82;
const retained = new WeakMap<IslandBlueprint, { texture: THREE.DataTexture; owners: number }>();

export function courseSurfaceData(blueprint: IslandBlueprint, size = COURSE_SURFACE_SIZE) {
  if (!Number.isInteger(size) || size < 4 || size > 512)
    throw new RangeError("Invalid course texture size");
  const field = islandFieldFor(blueprint);
  // Bare geometry previews have no registered scenery recipe. They still use
  // the field colour, without inventing facilities or failing the renderer.
  const dressing =
    blueprint.themeSelection.recipeId && recipeById(blueprint.themeSelection.recipeId)
      ? planIslandDressing(blueprint, "course")
      : null;
  const canopy = new Float32Array(size * size);
  const wear = new Float32Array(size * size);
  const extent = field.extent;
  const step = (extent * 2) / size;
  const stamp = (target: Float32Array, x: number, z: number, radius: number, strength: number) => {
    const cx = (x + extent) / step - 0.5,
      cz = (z + extent) / step - 0.5;
    const r = radius / step;
    for (
      let iz = Math.max(0, Math.floor(cz - r));
      iz <= Math.min(size - 1, Math.ceil(cz + r));
      iz++
    ) {
      for (
        let ix = Math.max(0, Math.floor(cx - r));
        ix <= Math.min(size - 1, Math.ceil(cx + r));
        ix++
      ) {
        const distance = Math.hypot(ix - cx, iz - cz) / r;
        if (distance >= 1) continue;
        const w = 1 - distance * distance * (3 - 2 * distance);
        const index = iz * size + ix;
        target[index] = Math.max(target[index]!, w * strength);
      }
    }
  };
  for (const p of dressing?.placements ?? []) {
    if (p.kind === "tree") stamp(canopy, p.x, p.z, p.height * 0.8 + 1.4, 1);
    else if (p.kind === "bush" && p.height > 0.6) stamp(canopy, p.x, p.z, p.height + 0.7, 0.4);
    else if (p.kind === "landmark" || p.kind === "prop")
      stamp(wear, p.x, p.z, placementFootprintRadius(p) + 1.5, 0.7);
  }
  for (const p of dressing?.landscape?.outcrops ?? [])
    stamp(canopy, p.x, p.z, p.radius + 1.2, 0.58);
  const data = new Uint8Array(size * size * 4);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (let iz = 0; iz < size; iz++)
    for (let ix = 0; ix < size; ix++) {
      const at = iz * size + ix;
      const s = sampleIslandField(field, (ix + 0.5) * step - extent, (iz + 0.5) * step - extent);
      // Preserve the actual soil road, including the clipped geometry edges.
      // Canopy is lush pigment, not a second sun/contact shadow. Baked field AO
      // is deliberately NOT multiplied again over the real shadow map.
      const plants = canopy[at]! * (1 - s.route);
      const worn = wear[at]! * (1 - plants * 0.55);
      const meadow = s.grass * (1 - s.route);
      const open = s.inside ? 1 : 0;
      // R canopy, G meadow, B protected teaching route, A facility wear.
      // Keep the causes, not pre-multiplied paint: open grass must not lose
      // microstructure merely because it has no tree above it.
      data[at * 4] = Math.round(clamp(plants * open) * 255);
      data[at * 4 + 1] = Math.round(clamp(meadow * open) * 255);
      data[at * 4 + 2] = Math.round(clamp(s.route) * 255);
      data[at * 4 + 3] = Math.round(clamp(worn * open) * 255);
    }
  return { data, extent };
}

export function acquireCourseSurface(blueprint: IslandBlueprint) {
  let entry = retained.get(blueprint);
  if (!entry) {
    const { data } = courseSurfaceData(blueprint);
    const texture = new THREE.DataTexture(
      data,
      COURSE_SURFACE_SIZE,
      COURSE_SURFACE_SIZE,
      THREE.RGBAFormat,
    );
    texture.name = "course-canopy-meadow-route-wear-masks";
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    entry = { texture, owners: 0 };
    retained.set(blueprint, entry);
  }
  const owner = entry;
  owner.owners++;
  let released = false;
  return {
    texture: owner.texture,
    extent: islandFieldFor(blueprint).extent,
    dispose() {
      if (released) return;
      released = true;
      if (--owner.owners === 0) {
        owner.texture.dispose();
        if (retained.get(blueprint) === owner) retained.delete(blueprint);
      }
    },
  };
}
