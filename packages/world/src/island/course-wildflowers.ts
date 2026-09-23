/**
 * Wildflowers sprinkled over the open meadow, the reference's white and yellow
 * dots (docs/reference/岛内-参考-V4/ChatGPT生成B.png).
 *
 * The landscape's meadow beds are eight deliberate compositions; they were never
 * meant to cover a meadow, and at the overview a bed is a few pixels. These are
 * ground cover instead: small patches of four to eight flowers, heads wide
 * enough to read as a dot from the course camera, in one merged draw. They are
 * planned last and are not an obstacle to anything — a patch keeps off the road,
 * lesson stones, the learning nodes and every footprint already standing, but
 * nothing else has to keep off a flower.
 */
import * as THREE from "three";
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { createIslandHeightSampler } from "./island-geometry.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { hash } from "./random.js";

export interface Wildflower extends IslandPoint {
  readonly y: number;
  readonly size: number;
  readonly turn: number;
  readonly petals: number;
  readonly heart: number;
}

/** Petal and heart colours, white most often, as in the reference. */
const PALETTE = [
  { weight: 0.45, petals: 0xfbf7ec, heart: 0xf2c238 },
  { weight: 0.3, petals: 0xf7d648, heart: 0xe99a2c },
  { weight: 0.15, petals: 0xf5a9c3, heart: 0xf6d24a },
  { weight: 0.1, petals: 0xc8b1ef, heart: 0xfbf7ec },
] as const;
/** Grid step between candidate patches, and the chance a candidate flowers. */
const CELL = 2.1;
const CHANCE = 0.6;
/** Flowers per island at most; the triangle ceiling follows from it. */
export const WILDFLOWER_LIMIT = 900;
export const WILDFLOWER_TRIANGLES = 11;

export function planWildflowers(
  blueprint: IslandBlueprint,
  occupied: readonly (IslandPoint & { readonly radius: number })[],
  exclusions: readonly (IslandPoint & { readonly radius: number })[] = [],
): readonly Wildflower[] {
  const field = islandFieldFor(blueprint);
  const clearance = islandRouteClearance(blueprint);
  const ground = createIslandHeightSampler(blueprint);
  const flowers: Wildflower[] = [];
  try {
    const clear = (x: number, z: number, r: number) =>
      !occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + r) &&
      !exclusions.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + r) &&
      !blueprint.nodes.some(
        (n) => Math.hypot(n.x - x, n.z - z) < blueprint.route.nodeRadius + r + 0.4,
      );
    for (let x = -blueprint.bounds.halfX; x <= blueprint.bounds.halfX; x += CELL)
      for (let z = -blueprint.bounds.halfZ; z <= blueprint.bounds.halfZ; z += CELL) {
        const key = `${blueprint.seed}/wildflower/${Math.round(x * 10)}/${Math.round(z * 10)}`;
        if (hash(key) > CHANCE) continue;
        const cx = x + (hash(`${key}/x`) - 0.5) * CELL * 0.8;
        const cz = z + (hash(`${key}/z`) - 0.5) * CELL * 0.8;
        const s = sampleIslandField(field, cx, cz);
        if (!s.inside || s.grass < 0.35 || s.rock > 0.3 || s.shore > 0.84) continue;
        if (distanceToIslandRoute(blueprint, { x: cx, z: cz }) < clearance + 0.9) continue;
        const pick = hash(`${key}/colour`);
        let acc = 0;
        const colour = PALETTE.find((entry) => (acc += entry.weight) >= pick) ?? PALETTE[0];
        const members = 4 + Math.floor(hash(`${key}/n`) * 5);
        for (let m = 0; m < members && flowers.length < WILDFLOWER_LIMIT; m += 1) {
          const a = hash(`${key}/${m}/a`) * Math.PI * 2;
          const d = Math.sqrt(hash(`${key}/${m}/d`)) * 0.75;
          const fx = cx + Math.cos(a) * d;
          const fz = cz + Math.sin(a) * d;
          const size = 0.2 + hash(`${key}/${m}/s`) * 0.12;
          if (!clear(fx, fz, size)) continue;
          const h = ground.heightAt(fx, fz);
          if (!h.inside) continue;
          flowers.push({
            x: fx,
            z: fz,
            y: h.y,
            size,
            turn: hash(`${key}/${m}/t`) * Math.PI * 2,
            petals: colour.petals,
            heart: colour.heart,
          });
        }
      }
  } finally {
    ground.dispose();
  }
  return flowers;
}

/**
 * One merged geometry: each flower a five-petal head on a short stem, the head
 * facing up so it reads as a dot from above. Eleven triangles each.
 */
export function buildWildflowerGeometry(
  flowers: readonly Wildflower[],
): THREE.BufferGeometry | null {
  if (flowers.length === 0) return null;
  const positions: number[] = [];
  const colours: number[] = [];
  const petal = new THREE.Color();
  const heart = new THREE.Color();
  const stem = new THREE.Color(0x5f9a3a);
  const push = (x: number, y: number, z: number, c: THREE.Color) => {
    positions.push(x, y, z);
    colours.push(c.r, c.g, c.b);
  };
  for (const f of flowers) {
    petal.setHex(f.petals);
    heart.setHex(f.heart);
    const top = f.y + 0.1 + f.size * 0.4;
    const r = f.size;
    // Five petals: triangles from near the heart out to the rim.
    for (let p = 0; p < 5; p += 1) {
      const a0 = f.turn + (p / 5) * Math.PI * 2;
      const a1 = a0 + 0.55;
      const a2 = a0 - 0.55;
      push(f.x + Math.cos(a0) * r * 0.2, top, f.z + Math.sin(a0) * r * 0.2, petal);
      // Wound so the face points up (angle order would face it down).
      push(f.x + Math.cos(a1) * r, top - 0.02, f.z + Math.sin(a1) * r, petal);
      push(f.x + Math.cos(a2) * r, top - 0.02, f.z + Math.sin(a2) * r, petal);
    }
    // The heart: a small raised triangle pair.
    const h = r * 0.32;
    for (let q = 0; q < 2; q += 1) {
      const a = f.turn + q * Math.PI;
      push(f.x + Math.cos(a) * h, top + 0.02, f.z + Math.sin(a) * h, heart);
      push(f.x + Math.cos(a - 2.1) * h, top + 0.02, f.z + Math.sin(a - 2.1) * h, heart);
      push(f.x + Math.cos(a + 2.1) * h, top + 0.02, f.z + Math.sin(a + 2.1) * h, heart);
    }
    // A thin stem, four triangles, so the head does not float.
    const w = 0.025;
    const sx = Math.cos(f.turn) * w,
      sz = Math.sin(f.turn) * w;
    for (const [dx, dz] of [
      [sx, sz],
      [-sz, sx],
    ] as const) {
      push(f.x - dx, f.y - 0.05, f.z - dz, stem);
      push(f.x + dx, f.y - 0.05, f.z + dz, stem);
      push(f.x + dx, top, f.z + dz, stem);
      push(f.x - dx, f.y - 0.05, f.z - dz, stem);
      push(f.x + dx, top, f.z + dz, stem);
      push(f.x - dx, top, f.z - dz, stem);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
