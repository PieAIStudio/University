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
  const assets: readonly GridPropAssetId[] = [
    "plant_bushLarge",
    "mushroom_redGroup",
    "flower_yellowA",
    "rock_largeA",
    "stump_round",
  ];
  return assets[Math.floor(hash(`${seed}/territory-prop/${hexKey(cell.coord)}`) * assets.length)]!;
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
    // Leave a clean shoulder beside the route. The farther a cell is from the
    // road, the more likely it receives a small dressing prop.
    const density = 0.16 + 0.31 * Math.min(1, cell.distanceToRoute / 4);
    if (hash(`${seed}/territory-density/${cellKey}`) >= density) continue;
    placements.push({
      cellKey,
      coord: cell.coord,
      assetId: territoryAssetForCell(cell, seed),
      kind: "territory",
      lessonIndex: null,
      unitId: null,
      rotation: hash(`${seed}/territory-rotation/${cellKey}`) * Math.PI * 2,
      scale: 0.42 + hash(`${seed}/territory-scale/${cellKey}`) * 0.2,
    });
    occupied.add(cellKey);
  }
  return placements;
}

export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return new Set(placements.map((placement) => placement.cellKey)).size === placements.length;
}

export function distanceToRoute(cell: HexCoord, route: readonly HexCoord[]): number {
  return Math.min(...route.map((entry) => hexDistance(cell, entry)));
}
