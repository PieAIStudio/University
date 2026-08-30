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
  // turn one arm into a repeated line of tiny red caps.
  if (roll < 0.18) return "tree_pineRoundA";
  if (roll < 0.34) return "tree_oak";
  if (roll < 0.44) return "tree_simple";
  if (roll < 0.59) return "plant_bushLarge";
  if (roll < 0.69) return "rock_largeA";
  if (roll < 0.77) return "rock_smallA";
  if (roll < 0.85) return "flower_yellowA";
  if (roll < 0.93) return "mushroom_redGroup";
  return "stump_round";
}

function isTallSilhouette(assetId: GridPropAssetId): boolean {
  return assetId.startsWith("tree_") || assetId === "plant_bushLarge";
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
    placements.push({
      cellKey,
      coord: cell.coord,
      assetId,
      kind: "territory",
      lessonIndex: null,
      unitId: null,
      rotation: hash(`${seed}/territory-rotation/${cellKey}`) * Math.PI * 2,
      scale:
        projection === "world"
          ? 0.28 + hash(`${seed}/territory-scale/${cellKey}`) * 0.1
          : 0.48 + hash(`${seed}/territory-scale/${cellKey}`) * 0.24,
    });
    occupied.add(cellKey);
    worldTerritoryCount += projection === "world" ? 1 : 0;
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
      placements.push({
        cellKey,
        coord: fallback.coord,
        assetId: territoryAssetForCell(fallback, seed, projection),
        kind: "territory",
        lessonIndex: null,
        unitId: null,
        rotation: hash(`${seed}/territory-fallback-rotation/${cellKey}`) * Math.PI * 2,
        scale:
          projection === "world"
            ? 0.28 + hash(`${seed}/territory-fallback-scale/${cellKey}`) * 0.1
            : 0.48 + hash(`${seed}/territory-fallback-scale/${cellKey}`) * 0.24,
      });
    }
  }
  return placements;
}

export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return new Set(placements.map((placement) => placement.cellKey)).size === placements.length;
}

export function distanceToRoute(cell: HexCoord, route: readonly HexCoord[]): number {
  return Math.min(...route.map((entry) => hexDistance(cell, entry)));
}
