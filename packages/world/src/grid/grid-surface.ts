/**
 * Deterministic surface planning for the shared hex grid.
 *
 * Surface is an orthogonal data axis to `GridCell.kind`: kind answers what a
 * cell means to the route, while surface answers what the ground is made of.
 * This module owns the answer without importing React or Three so the same
 * plan is used by the course and world projections and can be stress-tested
 * without starting a renderer.
 */
import { hash } from "../island/random.js";
import { hexKey, hexNeighbors, type HexCoord } from "./hex.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";
import {
  GRID_SURFACES,
  type GridBiome,
  type GridBiomeSurfaceMix,
  type GridSurface,
} from "./grid-theme.js";

export const GRID_SURFACE_MIN_WATER_COMPONENT = 5;
export const GRID_SURFACE_MAX_WATER_BOUNDARY_DISTANCE = 1;

export type GridSurfaceCellKind = "route" | "land" | "detached";

export interface GridSurfacePlanningCell {
  readonly coord: HexCoord;
  readonly key: string;
  readonly kind: GridSurfaceCellKind;
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
}

export interface GridSurfaceCell extends GridSurfacePlanningCell {
  readonly surface: GridSurface;
}

export interface GridSurfaceCounts {
  readonly grass: number;
  readonly stone: number;
  readonly sand: number;
  readonly water: number;
}

export type GridSurfaceRatios = GridSurfaceCounts;

export type GridSurfaceColourTable = Readonly<Record<GridSurface, number>>;

/** Canonical surface swatches. These are albedo roles, not extra materials. */
export const GRID_SURFACE_COLOURS: GridSurfaceColourTable = {
  grass: 0x609d5a,
  stone: 0x77786f,
  sand: 0xc7a663,
  water: 0x2c7f9b,
} as const;

/** How strongly the canonical surface role tints a course palette top. */
export const GRID_SURFACE_COLOUR_BLEND: Readonly<Record<GridSurface, number>> = {
  grass: 0,
  stone: 0.72,
  sand: 0.68,
  water: 0.82,
} as const;

export interface GridSurfaceColourGateMetrics {
  readonly minimumPairDistance: number;
  readonly maximumPairDistance: number;
  readonly luminanceSpan: number;
  readonly stoneRouteContrast: number;
}

function channel(colour: number, shift: number): number {
  return ((colour >> shift) & 255) / 255;
}

function linearChannel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(colour: number): number {
  return (
    0.2126 * linearChannel(channel(colour, 16)) +
    0.7152 * linearChannel(channel(colour, 8)) +
    0.0722 * linearChannel(channel(colour, 0))
  );
}

function colourDistance(first: number, second: number): number {
  return Math.hypot(
    channel(first, 16) - channel(second, 16),
    channel(first, 8) - channel(second, 8),
    channel(first, 0) - channel(second, 0),
  );
}

function contrast(first: number, second: number): number {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (high + 0.05) / (low + 0.05);
}

/**
 * Measure the surface colour strip before it reaches the shader.
 *
 * The minimum pair distance stops four names from collapsing into one beige
 * colour. The maximum pair distance and luminance span stop a table of tiny
 * neighbouring nudges from technically passing while remaining unreadable at
 * world scale. Stone is checked against the ivory route separately because a
 * dark grey stone that is merely "different" can still become a route lookalike
 * after the existing light rig is applied.
 */
export function gridSurfaceColourGateMetrics(
  colours: GridSurfaceColourTable = GRID_SURFACE_COLOURS,
  routeColour = GRID_SHARED_SOIL.road,
): GridSurfaceColourGateMetrics {
  const values = GRID_SURFACES.map((surface) => colours[surface]);
  const distances: number[] = [];
  for (let first = 0; first < values.length; first += 1) {
    for (let second = first + 1; second < values.length; second += 1) {
      distances.push(colourDistance(values[first]!, values[second]!));
    }
  }
  const lights = values.map(luminance);
  return {
    minimumPairDistance: Math.min(...distances),
    maximumPairDistance: Math.max(...distances),
    luminanceSpan: Math.max(...lights) - Math.min(...lights),
    stoneRouteContrast: contrast(colours.stone, routeColour),
  };
}

/**
 * Colour gate for the whole role table. It is intentionally independent of a
 * particular map so a future "all four swatches became the same" edit turns
 * red even when the selected course happens not to contain water.
 */
export function gridSurfaceColourGateHolds(
  colours: GridSurfaceColourTable = GRID_SURFACE_COLOURS,
  routeColour = GRID_SHARED_SOIL.road,
): boolean {
  const metrics = gridSurfaceColourGateMetrics(colours, routeColour);
  return (
    metrics.minimumPairDistance >= 0.14 &&
    metrics.maximumPairDistance >= 0.35 &&
    metrics.luminanceSpan >= 0.16 &&
    metrics.stoneRouteContrast >= 2.4
  );
}

