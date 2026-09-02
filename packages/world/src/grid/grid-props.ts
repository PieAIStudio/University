import { hash } from "../island/random.js";
import { hexDistance, hexKey, type HexCoord } from "./hex.js";
import {
  gridBiomesForUnits,
  gridNatureAspect,
  gridPropSize,
  type GridBiome,
  type GridPropRole,
} from "./grid-theme.js";

/**
 * An id from the grid nature library. It is a plain string rather than a
 * closed union because the library is now generated from the donor at import
 * time; `grid-theme.test.ts` is what proves every id a biome names is really
 * in the manifest, which is a stronger guarantee than a hand-maintained union
 * that only had to compile.
 */
export type GridPropAssetId = string;
export type GridPropProjection = "course" | "world";

export interface GridPropCellInput {
  readonly coord: HexCoord;
  readonly kind: "route" | "land" | "detached";
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly distanceToRoute: number;
}

export interface GridPropPlacement {
  readonly cellKey: string;
  readonly coord: HexCoord;
  readonly assetId: GridPropAssetId;
  readonly kind: "course" | "territory" | "landmark";
  readonly role: GridPropRole;
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly rotation: number;
  /** World-unit height the renderer scales the normalised mesh to. */
  readonly height: number;
  /** World-unit horizontal scale. */
  readonly width: number;
  /** World-unit ground footprint. */
  readonly footprint: number;
  /** Course-view semantic LOD; omitted means the placement is rendered. */
  readonly visibleInCourse?: boolean;
}

/**
 * How much dressing a cell receives, by how far it is from the road.
 *
 * This profile is the fix for the single worst defect on the branch it
 * replaces. Density used to *rise* with distance from the route — a clean
 * shoulder, in principle — and then the visual LOD kept the highest-scoring
 * placements, where the score was also distance from the route. The two
 * decisions agreed, and their agreement was catastrophic: of 287 planned props
 * exactly 32 were drawn, none of them within two cells of the road, and the
 * learner's camera stands *on* the road. The island rendered as bare ground.
 *
 * So the shoulder is now a ridge rather than a ramp. Index is the ring
 * distance from the route, clamped to the last entry:
 *  - ring 0 is the road itself and never receives dressing;
 *  - ring 1 gets small things only, so a marker is never crowded;
 *  - rings 2-3 are the peak, because that is the band the course camera fills
 *    its frame with;
 *  - beyond that it decays but never to zero, so the far meadow keeps a
 *    horizon without becoming a hedge.
 */
export const GRID_SHOULDER_PROFILE: Readonly<Record<GridPropRole, readonly number[]>> = {
  // A tall silhouette beside the road would sit between the camera and the
  // lesson marker, which is the one thing dressing may never do.
  canopy: [0, 0, 1, 1, 0.82, 0.62, 0.46],
  understory: [0, 0.42, 1, 0.94, 0.76, 0.58, 0.44],
  ground: [0, 0.92, 1, 0.88, 0.68, 0.52, 0.4],
  landmark: [0, 0, 1, 1, 0.5, 0.25, 0.1],
};

export function gridShoulderWeight(role: GridPropRole, distanceToRoute: number): number {
  const profile = GRID_SHOULDER_PROFILE[role];
  const index = Math.min(Math.max(0, Math.round(distanceToRoute)), profile.length - 1);
  return profile[index]!;
}

/**
 * How many dressed props the course view actually draws.
 *
 * The old cap was 34 for any course longer than a sample, which is roughly one
 * prop per ten cells: an island that is empty everywhere the learner looks.
 * This scales with the route because a longer course is a bigger island, and
 * it is still a cap rather than a target — the shoulder profile above decides
 * where they go, and a short course simply has fewer.
 */
export function gridVisiblePropTarget(routeLength: number): number {
  return Math.min(210, Math.max(24, Math.round(routeLength * 3.6)));
}

/** Cells this close to a landmark stay clear so it reads as one large thing. */
export const GRID_LANDMARK_CLEARANCE = 1;
/** Two tall silhouettes closer than this read as a hedge, not as landmarks. */
export const GRID_CANOPY_SPACING = 2;

interface RoleChoice {
  readonly role: GridPropRole;
  readonly assets: readonly string[];
}

function roleChoicesFor(biome: GridBiome): readonly RoleChoice[] {
  return [
    { role: "canopy", assets: biome.canopy },
    { role: "understory", assets: biome.understory },
    { role: "ground", assets: biome.ground },
  ];
}

function biomeRoleDensity(biome: GridBiome, role: GridPropRole): number {
  if (role === "canopy") return biome.canopyDensity;
  if (role === "understory") return biome.understoryDensity;
  if (role === "ground") return biome.groundDensity;
  return 0;
}

