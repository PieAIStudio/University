/**
 * Surface detail is baked once, from the ACTUAL remote top triangles and its
 * existing prop plan. No second noise/height field, donor bitmap, per-frame
 * painting, extra mesh, or extra pass. This is approximate static contact /
 * canopy shading, not a ray-traced AO claim. Standard THREE material map and
 * Linear-sRGB modulation preserve the existing renderer/grade ownership.
 */
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import { miniatureLayoutFor } from "./miniature-layout.js";
import {
  getOrCreateRemoteBaseGeometry,
  type RemoteBaseGeometry,
  type RemoteIslandBatch,
  type RemoteIslandPlacement,
} from "./remote-island-field.js";
import { worldSunDirection } from "../sky/sun.js";
import { miniatureStyleFor } from "./miniature-style.js";
import { bakeMiniatureShadows } from "./miniature-shadow.js";

export const MINIATURE_SURFACE_ATLAS = {
  preferredCellSize: 128,
  maximumSide: 2048,
  padding: 8,
  colourSpace: THREE.LinearSRGBColorSpace,
  samplerCount: 1,
} as const;

const tiles = new WeakMap<IslandBlueprint, Map<number, Uint8Array>>();
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const powerOfTwo = (x: number) => 2 ** Math.ceil(Math.log2(Math.max(1, x)));

/** Layout includes one all-white cell for rock and supplied terrain-only bases. */
export function miniatureAtlasDimensions(count: number) {
  const columns = powerOfTwo(Math.sqrt(count + 1));
  const rows = powerOfTwo(Math.ceil((count + 1) / columns));
  const cellSize = Math.min(
    MINIATURE_SURFACE_ATLAS.preferredCellSize,
    Math.floor(MINIATURE_SURFACE_ATLAS.maximumSide / Math.max(columns, rows)),
  );
  if (cellSize < 4) throw new RangeError("Miniature atlas exceeds its bounded catalogue capacity");
  const padding = Math.min(MINIATURE_SURFACE_ATLAS.padding, Math.floor(cellSize / 4));
  return { columns, rows, cellSize, padding, width: columns * cellSize, height: rows * cellSize };
}

/** Rasterize original XZ triangles; no expensive course field is prepared. */
function topHeights(base: RemoteBaseGeometry, size: number, pad: number): Float32Array {
  const height = new Float32Array(size * size).fill(NaN);
  const span = size - pad * 2 - 1;
  const p = base.positions,
    ids = base.indices,
    r = base.radius;
  const toPixel = (x: number) => pad + (x / r + 1) * 0.5 * span;
  for (let i = 0; i < (base.topTriangleCount ?? 0) * 3; i += 3) {
    const a = ids[i]! * 3,
      b = ids[i + 1]! * 3,
      c = ids[i + 2]! * 3;
    const ax = toPixel(p[a]!),
      az = toPixel(p[a + 2]!);
    const bx = toPixel(p[b]!),
      bz = toPixel(p[b + 2]!);
    const cx = toPixel(p[c]!),
      cz = toPixel(p[c + 2]!);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-10) continue;
    const x0 = Math.max(pad, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(size - pad - 1, Math.ceil(Math.max(ax, bx, cx)));
    const z0 = Math.max(pad, Math.floor(Math.min(az, bz, cz)));
    const z1 = Math.min(size - pad - 1, Math.ceil(Math.max(az, bz, cz)));
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const wc = 1 - wa - wb;
        if (Math.min(wa, wb, wc) < -1e-5) continue;
        height[z * size + x] = (wa * p[a + 1]! + wb * p[b + 1]! + wc * p[c + 1]!) / r;
      }
  }
  return height;
}

