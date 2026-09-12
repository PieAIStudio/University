/** Static sun shadows from the same small meshes that are actually drawn.
 * A light-space depth raster is temporary CPU data, not another runtime
 * shadow map, ground field, render pass or retained GPU resource.
 */
import type * as THREE from "three";
import { createMiniatureAsset, type MiniatureAssetKind } from "./miniature-assets.js";
import type { MiniatureProp } from "./miniature-layout.js";

/** Receiver heights and prop transforms are in canonical island-radius units.
 * Changing a catalogue island's scale/lift therefore cannot detach its shadow.
 */
export function bakeMiniatureShadows(
  props: readonly MiniatureProp[],
  heights: Float32Array,
  size: number,
  padding: number,
  sun: readonly [number, number, number],
): Float32Array {
  if (
    !Number.isInteger(size) ||
    size < 4 ||
    heights.length !== size * size ||
    !Number.isInteger(padding) ||
    padding < 0 ||
    2 * padding >= size - 1 ||
    !sun.every(Number.isFinite) ||
    sun[1] <= 0.001
  ) {
    throw new RangeError("Miniature shadows need a finite upward sun and a valid receiver raster");
  }
  const result = new Float32Array(heights.length);
  const casters = props.filter((p) => p.role !== "accent" || p.asset === "stone");
  if (!casters.length) return result;
  const sx = sun[0] / sun[1],
    sz = sun[2] / sun[1];
  const span = size - padding * 2 - 1;
  let left = Infinity,
    right = -Infinity,
    back = Infinity,
    front = -Infinity;
  for (let z = padding; z < size - padding; z++) {
    for (let x = padding; x < size - padding; x++) {
      const y = heights[z * size + x]!;
      if (!Number.isFinite(y)) continue;
      const qx = ((x - padding) / span) * 2 - 1 - sx * y;
      const qz = ((z - padding) / span) * 2 - 1 - sz * y;
      left = Math.min(left, qx);
      right = Math.max(right, qx);
      back = Math.min(back, qz);
      front = Math.max(front, qz);
    }
  }
  if (!Number.isFinite(left)) return result;
  left -= 0.04;
  right += 0.04;
  back -= 0.04;
  front += 0.04;
  const resolution = Math.min(256, size * 2);
  const depth = new Float32Array(resolution * resolution).fill(-Infinity);
  const px = (x: number) => ((x - left) / (right - left)) * (resolution - 1);
  const pz = (z: number) => ((z - back) / (front - back)) * (resolution - 1);
  const templates = new Map<MiniatureAssetKind, THREE.BufferGeometry>();
  try {
    for (const prop of casters) {
      let geometry = templates.get(prop.asset);
      if (!geometry) {
        geometry = createMiniatureAsset(prop.asset);
        templates.set(prop.asset, geometry);
      }
      const source = geometry.getAttribute("position"),
        ids = geometry.index!;
      const projected = new Float32Array(source.count * 3);
      const cos = Math.cos(prop.turn),
        sin = Math.sin(prop.turn);
      for (let v = 0; v < source.count; v++) {
        const x = prop.x + prop.size * (cos * source.getX(v) + sin * source.getZ(v));
        const z = prop.z + prop.size * (-sin * source.getX(v) + cos * source.getZ(v));
        const y = prop.y + source.getY(v) * prop.size;
        projected[v * 3] = px(x - sx * y);
        projected[v * 3 + 1] = y;
        projected[v * 3 + 2] = pz(z - sz * y);
      }
      // The shear q=(x-Lx/Ly*y, z-Lz/Ly*y) is constant along a sun ray.
      // Maximum y at q is the nearest blocker, including gaps in a gate or
      // fence. Bounding ellipses cannot express these actual silhouettes.
      for (let i = 0; i < ids.count; i += 3) {
        const a = ids.getX(i) * 3,
          b = ids.getX(i + 1) * 3,
          c = ids.getX(i + 2) * 3;
        const ax = projected[a]!,
          az = projected[a + 2]!;
        const bx = projected[b]!,
          bz = projected[b + 2]!;
        const cx = projected[c]!,
          cz = projected[c + 2]!;
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(det) < 1e-8) continue;
        const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx)));
        const x1 = Math.min(resolution - 1, Math.floor(Math.max(ax, bx, cx)));
        const z0 = Math.max(0, Math.ceil(Math.min(az, bz, cz)));
        const z1 = Math.min(resolution - 1, Math.floor(Math.max(az, bz, cz)));
        for (let z = z0; z <= z1; z++)
          for (let x = x0; x <= x1; x++) {
            const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
            const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
            const wc = 1 - wa - wb;
            if (Math.min(wa, wb, wc) < -1e-6) continue;
            const y = wa * projected[a + 1]! + wb * projected[b + 1]! + wc * projected[c + 1]!;
            const at = z * resolution + x;
            depth[at] = Math.max(depth[at]!, y);
          }
      }
    }
  } finally {
    templates.forEach((geometry) => geometry.dispose());
  }

  for (let z = padding; z < size - padding; z++)
    for (let x = padding; x < size - padding; x++) {
      const at = z * size + x,
        y = heights[at]!;
      if (!Number.isFinite(y)) continue;
      const qx = px(((x - padding) / span) * 2 - 1 - sx * y);
      const qz = pz(((z - padding) / span) * 2 - 1 - sz * y);
      const ix = Math.floor(qx),
        iz = Math.floor(qz);
      const fx = qx - ix,
        fz = qz - iz;
      let coverage = 0;
      for (let dz = 0; dz <= 1; dz++)
        for (let dx = 0; dx <= 1; dx++) {
          const sample = depth[(iz + dz) * resolution + ix + dx] ?? -Infinity;
          if (sample > y + 0.004) coverage += (dx ? fx : 1 - fx) * (dz ? fz : 1 - fz);
        }
      result[at] = coverage;
    }
  // A bounded, two-texel penumbra. Smooth coverage, never blur depths (which
  // would blend empty sky with a solid object and invent false blockers).
  const scratch = new Float32Array(result.length);
  const kernel = [1, 4, 6, 4, 1];
  for (const horizontal of [true, false]) {
    const input = horizontal ? result : scratch,
      output = horizontal ? scratch : result;
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++) {
          const nx = Math.max(0, Math.min(size - 1, x + (horizontal ? k : 0)));
          const nz = Math.max(0, Math.min(size - 1, z + (horizontal ? 0 : k)));
          sum += input[nz * size + nx]! * kernel[k + 2]!;
        }
        output[z * size + x] = sum / 16;
      }
  }
  return result;
}
