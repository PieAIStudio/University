/** Three.js render adapters for the serialisable IslandBlueprint. */
import * as THREE from "three";

import {
  islandSurfaceY,
  type BlueprintOutlinePoint,
  type IslandBlueprint,
} from "./island-blueprint.js";
import { ISLAND_PALETTE } from "./island.js";

export type IslandDetail = "course" | "world";

export interface BlueprintIslandShape {
  readonly geometry: THREE.BufferGeometry;
  readonly slots: readonly THREE.Vector3[];
  readonly horizontalScale: number;
  readonly heightScale: number;
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly depth: number;
  };
}

function pushColour(target: number[], hex: number, tint: number, lightness = 0): void {
  const colour = new THREE.Color(hex).offsetHSL(tint, 0, lightness);
  target.push(colour.r, colour.g, colour.b);
}

function pushTop(
  positions: number[],
  colours: number[],
  blueprint: IslandBlueprint,
  point: BlueprintOutlinePoint,
  radial: number,
  horizontalScale: number,
  heightScale: number,
): void {
  const x = point.x * radial;
  const z = point.z * radial;
  positions.push(
    x * horizontalScale,
    islandSurfaceY(blueprint, x, z) * heightScale,
    z * horizontalScale,
  );
  const dry =
    radial > 0.78 || (radial > 0.55 && Math.sin(point.angle * 5 + blueprint.terrainPhase) > 0.66);
  pushColour(
    colours,
    dry ? ISLAND_PALETTE.grassDry : ISLAND_PALETTE.grass,
    blueprint.tint,
    radial < 0.35 ? 0.025 : 0,
  );
}

/** Render the same outline as detailed course ground or a semantic world icon. */
export function buildBlueprintIsland(
  blueprint: IslandBlueprint,
  detail: IslandDetail,
  targetRadius?: number,
): BlueprintIslandShape {
  const horizontalScale = targetRadius ? targetRadius / blueprint.bounds.maxHalf : 1;
  const heightScale = targetRadius ? targetRadius / 6.2 : 1;
  const radials = detail === "course" ? [0.18, 0.36, 0.56, 0.76, 1] : [0.34, 0.68, 1];
  const positions: number[] = [0, islandSurfaceY(blueprint, 0, 0) * heightScale, 0];
  const colours: number[] = [];
  const indices: number[] = [];
  pushColour(colours, ISLAND_PALETTE.grass, blueprint.tint, 0.035);

  for (const radial of radials) {
    for (const point of blueprint.outline) {
      pushTop(positions, colours, blueprint, point, radial, horizontalScale, heightScale);
    }
  }

  const segments = blueprint.outline.length;
  const firstRing = 1;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, firstRing + next, firstRing + index);
  }
  for (let ring = 0; ring < radials.length - 1; ring += 1) {
    const inner = 1 + ring * segments;
    const outer = inner + segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(inner + index, inner + next, outer + index);
      indices.push(inner + next, outer + next, outer + index);
    }
  }

  // Duplicate the shoreline so hard cliff normals do not smooth into turf.
  const cliffRings = [
    { scale: 1, depth: 0, colour: ISLAND_PALETTE.grassDry },
    { scale: 0.98, depth: -1.15, colour: ISLAND_PALETTE.rock },
    { scale: 0.73, depth: -4.05, colour: ISLAND_PALETTE.rock },
    { scale: 0.34, depth: -8.05, colour: ISLAND_PALETTE.rockDeep },
  ] as const;
  const cliffStart = positions.length / 3;
  for (let ringIndex = 0; ringIndex < cliffRings.length; ringIndex += 1) {
    const ring = cliffRings[ringIndex]!;
    for (const point of blueprint.outline) {
      const edgeY = islandSurfaceY(blueprint, point.x, point.z);
      positions.push(
        point.x * ring.scale * horizontalScale,
        (edgeY + ring.depth) * heightScale,
        point.z * ring.scale * horizontalScale,
      );
      pushColour(colours, ring.colour, blueprint.tint, ringIndex === 1 ? 0.015 : 0);
    }
  }
  for (let ring = 0; ring < cliffRings.length - 1; ring += 1) {
    const upper = cliffStart + ring * segments;
    const lower = upper + segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(upper + index, upper + next, lower + index);
      indices.push(upper + next, lower + next, lower + index);
    }
  }

  const bottom = positions.length / 3;
  positions.push(0, -8.1 * heightScale, 0);
  pushColour(colours, ISLAND_PALETTE.rockDeep, blueprint.tint, -0.015);
  const lastRing = cliffStart + (cliffRings.length - 1) * segments;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(bottom, lastRing + index, lastRing + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const wantedSlots =
    detail === "course"
      ? blueprint.surfaceSlots.length
      : Math.min(
          blueprint.surfaceSlots.length,
          Math.max(8, Math.round((targetRadius ?? 2) ** 2 * 1.45)),
        );
  const slots = blueprint.surfaceSlots
    .slice(0, wantedSlots)
    .map(
      (slot) =>
        new THREE.Vector3(slot.x * horizontalScale, slot.y * heightScale, slot.z * horizontalScale),
    );
  return {
    geometry,
    slots,
    horizontalScale,
    heightScale,
    bounds: {
      halfX: blueprint.bounds.halfX * horizontalScale,
      halfZ: blueprint.bounds.halfZ * horizontalScale,
      depth: 8.1 * heightScale,
    },
  };
}
