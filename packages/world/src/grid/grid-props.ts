import { hash } from "../island/random.js";
import { hexDistance, hexKey, type HexCoord } from "./hex.js";

export const GRID_PROP_ASSET_IDS = [
  "tree_pineRoundA",
  "tree_oak",
  "tree_simple",
  "plant_bushLarge",
  "mushroom_redGroup",
  "flower_yellowA",
  "rock_largeA",
  "rock_smallA",
  "stump_round",
] as const;

export type GridPropAssetId = (typeof GRID_PROP_ASSET_IDS)[number];
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
  readonly kind: "course" | "territory";
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly rotation: number;
  readonly scale: number;
  /** Course-view semantic LOD; omitted means the placement is rendered. */
  readonly visibleInCourse?: boolean;
}

function courseAssetForUnit(
  unitId: string,
  seed: string,
  projection: GridPropProjection,
): GridPropAssetId {
  const courseAssets: readonly GridPropAssetId[] =
    projection === "world"
      ? ["tree_pineRoundA", "tree_oak", "plant_bushLarge", "rock_largeA"]
      : [
          "tree_pineRoundA",
          "tree_oak",
          "tree_simple",
          "plant_bushLarge",
          "mushroom_redGroup",
          "rock_largeA",
        ];
  return courseAssets[Math.floor(hash(`${seed}/unit-prop/${unitId}`) * courseAssets.length)]!;
}

function territoryAssetForCell(
  cell: GridPropCellInput,
  seed: string,
  projection: GridPropProjection,
): GridPropAssetId {
  const roll = hash(`${seed}/territory-prop/${hexKey(cell.coord)}`);
  if (projection === "world") {
    // At world scale only the large silhouettes survive the projection. The
    // small punctuation assets remain a course-view privilege, not a source
    // of fifty-three duplicated loader paths on the first screen.
    if (roll < 0.34) return "tree_pineRoundA";
    if (roll < 0.62) return "tree_oak";
    if (roll < 0.84) return "plant_bushLarge";
    return "rock_largeA";
  }
  // Trees and rocks carry the silhouette at this camera. The weighted table
  // keeps flowers/mushrooms as punctuation rather than letting a random seed
  // turn one arm into a repeated line of tiny red caps. Round stumps read as
  // clipping artefacts from the aerial camera, so they stay out of the field.
  if (roll < 0.16) return "tree_pineRoundA";
  if (roll < 0.36) return "tree_oak";
  if (roll < 0.46) return "tree_simple";
  if (roll < 0.62) return "plant_bushLarge";
  if (roll < 0.72) return "rock_largeA";
  if (roll < 0.82) return "rock_smallA";
  if (roll < 0.91) return "flower_yellowA";
  return "mushroom_redGroup";
}

function isTallSilhouette(assetId: GridPropAssetId): boolean {
  return assetId.startsWith("tree_") || assetId === "plant_bushLarge";
}

function territoryPlacementForCell(
  cell: GridPropCellInput,
  seed: string,
  projection: GridPropProjection,
  keySuffix = hexKey(cell.coord),
  assetIdOverride?: GridPropAssetId,
  visibleInCourse = true,
): GridPropPlacement {
  const cellKey = hexKey(cell.coord);
  return {
    cellKey,
    coord: cell.coord,
    assetId: assetIdOverride ?? territoryAssetForCell(cell, seed, projection),
    kind: "territory",
    lessonIndex: null,
    unitId: null,
    rotation: hash(`${seed}/territory-rotation/${keySuffix}`) * Math.PI * 2,
    scale:
      projection === "world"
        ? 0.28 + hash(`${seed}/territory-scale/${keySuffix}`) * 0.1
        : 0.58 + hash(`${seed}/territory-scale/${keySuffix}`) * 0.22,
    ...(visibleInCourse ? {} : { visibleInCourse: false }),
  };
}

function territoryFillAssetForCell(cell: GridPropCellInput, seed: string): GridPropAssetId {
  const roll = hash(`${seed}/territory-fill-asset/${hexKey(cell.coord)}`);
  // The fill keeps the course's logical dressing floor without turning every
  // spare cell into a tree. Tall silhouettes come only from the sparse natural
  // pass above; these lower punctuation assets leave the route and its horizon
  // open like the reference meadow.
  if (roll < 0.22) return "plant_bushLarge";
  if (roll < 0.42) return "rock_largeA";
  if (roll < 0.62) return "rock_smallA";
  if (roll < 0.8) return "flower_yellowA";
  return "mushroom_redGroup";
}

