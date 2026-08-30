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

function courseAssetForUnit(unitId: string, seed: string): GridPropAssetId {
  const courseAssets: readonly GridPropAssetId[] = [
    "tree_pineRoundA",
    "tree_oak",
    "tree_simple",
    "plant_bushLarge",
    "mushroom_redGroup",
    "rock_largeA",
  ];
  return courseAssets[Math.floor(hash(`${seed}/unit-prop/${unitId}`) * courseAssets.length)]!;
}

function territoryAssetForCell(cell: GridPropCellInput, seed: string): GridPropAssetId {
  const roll = hash(`${seed}/territory-prop/${hexKey(cell.coord)}`);
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

export function gridPropsFor(
  cells: readonly GridPropCellInput[],
  route: readonly HexCoord[],
  seed: string,
): readonly GridPropPlacement[] {
  const routeKeys = new Set(route.map(hexKey));
  const occupied = new Set<string>();
  const placements: GridPropPlacement[] = [];
  for (const cell of cells) {
    const cellKey = hexKey(cell.coord);
    if (occupied.has(cellKey) || cell.kind === "detached") continue;
    if (routeKeys.has(cellKey) && cell.lessonIndex !== null && cell.unitId !== null) {
      placements.push({
        cellKey,
        coord: cell.coord,
        assetId: courseAssetForUnit(cell.unitId, seed),
        kind: "course",
        lessonIndex: cell.lessonIndex,
        unitId: cell.unitId,
        rotation: hash(`${seed}/course-rotation/${cell.lessonIndex}`) * Math.PI * 2,
        scale: 0.78 + hash(`${seed}/course-scale/${cell.lessonIndex}`) * 0.16,
      });
      occupied.add(cellKey);
      continue;
    }
    if (cell.kind !== "land") continue;
    // Leave a visibly clean shoulder beside the route. The farther a cell is
    // from the road, the more likely it receives a dressing prop; at the
    // plateau the world is still half empty, which keeps the silhouettes from
    // turning into a repeated hedge.
    const distanceFactor = Math.min(1, cell.distanceToRoute / 4);
    const density = 0.18 + 0.46 * distanceFactor ** 1.2;
    if (hash(`${seed}/territory-density/${cellKey}`) >= density) continue;
    placements.push({
      cellKey,
      coord: cell.coord,
      assetId: territoryAssetForCell(cell, seed),
      kind: "territory",
      lessonIndex: null,
      unitId: null,
      rotation: hash(`${seed}/territory-rotation/${cellKey}`) * Math.PI * 2,
      scale: 0.48 + hash(`${seed}/territory-scale/${cellKey}`) * 0.24,
    });
    occupied.add(cellKey);
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
        assetId: territoryAssetForCell(fallback, seed),
        kind: "territory",
        lessonIndex: null,
        unitId: null,
        rotation: hash(`${seed}/territory-fallback-rotation/${cellKey}`) * Math.PI * 2,
        scale: 0.48 + hash(`${seed}/territory-fallback-scale/${cellKey}`) * 0.24,
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
