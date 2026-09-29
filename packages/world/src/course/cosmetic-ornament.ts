import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  OctahedronGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { IslandBlueprint } from "../island/island-blueprint.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import { RANK_LOOKS } from "../emblems/emblem-looks.js";

export const COSMETIC_ORNAMENT_RADIUS = 0.32;
export const COSMETIC_ORNAMENT_IDS = [
  "island-flower",
  "island-crystal",
  "island-banner",
  "island-crown",
] as const;
export type CosmeticOrnamentId = (typeof COSMETIC_ORNAMENT_IDS)[number];
export function isCosmeticOrnament(id: string | undefined): id is CosmeticOrnamentId {
  return COSMETIC_ORNAMENT_IDS.some((item) => item === id);
}
export interface OrnamentObstacle {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/** One late optional ornament. Reads the existing field and already occupied
 * ground; cannot move terrain, scenery, routes, chests or the learner. */
export function cosmeticOrnamentPlacement(
  blueprint: IslandBlueprint,
  anchor: { readonly x: number; readonly z: number },
  obstacles: readonly OrnamentObstacle[],
): Vector3 | null {
  const ground = createIslandHeightSampler(blueprint);
  const radius = COSMETIC_ORNAMENT_RADIUS;
  try {
    for (let ring = 1; ring <= 8; ring += 0.4)
      for (let step = 0; step < 24; step++) {
        const angle = (step * Math.PI) / 12;
        const x = anchor.x + Math.cos(angle) * ring,
          z = anchor.z + Math.sin(angle) * ring;
        if (
          distanceToIslandRoute(blueprint, { x, z }) <
          blueprint.route.roadWidth / 2 + radius + 0.12
        )
          continue;
        if (
          obstacles.some(
            (obstacle) =>
              Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius + 0.12,
          )
        )
          continue;
        const center = ground.heightAt(x, z);
        if (!center.inside) continue;
        let fits = true;
        for (let rim = 0; rim < 8; rim++) {
          const a = (rim * Math.PI) / 4;
          const sample = ground.heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
          if (!sample.inside || Math.abs(sample.y - center.y) > 0.06) {
            fits = false;
            break;
          }
        }
        if (fits) return new Vector3(x, center.y, z);
      }
    return null;
  } finally {
    ground.dispose();
  }
}

/** One merged, vertex-coloured mesh, no textures or extra canvas. Palette comes
 * from the existing emblem look; source geometry/material ownership stays here. */
export function cosmeticOrnamentGeometry(id: CosmeticOrnamentId): BufferGeometry {
  const pieces: BufferGeometry[] = [];
  const gold = RANK_LOOKS.gold!,
    violet = RANK_LOOKS.obsidian!,
    silver = RANK_LOOKS.silver!;
  function add(source: BufferGeometry, color: number, at: readonly [number, number, number]) {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute("uv");
    geometry.translate(...at);
    const rgb = new Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) rgb.toArray(colors, index * 3);
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    pieces.push(geometry);
  }
  add(new CylinderGeometry(0.29, 0.29, 0.2, 12), silver.ring, [0, 0.03, 0]);
  if (id === "island-flower") {
    add(new CylinderGeometry(0.025, 0.03, 0.42, 6), silver.ribbon, [0, 0.3, 0]);
    add(new IcosahedronGeometry(0.08, 0), gold.face, [0, 0.57, 0]);
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal * Math.PI * 2) / 5;
      add(new IcosahedronGeometry(0.085, 0), violet.gem, [
        Math.cos(angle) * 0.13,
        0.57 + Math.sin(angle) * 0.13,
        0,
      ]);
    }
  } else if (id === "island-crystal") {
    for (const [x, z, scale] of [
      [0, 0, 1],
      [-0.12, 0.03, 0.6],
      [0.11, -0.03, 0.7],
    ]) {
      const geometry = new OctahedronGeometry(0.15, 0);
      geometry.scale(1, 2.4 * scale!, 1);
      add(geometry, violet.gem, [x!, 0.19 + scale! * 0.22, z!]);
    }
  } else if (id === "island-banner") {
    add(new CylinderGeometry(0.025, 0.025, 0.68, 6), gold.ring, [-0.14, 0.42, 0]);
    add(new BoxGeometry(0.34, 0.22, 0.035), silver.ribbon, [0.04, 0.62, 0]);
  } else {
    add(new CylinderGeometry(0.21, 0.23, 0.16, 12), gold.burst, [0, 0.22, 0]);
    for (let point = 0; point < 5; point++) {
      const a = (point * Math.PI * 2) / 5;
      add(new ConeGeometry(0.06, 0.24, 6), gold.face, [
        Math.cos(a) * 0.16,
        0.42,
        Math.sin(a) * 0.16,
      ]);
    }
  }
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) throw new Error("cosmetic ornament geometry could not be merged");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
