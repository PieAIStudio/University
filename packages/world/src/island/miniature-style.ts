/** Named distant art direction, keyed by the existing authored recipe, never progress. */
import type { IslandBlueprint } from "./island-blueprint.js";
import type { MiniatureAssetKind } from "./miniature-assets.js";

export interface MiniatureStyle {
  readonly id: string;
  readonly tree: MiniatureAssetKind;
  readonly focal: MiniatureAssetKind;
  readonly water: "pond" | "cascade" | null;
  readonly flowers: boolean;
  readonly meadow: number;
  readonly shade: number;
}

const styles = {
  garden: {
    id: "garden",
    tree: "fir",
    focal: "fence",
    water: null,
    flowers: true,
    meadow: 0x96c84f,
    shade: 0x70a246,
  },
  lagoon: {
    id: "lagoon",
    tree: "broadleaf",
    focal: "fence",
    water: "pond",
    flowers: true,
    meadow: 0xa8cd60,
    shade: 0x78a34b,
  },
  crystal: {
    id: "crystal",
    tree: "fir",
    focal: "crystal",
    water: null,
    flowers: false,
    meadow: 0xafd56a,
    shade: 0x7da658,
  },
  windmill: {
    id: "windmill",
    tree: "fir",
    focal: "windmill",
    water: null,
    flowers: true,
    meadow: 0xb4d26a,
    shade: 0x8baa4c,
  },
  grove: {
    id: "grove",
    tree: "fir",
    focal: "stone",
    water: "cascade",
    flowers: true,
    meadow: 0xa3ca5c,
    shade: 0x76a149,
  },
  autumn: {
    id: "autumn",
    tree: "autumn",
    focal: "stone",
    water: null,
    flowers: false,
    meadow: 0xe5c46a,
    shade: 0xc3a35a,
  },
  ruins: {
    id: "ruins",
    tree: "fir",
    focal: "ruin",
    water: null,
    flowers: false,
    meadow: 0xafc977,
    shade: 0x839d55,
  },
  alpine: {
    id: "alpine",
    tree: "fir",
    focal: "snowpeak",
    water: null,
    flowers: false,
    meadow: 0xe1ecdd,
    shade: 0xa4c5c2,
  },
  blossom: {
    id: "blossom",
    tree: "blossom",
    focal: "gate",
    water: null,
    flowers: true,
    meadow: 0xb8d475,
    shade: 0x8fad52,
  },
} as const satisfies Record<string, MiniatureStyle>;

export const MINIATURE_STYLES: readonly MiniatureStyle[] = Object.values(styles);

const BY_RECIPE: Readonly<Record<string, keyof typeof styles>> = {
  "R01-forest-academy": "garden",
  "R02-river-market": "lagoon",
  "R03-starport": "crystal",
  "R04-orbital-lab": "windmill",
  "R05-border-observatory": "crystal",
  "R06-forest-fortress": "grove",
  "R07-training-arena": "autumn",
  "R08-ancient-cavern": "ruins",
  "R09-grave-cavern": "ruins",
  "R10-bay-harbour": "lagoon",
  "R11-snow-camp": "alpine",
  "R12-garden-sports": "blossom",
};

export function miniatureStyleFor(blueprint: IslandBlueprint): MiniatureStyle {
  return styles[BY_RECIPE[blueprint.themeSelection.recipeId ?? ""] ?? "garden"];
}
