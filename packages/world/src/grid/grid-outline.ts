import { hash } from "../island/random.js";
import { hexDistance, hexKey, hexNeighbors, hexRing, type HexCoord } from "./hex.js";

export const GRID_CELL_BUDGET = 128;

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

function growMainRegion(route: readonly HexCoord[], seed: string, target: number): HexCoord[] {
  const cells = new Map(route.map((cell) => [hexKey(cell), cell]));
  const centre = route.reduce(
    (sum, cell) => ({ q: sum.q + cell.q / route.length, r: sum.r + cell.r / route.length }),
    { q: 0, r: 0 },
  );
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
        (6 - firstNeighbours) * 0.7 +
        hexDistance(first, centre) * 0.045 +
        hash(`${seed}/shape/${hexKey(first)}`) * 0.34;
      const secondScore =
        (6 - secondNeighbours) * 0.7 +
        hexDistance(second, centre) * 0.045 +
        hash(`${seed}/shape/${hexKey(second)}`) * 0.34;
      return firstScore - secondScore || hexKey(first).localeCompare(hexKey(second));
    });
    const candidate = candidates[0]!;
    cells.set(hexKey(candidate), candidate);
  }

  const routeKeys = new Set(route.map(hexKey));
  const removable = sortedByNoise(
    [...cells.values()].filter(
      (cell) => !routeKeys.has(hexKey(cell)) && isBoundary(cell, new Set(cells.keys())),
    ),
    `${seed}/erosion`,
  );
  let removed = 0;
  const erosionBudget = Math.max(1, growthTarget - target);
  for (const cell of removable) {
    if (removed >= erosionBudget || cells.size <= route.length) break;
    const key = hexKey(cell);
    if (!cells.has(key) || !canRemoveWithoutBreaking(cell, new Set(cells.keys()))) continue;
    cells.delete(key);
    removed += 1;
  }

  // A second pass only removes cells when there is still a broad edge. This
  // gives the contour bays without making a small course collapse into a line.
  const secondPass = sortedByNoise(
    [...cells.values()].filter(
      (cell) => !routeKeys.has(hexKey(cell)) && isBoundary(cell, new Set(cells.keys())),
    ),
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

export function growGridOutline(
  route: readonly HexCoord[],
  seed: string,
  requestedTarget?: number,
): GridOutline {
  if (route.length === 0) throw new RangeError("A grid outline needs at least one route cell");
  const target = Math.min(
    GRID_CELL_BUDGET - 4,
    Math.max(route.length + 7, requestedTarget ?? Math.round(route.length * 1.75)),
  );
  const main = growMainRegion(route, seed, target);
  const mainKeys = new Set(main.map(hexKey));
  const groupCount = 2 + Math.floor(hash(`${seed}/detached-count`) * 3);
  const detachedKeys = new Set<string>();
  const center = route[Math.floor(route.length / 2)]!;
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