function hexChannel(colour: number, shift: number): number {
  return (colour >> shift) & 255;
}

/**
 * Blend a surface role into one course palette colour while retaining the
 * course's identity. The renderer uses the same operation with Three colours;
 * this pure helper is useful for reports and colour tripwires.
 */
export function gridSurfaceColourFor(base: number, surface: GridSurface): number {
  const target = GRID_SURFACE_COLOURS[surface];
  const amount = GRID_SURFACE_COLOUR_BLEND[surface];
  const mix = (shift: number): number =>
    Math.round(hexChannel(base, shift) * (1 - amount) + hexChannel(target, shift) * amount);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export function gridSurfaceMixTotal(mix: GridBiomeSurfaceMix): number {
  return mix.grass + mix.stone + mix.sand + mix.water;
}

export function gridSurfaceMixIsValid(mix: GridBiomeSurfaceMix): boolean {
  return (
    GRID_SURFACES.every((surface) => Number.isFinite(mix[surface]) && mix[surface] >= 0) &&
    Math.abs(gridSurfaceMixTotal(mix) - 1) <= 1e-6
  );
}

export function gridSurfaceCounts(
  cells: readonly Pick<GridSurfaceCell, "surface">[],
): GridSurfaceCounts {
  const counts: Record<GridSurface, number> = { grass: 0, stone: 0, sand: 0, water: 0 };
  for (const cell of cells) counts[cell.surface] += 1;
  return counts;
}

export function gridSurfaceRatios(
  cells: readonly Pick<GridSurfaceCell, "surface" | "kind" | "lessonIndex">[],
): GridSurfaceRatios {
  const eligible = cells.filter((cell) => cell.kind === "land" && cell.lessonIndex === null);
  const counts = gridSurfaceCounts(eligible);
  const total = Math.max(1, eligible.length);
  return {
    grass: counts.grass / total,
    stone: counts.stone / total,
    sand: counts.sand / total,
    water: counts.water / total,
  };
}

function isProtected(cell: GridSurfacePlanningCell): boolean {
  return cell.kind === "route" || cell.lessonIndex !== null;
}

function mainCells(cells: readonly GridSurfacePlanningCell[]): readonly GridSurfacePlanningCell[] {
  return cells.filter((cell) => cell.kind !== "detached");
}

function boundaryDistanceFor(
  cell: GridSurfacePlanningCell,
  boundaryCells: readonly GridSurfacePlanningCell[],
): number {
  return Math.min(...boundaryCells.map((boundary) => hexDistance(cell.coord, boundary.coord)));
}

function hexDistance(first: HexCoord, second: HexCoord): number {
  const dq = first.q - second.q;
  const dr = first.r - second.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

function surfaceSignal(cell: GridSurfacePlanningCell, seed: string, biomeId: string): number {
  const phase = hash(`${seed}/surface-field/${biomeId}`) * Math.PI * 2;
  const x = cell.coord.q * 0.43 + cell.coord.r * 0.27;
  const z = cell.coord.r * 0.37 - cell.coord.q * 0.19;
  const wave = Math.sin(x + phase) * 0.56 + Math.cos(z - phase * 0.71) * 0.44;
  return Math.max(0, Math.min(1, 0.5 + wave * 0.5));
}

function connectedComponents(
  cells: readonly GridSurfacePlanningCell[],
): readonly (readonly GridSurfacePlanningCell[])[] {
  const byKey = new Map(cells.map((cell) => [cell.key, cell]));
  const unseen = new Set(byKey.keys());
  const components: GridSurfacePlanningCell[][] = [];
  while (unseen.size > 0) {
    const startKey = unseen.values().next().value as string;
    const start = byKey.get(startKey)!;
    const component: GridSurfacePlanningCell[] = [];
    const queue = [start];
    unseen.delete(startKey);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of hexNeighbors(current.coord)) {
        const key = hexKey(neighbor);
        const next = byKey.get(key);
        if (!next || !unseen.has(key)) continue;
        unseen.delete(key);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function connectedPrefix(
  component: readonly GridSurfacePlanningCell[],
  target: number,
  seed: string,
  biomeId: string,
  boundaryDistance: ReadonlyMap<string, number>,
): readonly GridSurfacePlanningCell[] {
  if (component.length === 0 || target <= 0) return [];
  const byKey = new Map(component.map((cell) => [cell.key, cell]));
  const start = [...component].sort(
    (first, second) =>
      (boundaryDistance.get(first.key) ?? 99) - (boundaryDistance.get(second.key) ?? 99) ||
      surfaceSignal(first, seed, `${biomeId}/water`) -
        surfaceSignal(second, seed, `${biomeId}/water`) ||
      first.key.localeCompare(second.key),
  )[0]!;
  const selected = [start];
  const selectedKeys = new Set([start.key]);
  while (selected.length < target) {
    const frontier = new Map<string, GridSurfacePlanningCell>();
    for (const current of selected) {
      for (const neighbor of hexNeighbors(current.coord)) {
        const key = hexKey(neighbor);
        const candidate = byKey.get(key);
        if (candidate && !selectedKeys.has(key)) frontier.set(key, candidate);
      }
    }
    if (frontier.size === 0) break;
    const next = [...frontier.values()].sort(
      (first, second) =>
        surfaceSignal(first, seed, `${biomeId}/water`) -
          surfaceSignal(second, seed, `${biomeId}/water`) ||
        (boundaryDistance.get(first.key) ?? 99) - (boundaryDistance.get(second.key) ?? 99) ||
        first.key.localeCompare(second.key),
    )[0]!;
    selected.push(next);
    selectedKeys.add(next.key);
  }
  return selected;
}

function assignQuota(
  surface: Map<string, GridSurface>,
  cells: readonly GridSurfacePlanningCell[],
  biome: GridBiome,
  surfaceName: "stone" | "sand",
  target: number,
  seed: string,
): void {
  if (target <= 0) return;
  const current = cells.filter((cell) => surface.get(cell.key) === surfaceName).length;
  const remaining = Math.max(0, target - current);
  if (remaining === 0) return;
  const candidates = cells
    .filter((cell) => !isProtected(cell) && surface.get(cell.key) === "grass")
    .sort(
      (first, second) =>
        surfacePriority(first, seed, biome.id, surfaceName) -
          surfacePriority(second, seed, biome.id, surfaceName) ||
        first.key.localeCompare(second.key),
    );
  for (const cell of candidates.slice(0, remaining)) surface.set(cell.key, surfaceName);
}

function surfacePriority(
  cell: GridSurfacePlanningCell,
  seed: string,
  biomeId: string,
  surfaceName: "stone" | "sand",
): number {
  const signal = surfaceSignal(cell, seed, `${biomeId}/${surfaceName}`);
  return surfaceName === "stone" ? signal : 1 - signal;
}

function eligibleForBiome(
  cells: readonly GridSurfacePlanningCell[],
  biome: GridBiome,
  unitBiomes: ReadonlyMap<string, GridBiome>,
): readonly GridSurfacePlanningCell[] {
  return cells.filter(
    (cell) =>
      cell.kind === "land" &&
      cell.lessonIndex === null &&
      (cell.unitId ? unitBiomes.get(cell.unitId)?.id === biome.id : false),
  );
}

/**
 * Compile surface types from the shared cells and the biome mix table.
 *
 * Water is selected from an outer-ring candidate component and grown from one
 * seed, so the planner can never make a scattering of one-cell ponds. Its
 * sand buffer is applied before the ordinary stone/sand quotas, which makes a
 * shoreline a transition rather than a direct water-to-grass edge.
 */
export function gridSurfacesForCells(
  cells: readonly GridSurfacePlanningCell[],
  unitBiomes: ReadonlyMap<string, GridBiome>,
  seed: string,
): ReadonlyMap<string, GridSurface> {
  const main = mainCells(cells);
  const mainKeys = new Set(main.map((cell) => cell.key));
  const cellByKey = new Map(cells.map((cell) => [cell.key, cell]));
  const boundary = main.filter((cell) =>
    hexNeighbors(cell.coord).some((neighbor) => !mainKeys.has(hexKey(neighbor))),
  );
  const boundaryDistance = new Map(
    main.map((cell) => [cell.key, boundaryDistanceFor(cell, boundary)]),
  );
  const surface = new Map<string, GridSurface>(cells.map((cell) => [cell.key, "grass"]));

  const biomes = [
    ...new Map(
      main
        .map((cell) => (cell.unitId ? unitBiomes.get(cell.unitId) : undefined))
        .filter((biome): biome is GridBiome => biome !== undefined)
        .map((biome) => [biome.id, biome]),
    ).values(),
  ];

  for (const biome of biomes) {
    if (!gridSurfaceMixIsValid(biome.surfaceMix)) {
      throw new RangeError(`Invalid surface mix for biome ${biome.id}`);
    }
  }

  const waterKeys = new Set<string>();
  for (const biome of biomes) {
    if (biome.surfaceMix.water <= 0) continue;
    const eligible = eligibleForBiome(main, biome, unitBiomes);
    const target = Math.round(eligible.length * biome.surfaceMix.water);
    if (target < GRID_SURFACE_MIN_WATER_COMPONENT) continue;
    const candidates = eligible.filter(
      (cell) =>
        (boundaryDistance.get(cell.key) ?? Infinity) <= GRID_SURFACE_MAX_WATER_BOUNDARY_DISTANCE &&
        !hexNeighbors(cell.coord).some((neighbor) => {
          const adjacent = cellByKey.get(hexKey(neighbor));
          return adjacent !== undefined && isProtected(adjacent);
        }),
    );
    const component = connectedComponents(candidates)
      .filter((candidate) => candidate.length >= GRID_SURFACE_MIN_WATER_COMPONENT)
      .sort(
        (first, second) =>
          second.length - first.length || first[0]!.key.localeCompare(second[0]!.key),
      )[0];
    if (!component) continue;
    for (const cell of connectedPrefix(
      component,
      Math.min(component.length, target),
      seed,
      biome.id,
      boundaryDistance,
    )) {
      waterKeys.add(cell.key);
      surface.set(cell.key, "water");
    }
  }

  // A water cell may touch the world outside the island, but any in-island
  // neighbour is a shoreline candidate. Protected route/lesson neighbours
  // were excluded above, so this buffer never needs to rewrite walkability.
  const forcedSandKeys = new Set<string>();
  for (const cell of main) {
    if (!waterKeys.has(cell.key)) continue;
    for (const neighbor of hexNeighbors(cell.coord)) {
      const adjacent = cellByKey.get(hexKey(neighbor));
      if (adjacent && !isProtected(adjacent) && !waterKeys.has(adjacent.key)) {
        forcedSandKeys.add(adjacent.key);
      }
    }
  }
  for (const key of forcedSandKeys) surface.set(key, "sand");

  for (const biome of biomes) {
    const eligible = eligibleForBiome(main, biome, unitBiomes);
    assignQuota(
      surface,
      eligible,
      biome,
      "sand",
      Math.round(eligible.length * biome.surfaceMix.sand),
      seed,
    );
    assignQuota(
      surface,
      eligible,
      biome,
      "stone",
      Math.round(eligible.length * biome.surfaceMix.stone),
      seed,
    );
  }

  return surface;
}

function isSurface(value: unknown): value is GridSurface {
  return typeof value === "string" && (GRID_SURFACES as readonly string[]).includes(value);
}

function waterComponents(
  cells: readonly GridSurfaceCell[],
): readonly (readonly GridSurfaceCell[])[] {
  return connectedComponents(
    cells.filter((cell) => cell.surface === "water"),
  ) as readonly (readonly GridSurfaceCell[])[];
}

/** Return every violated surface rule; useful for diagnostics and tripwires. */
export function gridSurfaceConstraintViolations(
  cells: readonly GridSurfaceCell[],
  minimumWaterComponent = GRID_SURFACE_MIN_WATER_COMPONENT,
): readonly string[] {
  const violations: string[] = [];
  const byKey = new Map(cells.map((cell) => [cell.key, cell]));
  for (const cell of cells) {
    if (!isSurface(cell.surface)) violations.push(`invalid-surface:${cell.key}`);
    if ((cell.kind === "route" || cell.lessonIndex !== null) && cell.surface !== "grass") {
      violations.push(`walkability:${cell.key}`);
    }
    if (cell.kind === "detached" && cell.surface === "water") {
      violations.push(`detached-water:${cell.key}`);
    }
  }
  for (const component of waterComponents(cells)) {
    if (component.length < minimumWaterComponent) {
      violations.push(`water-component:${component.map((cell) => cell.key).join("/")}`);
    }
  }
  for (const cell of cells) {
    if (cell.surface !== "water") continue;
    for (const neighbor of hexNeighbors(cell.coord)) {
      const adjacent = byKey.get(hexKey(neighbor));
      if (adjacent?.surface === "grass") {
        violations.push(`water-grass-transition:${cell.key}/${adjacent.key}`);
      }
    }
  }
  return violations;
}

export function gridSurfaceContractHolds(
  cells: readonly GridSurfaceCell[],
  minimumWaterComponent = GRID_SURFACE_MIN_WATER_COMPONENT,
): boolean {
  return gridSurfaceConstraintViolations(cells, minimumWaterComponent).length === 0;
}

/** Fail closed at the data boundary so renderers never receive a bad field. */
export function assertGridSurfaceContract(
  cells: readonly GridSurfaceCell[],
  minimumWaterComponent = GRID_SURFACE_MIN_WATER_COMPONENT,
): void {
  const violations = gridSurfaceConstraintViolations(cells, minimumWaterComponent);
  if (violations.length > 0) {
    throw new RangeError(`Invalid grid surface plan: ${violations.join(", ")}`);
  }
}