function selectCourseVisiblePlacements(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
  seed: string,
): readonly GridPropPlacement[] {
  const candidates = placements.filter(
    (placement) => placement.kind === "territory" && placement.visibleInCourse !== false,
  );
  if (candidates.length === 0) return placements;

  // A readable course needs a few landmarks, not one prop on every spare
  // hex. Keep the logical plan dense for composition metrics, then apply one
  // deterministic visual LOD to the actual GLB field. The cap scales with the
  // route so a three-lesson sample still has a small vocabulary while a long
  // course can feel inhabited without becoming a hedge.
  const visibleTarget = Math.min(34, Math.max(8, Math.round(route.length * 0.78)));
  const treeTarget = Math.min(8, Math.max(3, Math.round(route.length * 0.16)));
  const distance = (placement: GridPropPlacement): number =>
    Math.min(...route.map((entry) => hexDistance(entry, placement.coord)));
  const score = (placement: GridPropPlacement, suffix: string): number =>
    distance(placement) * 10 + hash(`${seed}/course-visible/${suffix}/${placement.cellKey}`);
  const selected = new Set<string>();
  const treeAssets = new Set<GridPropAssetId>(["tree_pineRoundA", "tree_oak", "tree_simple"]);
  const trees = candidates
    .filter((placement) => treeAssets.has(placement.assetId))
    .sort((first, second) => score(second, "tree") - score(first, "tree"));
  // Preserve the two silhouette families (and the compact tree variant when a
  // seed contains it) before filling the remaining tree quota.
  for (const assetId of treeAssets) {
    const placement = trees.find((candidate) => candidate.assetId === assetId);
    if (placement) selected.add(placement.cellKey);
  }
  for (const placement of trees) {
    if (selected.size >= treeTarget) break;
    selected.add(placement.cellKey);
  }

  // One representative of every small punctuation asset prevents a reviewed
  // seed from collapsing into only rocks or only mushrooms after the cap.
  const remaining = candidates.filter((placement) => !selected.has(placement.cellKey));
  for (const assetId of new Set(remaining.map((placement) => placement.assetId))) {
    if (selected.size >= visibleTarget) break;
    const placement = remaining
      .filter((candidate) => candidate.assetId === assetId)
      .sort((first, second) => score(second, "asset") - score(first, "asset"))[0];
    if (placement) selected.add(placement.cellKey);
  }
  const fill = remaining
    .filter((placement) => !selected.has(placement.cellKey))
    .sort((first, second) => score(second, "fill") - score(first, "fill"));
  for (const placement of fill) {
    if (selected.size >= visibleTarget) break;
    selected.add(placement.cellKey);
  }

  return placements.map((placement) => {
    if (placement.kind !== "territory" || placement.visibleInCourse === false) return placement;
    return selected.has(placement.cellKey)
      ? placement
      : { ...placement, visibleInCourse: false as const };
  });
}

