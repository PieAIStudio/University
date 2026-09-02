import { hexDistance, hexKey, type HexCoord } from "./hex.js";
import { GRID_PROP_ROLE_SIZING } from "./grid-theme.js";
import type { GridPropPlacement } from "./grid-props.js";

/**
 * The planner proposes a field; this module is the acceptance contract for
 * what the learner is allowed to receive. Keep the arithmetic gates together
 * so a future planner change has one discoverable place to check its result.
 */

/** Two tall silhouettes closer than this read as a hedge, not as landmarks. */
export const GRID_CANOPY_SPACING = 2;

interface ClusterOffsetSpec {
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly footprint: number;
  readonly cellDiameter: number;
}

export function clusterGeometryHolds(
  placements: readonly ClusterOffsetSpec[],
  epsilon = 1e-6,
): boolean {
  if (placements.length === 0) return true;
  const diameter = placements[0]!.cellDiameter;
  if (diameter <= 0 || placements.some((placement) => placement.cellDiameter !== diameter)) {
    return false;
  }

  for (let first = 0; first < placements.length; first += 1) {
    const left = placements[first]!;
    if (left.footprint <= 0 || !Number.isFinite(left.footprint)) return false;
    for (let second = first + 1; second < placements.length; second += 1) {
      const right = placements[second]!;
      const dx = left.offsetX - right.offsetX;
      const dz = left.offsetZ - right.offsetZ;
      const horizontalDistance = Math.hypot(dx, dz);
      const radiusSum = (left.footprint + right.footprint) / 2;
      if (horizontalDistance + epsilon < radiusSum) return false;
    }
  }

  const minX = Math.min(
    ...placements.map((placement) => placement.offsetX - placement.footprint / 2),
  );
  const maxX = Math.max(
    ...placements.map((placement) => placement.offsetX + placement.footprint / 2),
  );
  const minZ = Math.min(
    ...placements.map((placement) => placement.offsetZ - placement.footprint / 2),
  );
  const maxZ = Math.max(
    ...placements.map((placement) => placement.offsetZ + placement.footprint / 2),
  );
  return (
    maxX - minX <= diameter + epsilon &&
    maxZ - minZ <= diameter + epsilon &&
    minX >= -diameter / 2 - epsilon &&
    maxX <= diameter / 2 + epsilon &&
    minZ >= -diameter / 2 - epsilon &&
    maxZ <= diameter / 2 + epsilon
  );
}

/**
 * The old name is kept for callers that used the one-prop-per-cell guard.
 * Its meaning is now stronger: a cell may contain a cluster, but every member
 * must be a non-overlapping, cell-sized placement in that cluster.
 */
export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return propClustersFitCells(placements);
}

/** Check pairwise disc separation and the merged AABB for every cell cluster. */
export function propClustersFitCells(placements: readonly GridPropPlacement[]): boolean {
  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  return [...clusters.values()].every(propClusterFitsCell);
}

/** The same geometry gate for one cell, useful for focused diagnostics/tests. */
export function propClusterFitsCell(placements: readonly GridPropPlacement[]): boolean {
  if (placements.length === 0) return true;
  // The existing landmark band deliberately permits a chapter-scale singleton
  // to overhang its source hex. It is not a multi-prop cluster, so the cluster
  // AABB rule starts when a second member is added.
  if (placements.length === 1 && placements[0]!.kind === "landmark") return true;
  return clusterGeometryHolds(
    placements.map((placement) => ({
      offsetX: placement.offsetX,
      offsetZ: placement.offsetZ,
      footprint: placement.footprint,
      cellDiameter: placement.cellDiameter,
    })),
  );
}

/** Keep the lower and upper size-band tripwires attached to actual placements. */
export function propPlacementSizeBandsHold(placements: readonly GridPropPlacement[]): boolean {
  return placements.every((placement) => {
    const sizing = GRID_PROP_ROLE_SIZING[placement.role];
    return (
      placement.height >= sizing.height[0] - 1e-6 &&
      placement.height <= sizing.height[1] + 1e-6 &&
      placement.footprint >= sizing.footprint[0] - 1e-6 &&
      placement.footprint <= sizing.footprint[1] + 1e-6
    );
  });
}

/** The complete geometry gate used by the course tests. */
export function propClustersAreValid(placements: readonly GridPropPlacement[]): boolean {
  return (
    propClustersFitCells(placements) &&
    propPlacementSizeBandsHold(placements) &&
    propClusterShapesHold(placements)
  );
}

/** Every regular dressing cluster has one subject and two to four accents. */
export function propClusterShapesHold(placements: readonly GridPropPlacement[]): boolean {
  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  return [...clusters.values()].every((cluster) => {
    const primary = cluster.filter((placement) => placement.clusterMember === "primary");
    const attachments = cluster.filter((placement) => placement.clusterMember === "attachment");
    const primaryRoleIsValid = primary.every((placement) => placement.role !== "ground");
    const attachmentRolesAreValid = attachments.every(
      (placement) => placement.role === "ground" || placement.role === "understory",
    );
    // A landmark may be wider than the regular cell and remains a deliberate
    // singleton when no complete subject-plus-punctuation layout fits it.
    if (cluster[0]!.kind === "landmark" && cluster.length === 1) {
      return primary.length === 1 && primary[0]!.role === "landmark";
    }
    return (
      primary.length === 1 &&
      primaryRoleIsValid &&
      attachments.length >= 2 &&
      attachments.length <= 4 &&
      attachmentRolesAreValid
    );
  });
}

/* ------------------------------------------------------------------ *
 * Assertions
 *
 * These are the reason the planner is a pure module. "Too big", "floating",
 * "the learner can't see any of it" are all arithmetic, and arithmetic is
 * something a test can refuse to merge. Every one of them exists because the
 * failure it describes actually shipped.
 * ------------------------------------------------------------------ */

/**
 * Can the learner see any of this from where they stand?
 *
 * The camera sits on the route. A plan with three hundred props and none of
 * them within two rings of the road is, from the only viewpoint that exists,
 * an empty island — and every other metric in the project scored it as full.
 */
export function visiblePropsNearRoute(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
  rings = 2,
): readonly GridPropPlacement[] {
  if (route.length === 0) return [];
  return placements.filter(
    (placement) =>
      placement.visibleInCourse !== false &&
      route.some((entry) => hexDistance(entry, placement.coord) <= rings),
  );
}

/** No dressing may stand on the road or on a lesson's own cell. */
export function propsAvoidRoute(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
): boolean {
  const routeKeys = new Set(route.map(hexKey));
  return placements.every((placement) => !routeKeys.has(placement.cellKey));
}

/** Every tall silhouette keeps its distance from every other one. */
export function canopySpacingHolds(placements: readonly GridPropPlacement[]): boolean {
  const canopies = placements.filter(
    (placement) => placement.role === "canopy" && placement.visibleInCourse !== false,
  );
  for (let first = 0; first < canopies.length; first += 1) {
    for (let second = first + 1; second < canopies.length; second += 1) {
      if (hexDistance(canopies[first]!.coord, canopies[second]!.coord) <= GRID_CANOPY_SPACING - 1) {
        return false;
      }
    }
  }
  return true;
}
