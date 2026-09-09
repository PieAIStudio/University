/**
 * Renderer-free route geometry helpers shared by dressing and composition.
 *
 * Kept out of both island-dressing and island-composition so those modules
 * cannot form a runtime import cycle (D14).
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";

export function distanceToSegment(
  point: IslandPoint,
  first: IslandPoint,
  second: IslandPoint,
): number {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - first.x) * dx + (point.z - first.z) * dz) / lengthSquared),
        );
  return Math.hypot(point.x - (first.x + dx * amount), point.z - (first.z + dz * amount));
}

export function distanceToIslandRoute(blueprint: IslandBlueprint, point: IslandPoint): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < blueprint.centerline.length; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(point, blueprint.centerline[index - 1]!, blueprint.centerline[index]!),
    );
  }
  return distance;
}

/** Shoulder plus the authored verge used by dressing/grass clearance. */
export function islandRouteClearance(blueprint: IslandBlueprint): number {
  return blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth + blueprint.route.clearance;
}

export interface IslandRouteFrame {
  readonly point: IslandPoint;
  readonly tangent: IslandPoint;
  readonly baseNormal: IslandPoint;
}

export function islandRouteFrameAtFraction(
  blueprint: IslandBlueprint,
  fraction: number,
): IslandRouteFrame | null {
  if (blueprint.centerline.length === 0) return null;
  const index = Math.min(
    blueprint.centerline.length - 1,
    Math.max(0, Math.round(fraction * (blueprint.centerline.length - 1))),
  );
  return islandRouteFrameAtIndex(blueprint, index);
}

export function islandRouteFrameAtIndex(
  blueprint: IslandBlueprint,
  index: number,
): IslandRouteFrame | null {
  if (blueprint.centerline.length === 0) return null;
  const clamped = Math.min(blueprint.centerline.length - 1, Math.max(0, index));
  const routePoint = blueprint.centerline[clamped]!;
  const before = blueprint.centerline[Math.max(0, clamped - 2)] ?? routePoint;
  const after =
    blueprint.centerline[Math.min(blueprint.centerline.length - 1, clamped + 2)] ?? routePoint;
  const tangentX = after.x - before.x;
  const tangentZ = after.z - before.z;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  const tangent = { x: tangentX / tangentLength, z: tangentZ / tangentLength };
  return {
    point: { x: routePoint.x, z: routePoint.z },
    tangent,
    baseNormal: { x: -tangent.z, z: tangent.x },
  };
}

export function islandRouteIndexNear(
  blueprint: IslandBlueprint,
  point: IslandPoint,
): number | null {
  if (blueprint.centerline.length === 0) return null;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  blueprint.centerline.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.z - point.z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export interface IslandRouteAnchor {
  readonly point: IslandPoint;
  readonly tangent: IslandPoint;
  readonly normal: IslandPoint;
}

export function islandRouteAnchorFromFrame(
  frame: IslandRouteFrame,
  side: number,
  offset: number,
): IslandRouteAnchor {
  const sign = side < 0 ? -1 : 1;
  return {
    point: {
      x: frame.point.x + frame.baseNormal.x * offset * sign,
      z: frame.point.z + frame.baseNormal.z * offset * sign,
    },
    tangent: frame.tangent,
    normal: sign < 0 ? { x: -frame.baseNormal.x, z: -frame.baseNormal.z } : frame.baseNormal,
  };
}

/** Kit/Y-up yaw: local +Z maps to (sin(turn), cos(turn)). */
export function yawToWorld(turn: number): IslandPoint {
  return { x: Math.sin(turn), z: Math.cos(turn) };
}

/** Kit/Y-up yaw that aims local +X along `direction`. */
export function yawAligningLocalX(direction: IslandPoint): number {
  const length = Math.hypot(direction.x, direction.z) || 1;
  return Math.atan2(-direction.z / length, direction.x / length);
}

/** Kit/Y-up yaw that aims local +Z along `direction`. */
export function yawAligningLocalZ(direction: IslandPoint): number {
  const length = Math.hypot(direction.x, direction.z) || 1;
  return Math.atan2(direction.x / length, direction.z / length);
}
