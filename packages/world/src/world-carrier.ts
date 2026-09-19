import * as THREE from "three";
import type { IslandBlueprint } from "./island/island-blueprint.js";
import { getOrCreateRemoteBaseGeometry } from "./island/remote-island-field.js";
import {
  cloudCarrierClearance,
  cloudCarrierHome,
  type CloudCarrierTarget,
} from "./sky/cloud-sea.js";

interface WorldCarrierIsland {
  readonly blueprint: IslandBlueprint;
  readonly radius: number;
  readonly position: THREE.Vector3;
}

/** The caption belongs under this island's drawn root, not above its avatar.
 * Read the shared distant mesh cache; never prepare a second height source.
 */
export function worldIslandCaptionTarget(island: WorldCarrierIsland): THREE.Vector3 {
  const base = getOrCreateRemoteBaseGeometry(island.blueprint, island.radius);
  return new THREE.Vector3(
    island.position.x,
    island.position.y + base.bounds.min.y - 0.3,
    island.position.z,
  );
}

/**
 * One canonical distant mesh supplies the actual highest terrain point.
 * Placing feet at position.y buried the carrier and most of the avatar inside
 * the newly continuous island. Leave the existing cloud's full underside clear.
 */
export function worldIslandCarrierTarget(
  island: WorldCarrierIsland,
  weatherExtent: number,
  cloudLevel: number,
): CloudCarrierTarget {
  const base = getOrCreateRemoteBaseGeometry(island.blueprint, island.radius);
  return [
    island.position.x,
    island.position.y + base.bounds.max.y + cloudCarrierClearance(weatherExtent, cloudLevel),
    island.position.z,
  ];
}

/** No explicit selection means a waiting place OUTSIDE destination footprints.
 * Learning focus may frame the camera; it never pretends the learner clicked.
 * The existing carrier instance and avatar use the same point and hop path.
 */
export function worldCarrierHomeTarget(
  islands: readonly WorldCarrierIsland[],
  learnerAt: THREE.Vector3 | null,
  weatherExtent: number,
  cloudLevel: number,
): CloudCarrierTarget {
  if (!islands.length) return cloudCarrierHome(weatherExtent, cloudLevel);
  const focus = islands.find((entry) => learnerAt?.equals(entry.position)) ?? islands[0]!;
  const clearance = cloudCarrierClearance(weatherExtent, cloudLevel);
  // Search a bounded ring around the visible learning area. Every candidate
  // is checked against every real island, not against its label or course ID.
  const margin = Math.max(2.2, clearance);
  let candidate: CloudCarrierTarget | null = null;
  for (let ring = 0; ring < 5 && !candidate; ring++) {
    const radius = focus.radius + margin + ring * Math.max(2, focus.radius * 0.5);
    for (const angle of [
      -Math.PI / 2,
      -Math.PI / 4,
      (-3 * Math.PI) / 4,
      0,
      Math.PI,
      Math.PI / 4,
      (3 * Math.PI) / 4,
      Math.PI / 2,
    ]) {
      const x = focus.position.x + Math.sin(angle) * radius;
      const z = focus.position.z + Math.cos(angle) * radius;
      if (
        islands.every(
          (island) =>
            Math.hypot(x - island.position.x, z - island.position.z) >= island.radius + margin,
        )
      ) {
        candidate = [x, worldIslandCarrierTarget(focus, weatherExtent, cloudLevel)[1], z];
        break;
      }
    }
  }
  if (candidate) return candidate;
  const x = Math.min(...islands.map((island) => island.position.x - island.radius)) - margin;
  return [x, worldIslandCarrierTarget(focus, weatherExtent, cloudLevel)[1], focus.position.z];
}