function placementFor(
  cell: GridPropCellInput,
  role: GridPropRole,
  assetId: string,
  seed: string,
  kind: GridPropPlacement["kind"],
  keySuffix: string,
  projection: GridPropProjection,
): GridPropPlacement {
  const size = gridPropSize(
    role,
    gridNatureAspect(assetId),
    hash(`${seed}/prop-size/${keySuffix}`),
  );
  // The world projection draws the same plan at archipelago scale, where a
  // course island is a few dozen pixels. One shared shrink keeps it the same
  // placement rather than a second layout with its own rules.
  const worldScale = projection === "world" ? 0.42 : 1;
  return {
    cellKey: hexKey(cell.coord),
    coord: cell.coord,
    assetId,
    kind,
    role,
    lessonIndex: null,
    unitId: cell.unitId,
    rotation: hash(`${seed}/prop-rotation/${keySuffix}`) * Math.PI * 2,
    height: size.height * worldScale,
    width: size.width * worldScale,
    footprint: size.footprint * worldScale,
  };
}

function pick<T>(items: readonly T[], roll: number): T {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))]!;
}

/**
 * The one large thing that opens a unit.
 *
 * A landmark is placed beside the unit's *first* lesson rather than at its
 * centre, because its job is to be the thing a learner sees as they arrive.
 * It never lands on the road and never touches a lesson cell, so it cannot
 * occlude the control the learner is meant to click.
 */
function landmarkCellFor(
  unitId: string,
  cells: readonly GridPropCellInput[],
  lessonCoords: readonly HexCoord[],
  seed: string,
): GridPropCellInput | null {
  const unitLessons = cells
    .filter((cell) => cell.unitId === unitId && cell.lessonIndex !== null)
    .sort((first, second) => (first.lessonIndex ?? 0) - (second.lessonIndex ?? 0));
  const anchor = unitLessons[0];
  if (!anchor) return null;
  const candidates = cells
    .filter(
      (cell) =>
        cell.kind === "land" &&
        cell.unitId === unitId &&
        cell.distanceToRoute >= 2 &&
        cell.distanceToRoute <= 3 &&
        hexDistance(cell.coord, anchor.coord) <= 4 &&
        lessonCoords.every((lesson) => hexDistance(cell.coord, lesson) > 1),
    )
    .sort(
      (first, second) =>
        hexDistance(first.coord, anchor.coord) - hexDistance(second.coord, anchor.coord) ||
        hash(`${seed}/landmark/${hexKey(first.coord)}`) -
          hash(`${seed}/landmark/${hexKey(second.coord)}`),
    );
  return candidates[0] ?? null;
}

export function gridPropsFor(
  cells: readonly GridPropCellInput[],
  route: readonly HexCoord[],
  seed: string,
  projection: GridPropProjection = "course",
): readonly GridPropPlacement[] {
  const unitIds: string[] = [];
  for (const cell of cells) {
    if (cell.unitId && !unitIds.includes(cell.unitId)) unitIds.push(cell.unitId);
  }
  const biomes = gridBiomesForUnits(unitIds, seed);
  if (biomes.size === 0) return [];
  const fallbackBiome = biomes.get(unitIds[0]!)!;
  const biomeFor = (cell: GridPropCellInput): GridBiome =>
    (cell.unitId ? biomes.get(cell.unitId) : undefined) ?? fallbackBiome;

  const lessonCoords = cells
    .filter((cell) => cell.lessonIndex !== null)
    .map((cell) => cell.coord);
  const occupied = new Set<string>();
  const placements: GridPropPlacement[] = [];
  const landmarkCoords: HexCoord[] = [];
  const canopyCoords: HexCoord[] = [];

  // --- landmarks first: they claim their clearing before anything else ----
  for (const unitId of unitIds) {
    const cell = landmarkCellFor(unitId, cells, lessonCoords, seed);
    if (!cell) continue;
    const biome = biomes.get(unitId) ?? fallbackBiome;
    placements.push({
      ...placementFor(
        cell,
        "landmark",
        biome.landmark,
        seed,
        "landmark",
        `landmark/${unitId}`,
        projection,
      ),
      unitId,
    });
    occupied.add(hexKey(cell.coord));
    landmarkCoords.push(cell.coord);
  }

  // --- the dressing field -------------------------------------------------
  for (const cell of cells) {
    const cellKey = hexKey(cell.coord);
    if (occupied.has(cellKey)) continue;
    if (cell.kind !== "land") continue;
    /*
     * A landmark needs air around it to read as one large thing — but only
     * against things of its own size. Blanking the ring entirely cost 42 of
     * 287 land cells on the pressure course, and because landmarks sit two to
     * three rings off the road, every one of those cells was in the band the
     * course camera fills. Small punctuation at the base of a monument is what
     * gives it scale, so `ground` is still allowed inside the clearing.
     */
    const insideClearing = landmarkCoords.some(
      (coord) => hexDistance(cell.coord, coord) <= GRID_LANDMARK_CLEARANCE,
    );

    const biome = biomeFor(cell);
    // One roll picks the role, weighted by the biome's own character and by
    // the shoulder profile. A quarry is open and rocky; a pine ridge is dense
    // and tall. The same arithmetic produces both.
    const choices = roleChoicesFor(biome)
      .filter((choice) => !insideClearing || choice.role === "ground")
      .map((choice) => ({
        ...choice,
        weight:
          biomeRoleDensity(biome, choice.role) *
          gridShoulderWeight(choice.role, cell.distanceToRoute),
      }))
      .filter((choice) => choice.weight > 0 && choice.assets.length > 0);
    const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
    if (total <= 0) continue;
    if (hash(`${seed}/prop-density/${cellKey}`) >= total) continue;

    let cursor = hash(`${seed}/prop-role/${cellKey}`) * total;
    let chosen = choices[choices.length - 1]!;
    for (const choice of choices) {
      if (cursor < choice.weight) {
        chosen = choice;
        break;
      }
      cursor -= choice.weight;
    }

    /*
     * A tree is a landmark, not a fence post: tall silhouettes keep their
     * distance so an arm of the island cannot turn into a hedge.
     *
     * But a rejected canopy falls *down* the scale rather than leaving the cell
     * bare. Skipping outright was quietly the second-largest source of empty
     * ground: the spacing rule fires most often exactly where trees want to be,
     * which is the band the camera fills, so the rule that was meant to thin a
     * hedge was instead clearing the foreground. A clearing around a tree still
     * has undergrowth in it.
     */
    if (
      chosen.role === "canopy" &&
      canopyCoords.some((coord) => hexDistance(cell.coord, coord) <= GRID_CANOPY_SPACING)
    ) {
      const understory = choices.find((choice) => choice.role === "understory");
      const ground = choices.find((choice) => choice.role === "ground");
      const fallback =
        hash(`${seed}/prop-canopy-fallback/${cellKey}`) < 0.45
          ? (understory ?? ground)
          : (ground ?? understory);
      if (!fallback) continue;
      chosen = fallback;
    }

    const assetId = pick(chosen.assets, hash(`${seed}/prop-asset/${cellKey}`));
    placements.push(
      placementFor(cell, chosen.role, assetId, seed, "territory", cellKey, projection),
    );
    occupied.add(cellKey);
    if (chosen.role === "canopy") canopyCoords.push(cell.coord);
  }

  return projection === "course"
    ? selectCourseVisiblePlacements(placements, route, seed)
    : selectWorldVisiblePlacements(placements, seed);
}

