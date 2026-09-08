import * as THREE from "three";
import type { IslandBlueprint } from "./island/island-blueprint.js";
import { getOrCreateRemoteBaseGeometry } from "./island/remote-island-field.js";
import { cloudCarrierClearance, type CloudCarrierTarget } from "./sky/cloud-sea.js";

/**
 * One canonical distant mesh supplies the actual highest terrain point.
 * Placing feet at position.y buried the carrier and most of the avatar inside
 * the newly continuous island. Leave the existing cloud's full underside clear.
 */
export function worldIslandCarrierTarget(
  island: {
    readonly blueprint: IslandBlueprint;
    readonly radius: number;
    readonly position: THREE.Vector3;
  },
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
