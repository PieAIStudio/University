import { hash } from "../island/random.js";
import { hexKey, hexNeighbors, type HexCoord } from "./hex.js";

export const GRID_ELEVATION_STEP = 0.78;
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

function clampHeight(value: number): number {
  return Math.max(1, Math.min(GRID_ELEVATION_LEVELS, Math.round(value)));
}

export function gridElevationsFor(
  cells: readonly ElevationCellInput[],
  route: readonly HexCoord[],
  seed: string,
  activeKey?: string,
): readonly GridElevation[] {
  const routeKeys = new Set(route.map(hexKey));
  const terraced = cells.filter((cell) => cell.kind !== "detached");
  const centroid =
    terraced.length === 0
      ? { q: 0, r: 0 }
      : {
          q: terraced.reduce((sum, cell) => sum + cell.coord.q, 0) / terraced.length,
          r: terraced.reduce((sum, cell) => sum + cell.coord.r, 0) / terraced.length,
        };
  // One hashed axis turns the island into three coherent terraces instead of
  // a per-cell noise field that neighbour-smoothing flattens back into a
  // plateau. A coarse blob can lift or drop a patch by one step so the
  // ridgeline is not a straight cut.
  const axis = hash(`${seed}/terrace-axis`) * Math.PI * 2;
  const axisQ = Math.cos(axis);
  const axisR = Math.sin(axis);
  const projections = terraced.map(
    (cell) => (cell.coord.q - centroid.q) * axisQ + (cell.coord.r - centroid.r) * axisR,
  );
  const minProjection = projections.length === 0 ? 0 : Math.min(...projections);
  const span = Math.max(
    1e-6,
    (projections.length === 0 ? 1 : Math.max(...projections)) - minProjection,
  );
  const raw = cells.map(({ coord, kind }) => {
    const key = hexKey(coord);
    const isRoute = routeKeys.has(key) || kind === "route";
    const projection = (coord.q - centroid.q) * axisQ + (coord.r - centroid.r) * axisR;
    const along = (projection - minProjection) / span;
    let terrace = along < 0.32 ? 1 : along < 0.64 ? 2 : 3;
    const coarseQ = Math.round(coord.q / 3);
    const coarseR = Math.round(coord.r / 3);
    // Keep the three bands mostly intact. A minority of coarse patches may
    // step once so the ridgeline is not a ruler cut.
    if (hash(`${seed}/terrace-blob/${coarseQ},${coarseR}`) < 0.22) {
      terrace = clampHeight(
        terrace + (hash(`${seed}/terrace-blob-dir/${coarseQ},${coarseR}`) < 0.5 ? -1 : 1),
      );
    }
    const baseHeight = kind === "detached" ? 1 : isRoute ? clampHeight(terrace + 1) : terrace;
    return { key, coord, kind, height: baseHeight };
  });
  const heights = new Map(raw.map((entry) => [entry.key, entry.height]));
  // A noisy field is useful only when its cliffs remain readable. Clamp each
  // land cell against its neighbours twice so a single random cell cannot
  // hide the top faces of an entire terrace behind a three-level wall.
  for (const entry of raw) {
    if (entry.kind === "route" || routeKeys.has(entry.key)) continue;
    const neighbours = hexNeighbors(entry.coord)
      .map((cell) => heights.get(hexKey(cell)))
      .filter((height): height is number => height !== undefined);
    if (neighbours.length === 0) continue;
    const minimum = Math.min(...neighbours);
    const maximum = Math.max(...neighbours);
    heights.set(
      entry.key,
      clampHeight(Math.max(minimum - 1, Math.min(maximum + 1, heights.get(entry.key)!))),
    );
  }
  // Keep the road one visual step above its shoulder. The land may still form
  // higher terraces farther away, but a neighbouring meadow cell must not
  // erase the ivory path's raised silhouette.
  for (const entry of raw) {
    if (entry.kind === "route" || routeKeys.has(entry.key)) continue;
    const routeHeights = hexNeighbors(entry.coord)
      .map((cell) => (routeKeys.has(hexKey(cell)) ? heights.get(hexKey(cell)) : undefined))
      .filter((height): height is number => height !== undefined);
    if (routeHeights.length === 0) continue;
    heights.set(entry.key, clampHeight(Math.max(...routeHeights) - 1));
  }
  return raw.map((entry) => {
    const lift = entry.key === activeKey ? 1 : 0;
    const height = clampHeight(heights.get(entry.key)! + lift) as 1 | 2 | 3 | 4;
    return { key: entry.key, height, topY: height * GRID_ELEVATION_STEP };
  });
}
