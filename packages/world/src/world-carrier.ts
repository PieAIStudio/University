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

/** Closing a card changes selection, not the current course's terrain height.
 * Resolve the existing learner position against actual placements, including
 * an equivalent vector restored by navigation; never infer it from screen pixels.
 */
export function worldCarrierHomeTarget(
  islands: readonly WorldCarrierIsland[],
  learnerAt: THREE.Vector3 | null,
  weatherExtent: number,
  cloudLevel: number,
): CloudCarrierTarget {
  const island = learnerAt ? islands.find((entry) => entry.position.equals(learnerAt)) : null;
  if (island) return worldIslandCarrierTarget(island, weatherExtent, cloudLevel);
  const home = cloudCarrierHome(weatherExtent, cloudLevel);
  return [learnerAt?.x ?? home[0], home[1], learnerAt?.z ?? home[2]];
}
