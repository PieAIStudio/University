import { hash } from "../island/random.js";
import { hexKey, hexNeighbors, type HexCoord } from "./hex.js";

export const GRID_ELEVATION_STEP = 0.42;
export const GRID_ELEVATION_LEVELS = 4;

export interface ElevationCellInput {
  readonly coord: HexCoord;
  readonly kind: "route" | "land" | "detached";
}

export interface GridElevation {
  readonly key: string;
  readonly height: 1 | 2 | 3 | 4;
  readonly topY: number;
}

export function gridElevationsFor(
  cells: readonly ElevationCellInput[],
  route: readonly HexCoord[],
  seed: string,
  activeKey?: string,
): readonly GridElevation[] {
  const routeKeys = new Set(route.map(hexKey));
  const raw = cells.map(({ coord, kind }) => {
    const key = hexKey(coord);
    const isRoute = routeKeys.has(key) || kind === "route";
    const baseHeight = isRoute
      ? 3
      : kind === "detached"
        ? 1 + Math.floor(hash(`${seed}/detached/${key}`) * 2)
        : 1 + Math.floor(hash(`${seed}/terrain-height/${key}`) * 2);
    return { key, coord, kind, height: baseHeight };
  });
  const heights = new Map(raw.map((entry) => [entry.key, entry.height]));
  // A noisy field is useful only when its cliffs remain readable. Clamp each
  // land cell against its neighbours twice so a single random cell cannot
  // hide the top faces of an entire terrace behind a three-level wall.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const entry of raw) {
      if (entry.kind === "route" || routeKeys.has(entry.key)) continue;
      const neighbours = hexNeighbors(entry.coord)
        .map((cell) => heights.get(hexKey(cell)))
        .filter((height): height is number => height !== undefined);
      if (neighbours.length === 0) continue;
      const minimum = Math.min(...neighbours);
      const maximum = Math.max(...neighbours);
      heights.set(entry.key, Math.max(minimum - 1, Math.min(maximum + 1, heights.get(entry.key)!)));
    }
  }
  return raw.map((entry) => {
    const lift = entry.key === activeKey ? 1 : 0;
    const height = Math.min(GRID_ELEVATION_LEVELS, heights.get(entry.key)! + lift) as 1 | 2 | 3 | 4;
    return { key: entry.key, height, topY: height * GRID_ELEVATION_STEP };
  });
}
