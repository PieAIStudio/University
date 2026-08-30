import { hash } from "../island/random.js";
import { hexDistance, hexKey, hexNeighbors, hexRing, type HexCoord } from "./hex.js";

/**
 * The most cells one island may hold.
 *
 * The largest course in the catalogue has 41 lessons, and a lesson only reads
 * as a step along a route when the land around it outnumbers it. At the old
 * budget of 128 a 41-lesson island was one third lesson tiles, so the route
 * stopped being a path through a place and became the place — two independent
 * renderer rewrites hit that wall from different directions before anyone
 * checked the ratio against the reference art, which runs about one lesson per
 * eight cells.
 *
 * 41 lessons at that ratio needs ~330 cells; 400 leaves headroom. A hex prism
 * is ~20 triangles and every cell is one instance, so the whole terrain costs
 * ~8,000 triangles and a single draw call. The land was always affordable.
 */
export const GRID_CELL_BUDGET = 400;

export interface GridDetachedGroup {
  readonly id: string;
  readonly cells: readonly HexCoord[];
}

export interface GridOutline {
  readonly main: readonly HexCoord[];
  readonly detached: readonly HexCoord[];
  readonly detachedGroups: readonly GridDetachedGroup[];
}

function sortedByNoise(cells: readonly HexCoord[], seed: string): HexCoord[] {
  return [...cells].sort((first, second) => {
    const difference = hash(`${seed}/${hexKey(first)}`) - hash(`${seed}/${hexKey(second)}`);
    return difference || hexKey(first).localeCompare(hexKey(second));
  });
}

function isBoundary(cell: HexCoord, cells: Set<string>): boolean {
  return hexNeighbors(cell).some((neighbor) => !cells.has(hexKey(neighbor)));
}

export function hexRegionIsConnected(cells: readonly HexCoord[]): boolean {
  if (cells.length <= 1) return true;
  const keys = new Set(cells.map(hexKey));
  const seen = new Set<string>();
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = hexKey(current);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const neighbor of hexNeighbors(current)) {
      if (keys.has(hexKey(neighbor)) && !seen.has(hexKey(neighbor))) queue.push(neighbor);
    }
  }
  return seen.size === keys.size;
}

export interface GridRegionShapeMetrics {
  readonly area: number;
  /** Number of exposed hex edges around the region. */
  readonly perimeter: number;
  /** Lower is more compact; a long thin strip has a much larger value. */
  readonly perimeterSquaredOverArea: number;
  /** Radius of gyration in axial hex units, around the region centroid. */
  readonly radiusOfGyration: number;
  readonly maxDistanceFromCentroid: number;
}

/**
 * Measure a region without making its shape a renderer concern.
 *
 * Counting exposed hex edges is deliberately more useful here than measuring
 * a world-space bounding box: bays and jagged shore cells count, while the
 * same region remains comparable when the renderer changes its hex size.
 */
export function gridRegionShapeMetrics(cells: readonly HexCoord[]): GridRegionShapeMetrics {
  if (cells.length === 0) {
    return {
      area: 0,
      perimeter: 0,
      perimeterSquaredOverArea: Number.POSITIVE_INFINITY,
      radiusOfGyration: 0,
      maxDistanceFromCentroid: 0,
    };
  }
  const keys = new Set(cells.map(hexKey));
  const perimeter = cells.reduce(
    (total, cell) =>
      total + hexNeighbors(cell).filter((neighbor) => !keys.has(hexKey(neighbor))).length,
    0,
  );
  const centroid = cells.reduce(
    (sum, cell) => ({ q: sum.q + cell.q / cells.length, r: sum.r + cell.r / cells.length }),
    { q: 0, r: 0 },
  );
  const distanceFromCentroid = (cell: HexCoord): number =>
    Math.sqrt(
      (cell.q - centroid.q) ** 2 +
        (cell.q - centroid.q) * (cell.r - centroid.r) +
        (cell.r - centroid.r) ** 2,
    );
  const distances = cells.map(distanceFromCentroid);
  return {
    area: cells.length,
    perimeter,
    perimeterSquaredOverArea: (perimeter * perimeter) / cells.length,
    radiusOfGyration: Math.sqrt(
      distances.reduce((sum, distance) => sum + distance * distance, 0) / cells.length,
    ),
    maxDistanceFromCentroid: Math.max(...distances),
  };
}

function canRemoveWithoutBreaking(cell: HexCoord, cells: Set<string>): boolean {
  const key = hexKey(cell);
  cells.delete(key);
  const connected = hexRegionIsConnected(
    [...cells].map((entry) => {
      const [q, r] = entry.split(",").map(Number);
      return { q, r };
    }),
  );
  cells.add(key);
  return connected;
}

