import { hash } from "../island/random.js";
import { worldSunDirection } from "../sky/sun.js";
import { hexKey, hexNeighbors, hexToWorld, type HexCoord } from "./hex.js";

export const GRID_ELEVATION_STEP = 0.78;
export const GRID_ELEVATION_LEVELS = 4;

/**
 * Course tops are still hexes, but their shared top plane can carry a gentle
 * terrain slope. This is a world-space gradient (dy / horizontal unit); the
 * renderer converts it to the local scale of each prism before applying it to
 * the top vertices and their normals.
 */
export interface GridSurfaceSlope {
  readonly x: number;
  readonly z: number;
}

export const GRID_SURFACE_SLOPE_MAX = 0.52;
const GRID_SURFACE_SLOPE_FROM_HEIGHT = 0.38;
const GRID_SURFACE_SLOPE_FROM_RELIEF = 0.62;
const GRID_SURFACE_LIGHT_SLOPE = 0.46;
const GRID_SURFACE_CROSS_SLOPE = 0.14;
const GRID_SURFACE_EDGE_SLOPE = 0.12;

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

interface SurfaceCell {
  readonly coord: HexCoord;
  readonly topY: number;
}

function clampSlope(x: number, z: number): GridSurfaceSlope {
  const length = Math.hypot(x, z);
  if (length <= GRID_SURFACE_SLOPE_MAX || length <= Number.EPSILON) return { x, z };
  const scale = GRID_SURFACE_SLOPE_MAX / length;
  return { x: x * scale, z: z * scale };
}

/**
 * Derive one coherent, low-frequency slope field from the same cells that own
 * elevation. The neighbour term follows real terrace changes; the relief term
 * keeps the interiors from becoming a collection of perfectly horizontal
 * plates. It is deliberately smooth and value-only: no colour or hue is
 * synthesised here, and no per-cell random field is introduced.
 */
export function gridSurfaceSlopeFor(
  cell: SurfaceCell,
  cells: readonly SurfaceCell[],
  seed: string,
): GridSurfaceSlope {
  const origin = hexToWorld(cell.coord, 1);
  const heights = new Map(cells.map((candidate) => [hexKey(candidate.coord), candidate.topY]));
  let heightGradientX = 0;
  let heightGradientZ = 0;
  let heightGradientWeight = 0;
  for (const neighbour of hexNeighbors(cell.coord)) {
    const neighbourY = heights.get(hexKey(neighbour));
    if (neighbourY === undefined) continue;
    const point = hexToWorld(neighbour, 1);
    const dx = point.x - origin.x;
    const dz = point.z - origin.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= Number.EPSILON) continue;
    const heightDelta = neighbourY - cell.topY;
    heightGradientX += (heightDelta * dx) / distanceSquared;
    heightGradientZ += (heightDelta * dz) / distanceSquared;
    heightGradientWeight += 1;
  }
  if (heightGradientWeight > 0) {
    heightGradientX /= heightGradientWeight;
    heightGradientZ /= heightGradientWeight;
  }

  const bounds = cells.reduce(
    (result, candidate) => {
      const point = hexToWorld(candidate.coord, 1);
      return {
        minX: Math.min(result.minX, point.x),
        maxX: Math.max(result.maxX, point.x),
        minZ: Math.min(result.minZ, point.z),
        maxZ: Math.max(result.maxZ, point.z),
      };
    },
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const halfX = Math.max((bounds.maxX - bounds.minX) * 0.5, 1);
  const halfZ = Math.max((bounds.maxZ - bounds.minZ) * 0.5, 1);
  const centreX = (bounds.minX + bounds.maxX) * 0.5;
  const centreZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const radialX = (origin.x - centreX) / halfX;
  const radialZ = (origin.z - centreZ) / halfZ;
  const radialLength = Math.hypot(radialX, radialZ);
  const normalizedRadialX = radialLength > Number.EPSILON ? radialX / radialLength : 0;
  const normalizedRadialZ = radialLength > Number.EPSILON ? radialZ / radialLength : 0;
  const edgeWeight = Math.min(1, Math.max(0, (radialLength - 0.08) / 0.82));

  const [sunX, , sunZ] = worldSunDirection();
  const sunHorizontalLength = Math.hypot(sunX, sunZ);
  const lightAxisX = sunX / Math.max(sunHorizontalLength, Number.EPSILON);
  const lightAxisZ = sunZ / Math.max(sunHorizontalLength, Number.EPSILON);
  const crossAxisX = -lightAxisZ;
  const crossAxisZ = lightAxisX;

  // A broad, sun-facing wave gives the field a real lit shoulder and a real
  // back shoulder. It changes normals, not albedo: the same green swatch is
  // still sent to every course land cell. The cross wave and edge shoulder
  // keep the land from reading as one mathematically perfect tilted board.
  // Both waves are low-frequency and phase-only seeded, so neighbouring cells
  // stay coherent and no per-cell colour/noise field can return.
  const phase = hash(`${seed}/surface-relief-phase`) * Math.PI * 2;
  const span = Math.max(halfX, halfZ, 1);
  const fromCentreX = origin.x - centreX;
  const fromCentreZ = origin.z - centreZ;
  const lightCoordinate = (fromCentreX * lightAxisX + fromCentreZ * lightAxisZ) / span;
  const crossCoordinate = (fromCentreX * crossAxisX + fromCentreZ * crossAxisZ) / span;
  const lightWave = Math.cos(lightCoordinate * Math.PI * 1.35 + phase);
  const crossWave = Math.sin(crossCoordinate * Math.PI * 1.1 + phase * 0.63);
  const reliefX =
    -lightAxisX * GRID_SURFACE_LIGHT_SLOPE * lightWave +
    crossAxisX * GRID_SURFACE_CROSS_SLOPE * crossWave -
    normalizedRadialX * GRID_SURFACE_EDGE_SLOPE * edgeWeight;
  const reliefZ =
    -lightAxisZ * GRID_SURFACE_LIGHT_SLOPE * lightWave +
    crossAxisZ * GRID_SURFACE_CROSS_SLOPE * crossWave -
    normalizedRadialZ * GRID_SURFACE_EDGE_SLOPE * edgeWeight;
  return clampSlope(
    heightGradientX * GRID_SURFACE_SLOPE_FROM_HEIGHT + reliefX * GRID_SURFACE_SLOPE_FROM_RELIEF,
    heightGradientZ * GRID_SURFACE_SLOPE_FROM_HEIGHT + reliefZ * GRID_SURFACE_SLOPE_FROM_RELIEF,
  );
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