export function gridPropsFor(
  cells: readonly GridPropCellInput[],
  route: readonly HexCoord[],
  seed: string,
  projection: GridPropProjection = "course",
): readonly GridPropPlacement[] {
  const routeKeys = new Set(route.map(hexKey));
  const occupied = new Set<string>();
  const placements: GridPropPlacement[] = [];
  const worldRouteIndexes = new Set<number>();
  if (projection === "world" && route.length > 0) {
    worldRouteIndexes.add(0);
  }
  const worldTerritoryLimit = cells.length >= 28 ? 2 : 1;
  let worldTerritoryCount = 0;
  for (const cell of cells) {
    const cellKey = hexKey(cell.coord);
    if (occupied.has(cellKey) || cell.kind === "detached") continue;
    if (
      routeKeys.has(cellKey) &&
      cell.lessonIndex !== null &&
      cell.unitId !== null &&
      (projection === "course" || worldRouteIndexes.has(cell.lessonIndex))
    ) {
      placements.push({
        cellKey,
        coord: cell.coord,
        assetId: courseAssetForUnit(cell.unitId, seed, projection),
        kind: "course",
        lessonIndex: cell.lessonIndex,
        unitId: cell.unitId,
        rotation: hash(`${seed}/course-rotation/${cell.lessonIndex}`) * Math.PI * 2,
        scale:
          projection === "world"
            ? 0.34 + hash(`${seed}/course-scale/${cell.lessonIndex}`) * 0.1
            : 0.78 + hash(`${seed}/course-scale/${cell.lessonIndex}`) * 0.16,
      });
      occupied.add(cellKey);
      continue;
    }
    if (cell.kind !== "land") continue;
    if (projection === "world" && worldTerritoryCount >= worldTerritoryLimit) continue;
    // Leave a visibly clean shoulder beside the route. The farther a cell is
    // from the road, the more likely it receives a dressing prop; at the
    // plateau the world is still half empty, which keeps the silhouettes from
    // turning into a repeated hedge.
    const distanceFactor = Math.min(1, cell.distanceToRoute / 4);
    const density =
      projection === "world"
        ? 0.04 + 0.15 * distanceFactor ** 1.2
        : 0.08 + 0.34 * distanceFactor ** 1.2;
    if (hash(`${seed}/territory-density/${cellKey}`) >= density) continue;
    const assetId = territoryAssetForCell(cell, seed, projection);
    // A tree is a landmark, not a fence post. Leave roughly one empty cell
    // around tall silhouettes so a noisy edge cannot turn into a hedge; small
    // rocks, flowers and mushrooms may still punctuate that clearance.
    if (
      isTallSilhouette(assetId) &&
      placements.some(
        (placement) =>
          placement.kind === "territory" &&
          isTallSilhouette(placement.assetId) &&
          hexDistance(cell.coord, placement.coord) <= 2,
      )
    ) {
      continue;
    }
    placements.push(territoryPlacementForCell(cell, seed, projection));
    occupied.add(cellKey);
    worldTerritoryCount += projection === "world" ? 1 : 0;
  }

  if (projection === "course") {
    // A course field is a lived-in meadow, not a route floating on an empty
    // checkerboard. One semantic prop per non-detached cell is too noisy, but
    // eight logical placements per lesson keeps the reference's natural ring
    // present while leaving the route itself readable. The small Kenney
    // assets carry most of this fill; the shared spacing rule still controls
    // which cells receive a tall silhouette.
    const courseTarget = Math.min(
      cells.filter((cell) => cell.kind !== "detached").length,
      Math.max(route.length * 8, route.length),
    );
    if (placements.length < courseTarget) {
      const candidates = [...cells]
        .filter((cell) => cell.kind === "land" && !occupied.has(hexKey(cell.coord)))
        .sort(
          (first, second) =>
            second.distanceToRoute - first.distanceToRoute ||
            hash(`${seed}/territory-fill/${hexKey(first.coord)}`) -
              hash(`${seed}/territory-fill/${hexKey(second.coord)}`),
        );
      for (const cell of candidates) {
        if (placements.length >= courseTarget) break;
        const placement = territoryPlacementForCell(
          cell,
          seed,
          projection,
          `fill/${hexKey(cell.coord)}`,
          territoryFillAssetForCell(cell, seed),
          hash(`${seed}/territory-fill-visible/${hexKey(cell.coord)}`) < 0.18,
        );
        placements.push(placement);
        occupied.add(hexKey(cell.coord));
      }
    }
  }

  if (!placements.some((placement) => placement.kind === "territory")) {
    // A tiny course can legitimately have only a handful of land cells. Keep
    // that seed from becoming a sterile floating diagram without raising the
    // density for normal courses: one far-from-road punctuation prop is the
    // minimum visual vocabulary for a non-empty territory.
    const fallback = [...cells]
      .filter((cell) => cell.kind === "land" && !occupied.has(hexKey(cell.coord)))
      .sort(
        (first, second) =>
          second.distanceToRoute - first.distanceToRoute ||
          hash(`${seed}/territory-fallback/${hexKey(first.coord)}`) -
            hash(`${seed}/territory-fallback/${hexKey(second.coord)}`),
      )[0];
    if (fallback) {
      const cellKey = hexKey(fallback.coord);
      placements.push(territoryPlacementForCell(fallback, seed, projection, `fallback/${cellKey}`));
    }
  }
  return projection === "course"
    ? selectCourseVisiblePlacements(placements, route, seed)
    : placements;
}

export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return new Set(placements.map((placement) => placement.cellKey)).size === placements.length;
}

export function distanceToRoute(cell: HexCoord, route: readonly HexCoord[]): number {
  return Math.min(...route.map((entry) => hexDistance(cell, entry)));
}