/**
 * The course-view visual LOD.
 *
 * Sorted by distance to the route *ascending*. That single character is the
 * defect this file was rewritten around: the previous implementation sorted
 * descending, and so kept, with complete precision, the props furthest from
 * the only place the learner ever stands.
 *
 * Landmarks are never dropped. They are the chapter headings.
 */
function selectCourseVisiblePlacements(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
  seed: string,
): readonly GridPropPlacement[] {
  if (route.length === 0) return placements;
  const target = gridVisiblePropTarget(route.length);
  const distance = (placement: GridPropPlacement): number =>
    Math.min(...route.map((entry) => hexDistance(entry, placement.coord)));

  const selected = new Set<string>();
  for (const placement of placements) {
    if (placement.kind === "landmark") selected.add(placement.cellKey);
  }

  const candidates = placements
    .filter((placement) => placement.kind === "territory")
    .map((placement) => ({
      placement,
      // The jitter keeps one ring from being taken in a solid block, which
      // would read as a band of dressing rather than as a meadow.
      score: distance(placement) + hash(`${seed}/course-visible/${placement.cellKey}`) * 0.9,
    }))
    .sort((first, second) => first.score - second.score);

  for (const candidate of candidates) {
    if (selected.size >= target) break;
    selected.add(candidate.placement.cellKey);
  }

  return placements.map((placement) =>
    selected.has(placement.cellKey)
      ? placement
      : { ...placement, visibleInCourse: false as const },
  );
}

/**
 * The archipelago view draws fifty-three islands at once, so it keeps only a
 * silhouette: the unit landmarks plus a thin scatter of canopy.
 */
function selectWorldVisiblePlacements(
  placements: readonly GridPropPlacement[],
  seed: string,
): readonly GridPropPlacement[] {
  const selected = new Set<string>();
  let canopyBudget = 2;
  for (const placement of placements) {
    if (placement.kind === "landmark" && selected.size < 1) {
      selected.add(placement.cellKey);
      continue;
    }
    if (
      placement.role === "canopy" &&
      canopyBudget > 0 &&
      hash(`${seed}/world-visible/${placement.cellKey}`) < 0.5
    ) {
      selected.add(placement.cellKey);
      canopyBudget -= 1;
    }
  }
  return placements.map((placement) =>
    selected.has(placement.cellKey)
      ? placement
      : { ...placement, visibleInCourse: false as const },
  );
}

export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return new Set(placements.map((placement) => placement.cellKey)).size === placements.length;
}

export function distanceToRoute(cell: HexCoord, route: readonly HexCoord[]): number {
  return Math.min(...route.map((entry) => hexDistance(cell, entry)));
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
      if (
        hexDistance(canopies[first]!.coord, canopies[second]!.coord) <= GRID_CANOPY_SPACING - 1
      ) {
        return false;
      }
    }
  }
  return true;
}