function growMainRegion(seed: string, target: number): HexCoord[] {
  // Start from the place, not from the route. The route is fitted after this
  // region exists; otherwise a long course can only ever produce a fattened
  // version of its own centreline.
  const centre: HexCoord = { q: 0, r: 0 };
  const cells = new Map([[hexKey(centre), centre]]);
  const growthTarget = Math.min(
    GRID_CELL_BUDGET - 4,
    target + Math.max(3, Math.round(target * 0.16)),
  );
  while (cells.size < growthTarget) {
    const frontier = new Map<string, HexCoord>();
    for (const cell of cells.values()) {
      for (const neighbor of hexNeighbors(cell)) {
        if (!cells.has(hexKey(neighbor))) frontier.set(hexKey(neighbor), neighbor);
      }
    }
    if (frontier.size === 0) break;
    const candidates = [...frontier.values()].sort((first, second) => {
      const firstNeighbours = hexNeighbors(first).filter((cell) => cells.has(hexKey(cell))).length;
      const secondNeighbours = hexNeighbors(second).filter((cell) =>
        cells.has(hexKey(cell)),
      ).length;
      const firstScore =
        // Distance from the centre owns the silhouette. Neighbour count and
        // seeded noise only roughen its edge; neither can pull the island
        // toward a course route because no route is available at this stage.
        hexDistance(first, centre) * 0.78 +
        (6 - firstNeighbours) * 0.58 +
        hash(`${seed}/shape/${hexKey(first)}`) * 0.42;
      const secondScore =
        hexDistance(second, centre) * 0.78 +
        (6 - secondNeighbours) * 0.58 +
        hash(`${seed}/shape/${hexKey(second)}`) * 0.42;
      return firstScore - secondScore || hexKey(first).localeCompare(hexKey(second));
    });
    const candidate = candidates[0]!;
    cells.set(hexKey(candidate), candidate);
  }

  const removable = sortedByNoise(
    [...cells.values()].filter((cell) => isBoundary(cell, new Set(cells.keys()))),
    `${seed}/erosion`,
  );
  let removed = 0;
  const erosionBudget = Math.max(1, growthTarget - target);
  for (const cell of removable) {
    if (removed >= erosionBudget || cells.size <= 1) break;
    const key = hexKey(cell);
    if (!cells.has(key) || !canRemoveWithoutBreaking(cell, new Set(cells.keys()))) continue;
    cells.delete(key);
    removed += 1;
  }

  // A second pass only removes cells when there is still a broad edge. This
  // gives the contour bays without making a small course collapse into a line.
  const secondPass = sortedByNoise(
    [...cells.values()].filter((cell) => isBoundary(cell, new Set(cells.keys()))),
    `${seed}/erosion-pass-two`,
  );
  for (const cell of secondPass) {
    if (cells.size <= target || hash(`${seed}/bay/${hexKey(cell)}`) > 0.28) continue;
    if (canRemoveWithoutBreaking(cell, new Set(cells.keys()))) cells.delete(hexKey(cell));
  }
  return [...cells.values()];
}

function findDetachedCell(
  center: HexCoord,
  mainKeys: Set<string>,
  detachedKeys: Set<string>,
  seed: string,
  groupIndex: number,
): HexCoord {
  for (let radius = 3; radius <= 14; radius += 1) {
    const candidates = sortedByNoise(
      hexRing(center, radius),
      `${seed}/detached/${groupIndex}/${radius}`,
    );
    for (const candidate of candidates) {
      const key = hexKey(candidate);
      const touchesMain = hexNeighbors(candidate).some((neighbor) =>
        mainKeys.has(hexKey(neighbor)),
      );
      const touchesDetached = hexNeighbors(candidate).some((neighbor) =>
        detachedKeys.has(hexKey(neighbor)),
      );
      if (!mainKeys.has(key) && !detachedKeys.has(key) && !touchesMain && !touchesDetached)
        return candidate;
    }
  }
  return { q: center.q + 20 + groupIndex * 2, r: center.r - 20 };
}

/**
 * Land cells per lesson. Sampled from the art-direction reference, where ~10
 * lesson tiles sit in ~120 cells. Below about 5 the route reads as the island
 * rather than a path across it.
 */
export const CELLS_PER_LESSON = 8;

export function growGridOutline(seed: string, requestedTarget: number): GridOutline {
  if (requestedTarget <= 0) throw new RangeError("A grid outline needs a positive target");
  const target = Math.min(GRID_CELL_BUDGET - 4, Math.max(1, requestedTarget));
  const main = growMainRegion(seed, target);
  const mainKeys = new Set(main.map(hexKey));
  const groupCount = 2 + Math.floor(hash(`${seed}/detached-count`) * 3);
  const detachedKeys = new Set<string>();
  const center = { q: 0, r: 0 };
  const detachedGroups: GridDetachedGroup[] = [];
  for (let index = 0; index < groupCount; index += 1) {
    const cell = findDetachedCell(center, mainKeys, detachedKeys, seed, index);
    const key = hexKey(cell);
    detachedKeys.add(key);
    detachedGroups.push({ id: `detached-${index + 1}`, cells: [cell] });
  }
  return {
    main,
    detached: [...detachedKeys].map((key) => {
      const [q, r] = key.split(",").map(Number);
      return { q, r };
    }),
    detachedGroups,
  };
}
