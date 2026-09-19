/** Actual map sources, not look-alike demo assets. No global overrides. */
import { resolveIslandRuntimeAssetFromRecipe } from "../island/island-asset-registry.js";

export const FINISH_IDS = ["original", "sculpted", "bevel", "crafted"] as const;
export type PropFinish = (typeof FINISH_IDS)[number];
export const PROP_IDS = [
  "rock-large",
  "rock-small",
  "fir",
  "broadleaf",
  "stall",
  "cart",
  "lantern",
  "fountain",
  "doorway",
  "roof",
] as const;
export type PropId = (typeof PROP_IDS)[number];
export interface PropSample {
  readonly id: PropId;
  readonly source: string;
  readonly consumer: string;
  readonly src?: string;
  readonly tree?: "fir" | "broadleaf";
  readonly miniature?: "stone";
  readonly preserveMap?: boolean;
  readonly materialKey?: string;
  readonly height: number;
  readonly bevel: number;
  readonly aoDistance: number;
}
function kenney(
  id: PropId,
  pack: "nature-kit" | "fantasy-town-kit",
  asset: string,
  height: number,
  bevel = 0.012,
): PropSample {
  const source = resolveIslandRuntimeAssetFromRecipe(pack, asset);
  if (!source || source.usedFallback)
    throw new Error(`Comparison source missing: ${pack}/${asset}`);
  return {
    id,
    source: `${pack}/${asset}`,
    consumer: "island-dressing.ts → AssetField",
    src: source.src,
    preserveMap: pack !== "nature-kit",
    materialKey: `${pack}/${asset}`,
    height,
    bevel,
    aoDistance: 0.35,
  };
}
export const PROP_SAMPLES: readonly PropSample[] = [
  kenney("rock-large", "nature-kit", "rock_largeA", 1.25, 0.028),
  {
    id: "rock-small",
    source: "createMiniatureAsset(stone)",
    consumer: "RemotePropsField / CourseLandscape stone source",
    miniature: "stone",
    height: 1.15,
    bevel: 0.02,
    aoDistance: 0.35,
  },
  {
    id: "fir",
    source: "createMiniatureAsset(fir, course)",
    consumer: "CourseTreeField / IslandFoliage",
    tree: "fir",
    height: 1.9,
    bevel: 0.008,
    aoDistance: 0.4,
  },
  {
    id: "broadleaf",
    source: "createMiniatureAsset(broadleaf, course)",
    consumer: "CourseTreeField / IslandFoliage",
    tree: "broadleaf",
    height: 1.7,
    bevel: 0.008,
    aoDistance: 0.4,
  },
  kenney("stall", "fantasy-town-kit", "stall", 1.45, 0.009),
  kenney("cart", "fantasy-town-kit", "cart", 1.1, 0.008),
  kenney("lantern", "fantasy-town-kit", "lantern", 1.5, 0.01),
  kenney("fountain", "fantasy-town-kit", "fountain-round", 0.95, 0.015),
  kenney("doorway", "fantasy-town-kit", "wall-doorway-square", 1.55, 0.012),
  kenney("roof", "fantasy-town-kit", "roof-gable", 1.3, 0.012),
];
export function parsePropId(value: string | null): PropId {
  return PROP_IDS.find((id) => id === value) ?? "rock-small";
}
export function parsePropFinish(value: string | null): PropFinish {
  return FINISH_IDS.find((id) => id === value) ?? "sculpted";
}