export function miniatureSurfaceTile(
  blueprint: IslandBlueprint,
  base: RemoteBaseGeometry,
  size = 128,
  pad = 8,
): Uint8Array {
  let sizes = tiles.get(blueprint);
  const key = size * 100 + pad;
  const previous = sizes?.get(key);
  if (previous) return previous;
  const output = new Uint8Array(size * size * 4).fill(255);
  const height = topHeights(base, size, pad);
  const layout = miniatureLayoutFor(blueprint);
  const snow = miniatureStyleFor(blueprint).id === "alpine";
  const span = size - pad * 2 - 1;
  const shadows = bakeMiniatureShadows(
    layout.props,
    height,
    size,
    pad,
    worldSunDirection("catalogue"),
  );
  const casters = layout.props.map((prop) => {
    const caster = prop.role === "tree" || prop.role === "landmark";
    return { prop, caster };
  });
  for (let iz = pad; iz < size - pad; iz++)
    for (let ix = pad; ix < size - pad; ix++) {
      const index = iz * size + ix;
      const h = height[index]!;
      if (!Number.isFinite(h)) continue;
      const x = ((ix - pad) / span) * 2 - 1,
        z = ((iz - pad) / span) * 2 - 1;
      // Large meadow tones follow the original relief, not arbitrary texture noise.
      const altitude = clamp(h / 0.15, 0, 1);
      let red = 0.78 + altitude * 0.22;
      let green = 0.86 + altitude * 0.14;
      let blue = 0.7 + altitude * 0.23;
      let shade = shadows[index]! * 0.43,
        lush = 0,
        wear = 0;
      for (const { prop, caster } of casters) {
        const dx = x - prop.x,
          dz = z - prop.z;
        const d2 = dx * dx + dz * dz;
        const foot = Math.max(0.028, prop.supportRadius * 1.4);
        if (d2 < foot * foot * 5)
          shade = Math.max(shade, Math.exp((-d2 / (foot * foot)) * 2) * 0.16);
        if (caster) {
          const spread = prop.radius * 1.65;
          if (d2 < spread * spread * 4) lush = Math.max(lush, Math.exp(-d2 / (spread * spread)));
        }
        if (prop.asset === "fence" || prop.asset === "gate") {
          const radius = prop.radius * 1.4;
          wear = Math.max(wear, Math.exp((-d2 / (radius * radius)) * 2) * 0.2);
        }
        if ((prop.asset === "grass" || prop.asset === "flowers") && d2 < 0.12 ** 2) {
          lush = Math.max(lush, Math.exp(-d2 / 0.065 ** 2) * 0.65);
        }
      }
      red = clamp(red - lush * 0.13 + wear, 0, 1);
      green = clamp(green - lush * 0.07, 0, 1);
      blue = clamp(blue - lush * 0.12 - wear * 0.3, 0, 1);
      if (snow) red = green = blue = 0.88 + altitude * 0.12;
      output[index * 4] = Math.round(red * (1 - shade) * 255);
      output[index * 4 + 1] = Math.round(green * (1 - shade * 0.9) * 255);
      output[index * 4 + 2] = Math.round(blue * (1 - shade * 0.78) * 255);
    }
  // A small dilated border prevents neutral-texel halos on a magnified coast.
  for (let pass = 0; pass < 3; pass++) {
    const next = output.slice();
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++) {
        const at = (z * size + x) * 4;
        if (output[at] !== 255 || output[at + 1] !== 255 || output[at + 2] !== 255) continue;
        for (const neighbour of [at - 4, at + 4, at - size * 4, at + size * 4]) {
          if (output[neighbour] === 255 && output[neighbour + 1] === 255) continue;
          next.set(output.subarray(neighbour, neighbour + 4), at);
          break;
        }
      }
    output.set(next);
  }
  if (!sizes) {
    sizes = new Map();
    tiles.set(blueprint, sizes);
  }
  sizes.set(key, output);
  return output;
}

export function createMiniatureSurfaceAtlas(
  islands: readonly RemoteIslandPlacement[],
  batch: RemoteIslandBatch,
) {
  const begun = performance.now();
  const unique = [...new Set(islands.map((island) => island.blueprint))];
  const dimensions = miniatureAtlasDimensions(unique.length);
  const { width, height, columns, cellSize, padding } = dimensions;
  const data = new Uint8Array(width * height * 4).fill(255);
  const slots = new Map(unique.map((blueprint, index) => [blueprint, index + 1]));
  const baked = new Set<IslandBlueprint>();
  const uvs = new Float32Array((batch.geometry.getAttribute("position")?.count ?? 0) * 2);
  let offset = 0;
  for (const island of islands) {
    const base =
      island.baseGeometry ?? getOrCreateRemoteBaseGeometry(island.blueprint, island.radius);
    const slot = slots.get(island.blueprint)!;
    const ox = (slot % columns) * cellSize,
      oy = Math.floor(slot / columns) * cellSize;
    if (!baked.has(island.blueprint) && base.topTriangleCount) {
      const tile = miniatureSurfaceTile(island.blueprint, base, cellSize, padding);
      for (let row = 0; row < cellSize; row++) {
        data.set(
          tile.subarray(row * cellSize * 4, (row + 1) * cellSize * 4),
          ((oy + row) * width + ox) * 4,
        );
      }
      baked.add(island.blueprint);
    }
    for (let v = 0; v < base.vertexCount; v++) {
      const onMeadow = v < (base.surfaceVertexEnd ?? 0);
      uvs[(offset + v) * 2] = onMeadow
        ? (ox +
            padding +
            0.5 +
            (base.positions[v * 3]! / base.radius + 1) * 0.5 * (cellSize - padding * 2 - 1)) /
          width
        : (cellSize * 0.5) / width;
      uvs[(offset + v) * 2 + 1] = onMeadow
        ? (oy +
            padding +
            0.5 +
            (base.positions[v * 3 + 2]! / base.radius + 1) * 0.5 * (cellSize - padding * 2 - 1)) /
          height
        : (cellSize * 0.5) / height;
    }
    offset += base.vertexCount;
  }
  batch.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = "miniature-ground-colour-contact-atlas";
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const info = {
    ...dimensions,
    tiles: baked.size,
    baseBytes: data.byteLength,
    approximateMipBytes: Math.ceil((data.byteLength * 4) / 3),
    samplers: 1,
    sunProfile: "catalogue" as const,
    shadowDirection: worldSunDirection("catalogue"),
    bakeAndUploadPreparationMs: performance.now() - begun,
  };
  return { texture, info, dispose: () => texture.dispose() };
}
