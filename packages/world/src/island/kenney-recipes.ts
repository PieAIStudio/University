/**
 * Curated Kenney catalog metadata and island recipes.
 *
 * The catalog is intentionally not a runtime asset manifest.  Kenney ships
 * 1,862 GLBs in the local donor; loading that whole directory would turn a
 * small island into an asset browser.  This file records the complete pack
 * inventory and the much smaller, art-directed recipes that a renderer may
 * request.  A recipe always has Nature as its shared base and one or two
 * physical accent packs.  A logical family label is descriptive only; it
 * cannot hide a third physical pack from the budget. Runtime availability is
 * resolved by the island asset registry, which can apply an explicit manifest
 * fallback while this catalog remains complete.
 */

import type { IslandThemeSelection } from "./island-blueprint.js";
import { hash } from "./random.js";

export const KENNEY_CATALOG_SCHEMA_VERSION = 1 as const;

export type KenneyPackId =
  | "castle-kit"
  | "fantasy-town-kit"
  | "graveyard-kit"
  | "holiday-kit"
  | "mini-arena"
  | "mini-dungeon"
  | "mini-forest"
  | "mini-skate"
  | "minigolf-kit"
  | "modular-cave-kit"
  | "modular-dungeon-kit"
  | "modular-space-kit"
  | "nature-kit"
  | "pirate-kit"
  | "platformer-kit"
  | "space-kit"
  | "space-station-kit"
  | "survival-kit"
  | "tower-defense-kit"
  | "watercraft-pack";

export type KenneyMaterialMode = "external-colormap" | "unlit-color";

export interface KenneyPackRecord {
  readonly id: KenneyPackId;
  readonly folder: string;
  readonly title: string;
  readonly version: string;
  readonly licenseSha256: string;
  readonly glbCount: number;
  readonly glbBytes: number;
  readonly materialMode: KenneyMaterialMode;
  readonly textureDependency: "none" | "Textures/colormap.png";
  readonly additionalCredits?: readonly string[];
}

/** All unique unpacked packs found under `_donors/Kenney`. */
interface KenneyPackRow {
  readonly id: KenneyPackId;
  readonly folder: string;
  readonly title: string;
  readonly version: string;
  readonly licenseSha256: string;
  readonly glbCount: number;
  readonly glbBytes: number;
  readonly materialMode: KenneyMaterialMode;
  readonly textureDependency: KenneyPackRecord["textureDependency"];
  readonly additionalCredits?: readonly string[];
}

const KENNEY_PACK_ROWS: readonly KenneyPackRow[] = [
  {
    id: "castle-kit",
    folder: "kenney_castle-kit",
    title: "Castle Kit",
    version: "2.0",
    licenseSha256: "aac944f18106b3a3e29c6fdeec02523d4cab4c735abc01f5a8fa88a79ae173ef",
    glbCount: 76,
    glbBytes: 2080872,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "fantasy-town-kit",
    folder: "kenney_fantasy-town-kit_2.0",
    title: "Fantasy Town Kit",
    version: "2.0",
    licenseSha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
    glbCount: 167,
    glbBytes: 2497400,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "graveyard-kit",
    folder: "kenney_graveyard-kit_5.0",
    title: "Graveyard Kit",
    version: "5.0",
    licenseSha256: "a48e274258386c6bcb5302f17eaab40304cd805cc68be2754e2452179418c70e",
    glbCount: 91,
    glbBytes: 3350032,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "holiday-kit",
    folder: "kenney_holiday-kit",
    title: "Holiday Kit",
    version: "2.0",
    licenseSha256: "6010f677d95f3ab7935faf873d8f4eb96ad1e5f02fd0e4659c9d92852b768d6a",
    glbCount: 99,
    glbBytes: 2751544,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "mini-arena",
    folder: "kenney_mini-arena",
    title: "Mini Arena",
    version: "1.1",
    licenseSha256: "f90537c9edc22b1e4cb65ae43ae9d784b2479a614b4bf75a7ea796822fe288e0",
    glbCount: 22,
    glbBytes: 510916,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
    additionalCredits: ["Tony Schär"],
  },
  {
    id: "mini-dungeon",
    folder: "kenney_mini-dungeon",
    title: "Mini Dungeon",
    version: "2.0",
    licenseSha256: "f8b470068a1c043854101c9ff7161d376ba02c36239da3c1dbdfa928b08444b6",
    glbCount: 30,
    glbBytes: 897568,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "mini-forest",
    folder: "kenney_mini-forest_1.0",
    title: "Mini Forest",
    version: "1.0",
    licenseSha256: "0629109f3ab090d569835d035c5a1f90fc0b76727bec28b128a5b4c1d35dd8c2",
    glbCount: 22,
    glbBytes: 838760,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "mini-skate",
    folder: "kenney_mini-skate",
    title: "Mini Skate",
    version: "1.2",
    licenseSha256: "6a075a1edb319f16d86cb6b9065436ce89dd851c234704ad160b4255b85e1b67",
    glbCount: 20,
    glbBytes: 566536,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "minigolf-kit",
    folder: "kenney_minigolf-kit",
    title: "Minigolf Kit",
    version: "3.1",
    licenseSha256: "1921de0377e3912e14fd2b9c76f92c530bd63794caabc3e411b97672d5a3951c",
    glbCount: 126,
    glbBytes: 1943700,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "modular-cave-kit",
    folder: "kenney_modular-cave-kit_1.0",
    title: "Modular Cave Kit",
    version: "1.0",
    licenseSha256: "0889f6cf5c972b42de634c2f1f8bec37d92e8d65acf28830afb159c04e3c6954",
    glbCount: 40,
    glbBytes: 6235348,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "modular-dungeon-kit",
    folder: "kenney_modular-dungeon-kit_1.0",
    title: "Modular Dungeon Kit",
    version: "2.1",
    licenseSha256: "41a49bdd304040502cabcedf73f27a1beeecc548c86f71822f288600d39d2601",
    glbCount: 39,
    glbBytes: 7403776,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "modular-space-kit",
    folder: "kenney_modular-space-kit_1.0",
    title: "Modular Space Kit",
    version: "1.0",
    licenseSha256: "38d94a4c79768cf5dc65e55b85f2dedd9f4bad35e325db1d0e5898fc1b7c5bbb",
    glbCount: 40,
    glbBytes: 8070500,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "nature-kit",
    folder: "kenney_nature-kit",
    title: "Nature Kit",
    version: "2.1",
    licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
    glbCount: 329,
    glbBytes: 3034380,
    materialMode: "unlit-color",
    textureDependency: "none",
  },
  {
    id: "pirate-kit",
    folder: "kenney_pirate-kit",
    title: "Pirate Kit",
    version: "2.1",
    licenseSha256: "5e99246a5a65fa3420a1a1c7a8616f096202c78866f73d7aacfe73c0aab0ca36",
    glbCount: 72,
    glbBytes: 3011576,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "platformer-kit",
    folder: "kenney_platformer-kit",
    title: "Platformer Kit",
    version: "4.1",
    licenseSha256: "e1185354d8f0f055c325c7204602326c8cf0c47ee5ae1db7ed16f0465b91bb9a",
    glbCount: 153,
    glbBytes: 3210960,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "space-kit",
    folder: "kenney_space-kit",
    title: "Space Kit",
    version: "2.0",
    licenseSha256: "bd4e050e69d41351282c4d53f943cd4d80a80b968593e60653ba5292637941b7",
    glbCount: 153,
    glbBytes: 2014920,
    materialMode: "unlit-color",
    textureDependency: "none",
  },
  {
    id: "space-station-kit",
    folder: "kenney_space-station-kit",
    title: "Space Station Kit",
    version: "1.0",
    licenseSha256: "e8de83b5cb2f01810e32f07691cb1dcf9494dc4a7f8cce0ec8175dfb8c5d98d9",
    glbCount: 97,
    glbBytes: 984788,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "survival-kit",
    folder: "kenney_survival-kit",
    title: "Survival Kit",
    version: "2.0",
    licenseSha256: "62c8356876481204fa4d40dc59183dfed777adf987d7f2a1390fffe8a699f3ff",
    glbCount: 80,
    glbBytes: 1298392,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "tower-defense-kit",
    folder: "kenney_tower-defense-kit",
    title: "Tower Defense Kit",
    version: "2.1",
    licenseSha256: "9f08295a8b8245eb9b82ace4226176a9bddb677638cdd564d21c554c4651720a",
    glbCount: 160,
    glbBytes: 5754580,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
  {
    id: "watercraft-pack",
    folder: "kenney_watercraft-pack",
    title: "Watercraft Pack",
    version: "2.1",
    licenseSha256: "f5f520f81277128fb422aebe334d2f08e6d8e5f7face6008885d8ff920253724",
    glbCount: 46,
    glbBytes: 1947372,
    materialMode: "external-colormap",
    textureDependency: "Textures/colormap.png",
  },
];

export const KENNEY_PACKS: readonly KenneyPackRecord[] = KENNEY_PACK_ROWS.map(
  (row): KenneyPackRecord => ({ ...row }),
);

export interface IslandRecipe {
  readonly id: string;
  readonly base: {
    readonly packId: "nature-kit";
    readonly roleIds: readonly string[];
    /** Exact reusable base assets; catalog presence does not imply runtime loading. */
    readonly assetIds: readonly string[];
    readonly proceduralTerrain: true;
  };
  readonly accentPackIds: readonly KenneyPackId[];
  readonly accentRoles: readonly {
    readonly packId: KenneyPackId;
    readonly assetIds: readonly string[];
    readonly visualWeight: "primary" | "secondary";
    readonly zone: "center" | "shore" | "rim" | "underside" | "distant";
  }[];
  readonly paletteId: string;
  readonly courseMood: string;
  readonly logicalFamily?: string;
  readonly candidateCharacters: readonly {
    readonly source: "shared-avatar" | "kenney";
    readonly assetIds: readonly string[];
    readonly role: "player" | "npc" | "mascot" | "drone";
  }[];
  readonly excluded: readonly { readonly packId: KenneyPackId; readonly reason: string }[];
  readonly rawGlbBudget: number;
}

export interface IslandRecipeRuntimeReference {
  readonly packId: KenneyPackId;
  readonly assetId: string;
  readonly source: "base" | "accent";
}

/**
 * Return only the asset IDs the island dressing renderer can load. Candidate
 * characters are catalog intent for a future avatar/NPC port, not dressing
 * references; including them here would pretend that the current scene owns
 * the character pipeline.
 */
export function islandRecipeRuntimeReferences(
  recipe: IslandRecipe,
): readonly IslandRecipeRuntimeReference[] {
  return [
    ...recipe.base.assetIds.map((assetId) => ({
      packId: recipe.base.packId,
      assetId,
      source: "base" as const,
    })),
    ...recipe.accentRoles.flatMap((role) =>
      role.assetIds.map((assetId) => ({
        packId: role.packId,
        assetId,
        source: "accent" as const,
      })),
    ),
  ];
}

const natureBase = {
  packId: "nature-kit" as const,
  roleIds: ["tree", "pine", "bush", "flower", "rock", "cliff"] as const,
  assetIds: [
    "tree_default",
    "tree_detailed",
    "tree_pineDefaultB",
    "rock_largeA",
    "rock_smallA",
    "plant_bushDetailed",
  ] as const,
  proceduralTerrain: true as const,
};

/**
 * The first twelve recipes are a coverage plan, not twelve simultaneous
 * downloads.  R01 is the first vertical slice and intentionally leaves the
 * second accent slot empty.
 */
export const KENNEY_ISLAND_RECIPES: readonly IslandRecipe[] = [
  {
    id: "R01-forest-academy",
    base: natureBase,
    accentPackIds: ["fantasy-town-kit"],
    accentRoles: [
      {
        packId: "fantasy-town-kit",
        assetIds: [
          "wall",
          "wall-corner",
          "wall-doorway-square",
          "roof",
          "roof-gable",
          "fountain-round",
          "stall",
          "lantern",
        ],
        visualWeight: "primary",
        zone: "center",
      },
    ],
    paletteId: "sunlit-meadow",
    courseMood: "基础 / 入门",
    candidateCharacters: [{ source: "shared-avatar", assetIds: [], role: "player" }],
    excluded: [
      { packId: "space-kit", reason: "留给独立星港岛，避免首岛风格跳变" },
      { packId: "modular-space-kit", reason: "留给独立星港岛，避免首岛风格跳变" },
      { packId: "pirate-kit", reason: "港口语义不属于首岛" },
      { packId: "watercraft-pack", reason: "港口语义不属于首岛" },
    ],
    // The route is baked into the procedural terrain; no Fantasy Town road
    // tile is loaded. Keeping the whitelist honest prevents a model strip
    // from quietly returning when this recipe is expanded.
    rawGlbBudget: 14,
  },
  {
    id: "R02-river-market",
    base: natureBase,
    accentPackIds: ["fantasy-town-kit", "watercraft-pack"],
    accentRoles: [
      {
        packId: "fantasy-town-kit",
        assetIds: ["stall", "cart", "watermill"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "watercraft-pack",
        assetIds: ["boat-house-a", "boat-row-small", "buoy", "cargo-container-a"],
        visualWeight: "secondary",
        zone: "shore",
      },
    ],
    paletteId: "river-market",
    courseMood: "沟通 / 现实案例",
    candidateCharacters: [{ source: "shared-avatar", assetIds: [], role: "player" }],
    excluded: [{ packId: "pirate-kit", reason: "海盗语义会抢走市集焦点" }],
    rawGlbBudget: 18,
  },
  {
    id: "R03-starport",
    base: natureBase,
    accentPackIds: ["space-kit", "modular-space-kit"],
    accentRoles: [
      {
        packId: "modular-space-kit",
        assetIds: ["gate", "corridor-intersection", "platform-large"],
        visualWeight: "primary",
        zone: "rim",
      },
      {
        packId: "space-kit",
        assetIds: ["satelliteDish_large", "machine_generatorLarge", "rover"],
        visualWeight: "secondary",
        zone: "underside",
      },
    ],
    paletteId: "cyan-orbit",
    courseMood: "系统 / 架构",
    logicalFamily: "sci-fi",
    candidateCharacters: [
      {
        source: "kenney",
        assetIds: ["astronautA", "astronautB", "alien", "rover"],
        role: "mascot",
      },
    ],
    excluded: [{ packId: "space-station-kit", reason: "轨道实验室使用" }],
    rawGlbBudget: 18,
  },
  {
    id: "R04-orbital-lab",
    base: natureBase,
    accentPackIds: ["space-station-kit", "modular-space-kit"],
    accentRoles: [
      {
        packId: "space-station-kit",
        assetIds: ["wall", "floor", "pipe"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "modular-space-kit",
        assetIds: ["room", "corridor", "gate-lasers"],
        visualWeight: "secondary",
        zone: "rim",
      },
    ],
    paletteId: "laboratory-blue",
    courseMood: "研究 / 阅读",
    logicalFamily: "sci-fi",
    candidateCharacters: [{ source: "shared-avatar", assetIds: [], role: "player" }],
    excluded: [{ packId: "space-kit", reason: "星港使用" }],
    rawGlbBudget: 16,
  },
  {
    id: "R05-border-observatory",
    base: natureBase,
    accentPackIds: ["tower-defense-kit", "space-kit"],
    accentRoles: [
      {
        packId: "tower-defense-kit",
        assetIds: ["tower", "detail-crystal"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "space-kit",
        assetIds: ["rover", "enemy-ufo-a", "enemy-ufo-b"],
        visualWeight: "secondary",
        zone: "distant",
      },
    ],
    paletteId: "watch-post",
    courseMood: "监控 / 调试",
    candidateCharacters: [
      { source: "kenney", assetIds: ["rover", "astronautA", "alien"], role: "drone" },
    ],
    excluded: [{ packId: "modular-space-kit", reason: "避免与星港结构重复" }],
    rawGlbBudget: 16,
  },
  {
    id: "R06-forest-fortress",
    base: natureBase,
    accentPackIds: ["castle-kit", "mini-forest"],
    accentRoles: [
      {
        packId: "castle-kit",
        assetIds: ["wall", "tower", "gate"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "mini-forest",
        assetIds: ["bridge", "tent", "character-archer"],
        visualWeight: "secondary",
        zone: "shore",
      },
    ],
    paletteId: "moss-fortress",
    courseMood: "规划 / 里程碑",
    candidateCharacters: [{ source: "kenney", assetIds: ["character-archer"], role: "npc" }],
    excluded: [{ packId: "fantasy-town-kit", reason: "避免与首岛人居锚点重复" }],
    rawGlbBudget: 18,
  },
  {
    id: "R07-training-arena",
    base: natureBase,
    accentPackIds: ["mini-arena", "platformer-kit"],
    accentRoles: [
      {
        packId: "mini-arena",
        assetIds: ["floor", "wall", "statue"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "platformer-kit",
        assetIds: ["platform", "marker"],
        visualWeight: "secondary",
        zone: "rim",
      },
    ],
    paletteId: "practice-coral",
    courseMood: "练习 / 反馈",
    candidateCharacters: [
      { source: "kenney", assetIds: ["character-soldier", "character-oobi"], role: "mascot" },
    ],
    excluded: [{ packId: "minigolf-kit", reason: "花园运动岛使用" }],
    rawGlbBudget: 16,
  },
  {
    id: "R08-ancient-cavern",
    base: natureBase,
    accentPackIds: ["modular-dungeon-kit", "mini-dungeon"],
    accentRoles: [
      {
        packId: "modular-dungeon-kit",
        assetIds: ["room", "corridor", "door"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "mini-dungeon",
        assetIds: ["torch", "chest", "character-human"],
        visualWeight: "secondary",
        zone: "distant",
      },
    ],
    paletteId: "deep-amber",
    courseMood: "深层基础 / 复杂性",
    candidateCharacters: [
      { source: "kenney", assetIds: ["character-human", "character-orc"], role: "npc" },
    ],
    excluded: [{ packId: "graveyard-kit", reason: "墓园洞窟使用" }],
    rawGlbBudget: 14,
  },
  {
    id: "R09-grave-cavern",
    base: natureBase,
    accentPackIds: ["graveyard-kit", "modular-cave-kit"],
    accentRoles: [
      {
        packId: "graveyard-kit",
        assetIds: ["crypt", "gravestone", "keeper"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "modular-cave-kit",
        assetIds: ["room", "gate-rock"],
        visualWeight: "secondary",
        zone: "rim",
      },
    ],
    paletteId: "violet-memory",
    courseMood: "回顾 / 记忆",
    candidateCharacters: [
      { source: "kenney", assetIds: ["character-keeper", "character-ghost"], role: "mascot" },
    ],
    excluded: [{ packId: "modular-dungeon-kit", reason: "古洞窟使用" }],
    rawGlbBudget: 14,
  },
  {
    id: "R10-bay-harbour",
    base: natureBase,
    accentPackIds: ["pirate-kit", "watercraft-pack"],
    accentRoles: [
      {
        packId: "pirate-kit",
        assetIds: ["dock", "tower", "ship"],
        visualWeight: "primary",
        zone: "shore",
      },
      {
        packId: "watercraft-pack",
        assetIds: ["boat-row-small", "cargo-container-a"],
        visualWeight: "secondary",
        zone: "distant",
      },
    ],
    paletteId: "harbour-teal",
    courseMood: "协作 / 交换",
    candidateCharacters: [{ source: "shared-avatar", assetIds: [], role: "player" }],
    excluded: [{ packId: "fantasy-town-kit", reason: "避免与河谷市集重复" }],
    rawGlbBudget: 16,
  },
  {
    id: "R11-snow-camp",
    base: natureBase,
    accentPackIds: ["holiday-kit", "survival-kit"],
    accentRoles: [
      {
        packId: "holiday-kit",
        assetIds: ["cabin", "snow", "lights"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "survival-kit",
        assetIds: ["tent", "campfire", "resource"],
        visualWeight: "secondary",
        zone: "shore",
      },
    ],
    paletteId: "winter-sun",
    courseMood: "季节性韧性 / 运营",
    candidateCharacters: [
      { source: "kenney", assetIds: ["snowman", "reindeer", "gingerbread"], role: "mascot" },
    ],
    excluded: [{ packId: "graveyard-kit", reason: "避免阴暗语义冲突" }],
    rawGlbBudget: 16,
  },
  {
    id: "R12-garden-sports",
    base: natureBase,
    accentPackIds: ["minigolf-kit", "mini-skate"],
    accentRoles: [
      {
        packId: "minigolf-kit",
        assetIds: ["spline", "ramp", "flag"],
        visualWeight: "primary",
        zone: "center",
      },
      {
        packId: "mini-skate",
        assetIds: ["rail", "half-pipe"],
        visualWeight: "secondary",
        zone: "rim",
      },
    ],
    paletteId: "garden-citrus",
    courseMood: "实验 / 安全失败",
    candidateCharacters: [
      {
        source: "kenney",
        assetIds: ["character-skate-boy", "character-skate-girl"],
        role: "mascot",
      },
    ],
    excluded: [{ packId: "platformer-kit", reason: "竞技训练场使用" }],
    rawGlbBudget: 16,
  },
];

export interface IslandRecipeValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/** Runtime guard used by authoring and tests before a recipe reaches a loader. */
export function validateIslandRecipe(recipe: IslandRecipe): IslandRecipeValidation {
  const errors: string[] = [];
  if (recipe.base.packId !== "nature-kit") errors.push("base.packId must be nature-kit");
  if (recipe.base.proceduralTerrain !== true) errors.push("base.proceduralTerrain must be true");
  if (recipe.base.assetIds.length === 0) errors.push("base.assetIds must not be empty");
  if (new Set(recipe.base.assetIds).size !== recipe.base.assetIds.length) {
    errors.push("base.assetIds must be unique");
  }
  if (recipe.accentPackIds.length < 1 || recipe.accentPackIds.length > 2) {
    errors.push("accentPackIds must contain one or two physical packs");
  }
  if (new Set(recipe.accentPackIds).size !== recipe.accentPackIds.length) {
    errors.push("accentPackIds must be unique");
  }
  if (recipe.accentPackIds.includes("nature-kit")) {
    errors.push("nature-kit is a base pack, not an accent pack");
  }
  const known = new Set(KENNEY_PACKS.map((pack) => pack.id));
  for (const packId of recipe.accentPackIds) {
    if (!known.has(packId)) errors.push(`unknown accent pack: ${packId}`);
  }
  for (const role of recipe.accentRoles) {
    if (!recipe.accentPackIds.includes(role.packId)) {
      errors.push(`accent role ${role.assetIds.join(",")} uses an unselected pack`);
    }
    if (role.assetIds.length === 0) errors.push(`accent role for ${role.packId} has no assets`);
  }
  for (const packId of recipe.accentPackIds) {
    if (!recipe.accentRoles.some((role) => role.packId === packId)) {
      errors.push(`selected accent pack ${packId} has no role`);
    }
  }
  const selectedAssets = new Set([
    ...recipe.base.assetIds,
    ...recipe.accentRoles.flatMap((role) => role.assetIds),
  ]);
  if (!Number.isInteger(recipe.rawGlbBudget) || recipe.rawGlbBudget < 1) {
    errors.push("rawGlbBudget must be a positive integer");
  } else if (selectedAssets.size > recipe.rawGlbBudget) {
    errors.push(`recipe selects ${selectedAssets.size} assets over budget ${recipe.rawGlbBudget}`);
  }
  return { ok: errors.length === 0, errors };
}

export function recipeById(id: string): IslandRecipe | undefined {
  return KENNEY_ISLAND_RECIPES.find((recipe) => recipe.id === id);
}

export interface KenneyCoverageEntry {
  readonly packId: KenneyPackId;
  readonly recipeIds: readonly string[];
  readonly selectedAssetIds: readonly string[];
  readonly selectedCount: number;
  readonly totalGlbCount: number;
  readonly coverageRatio: number;
  /** `represented` is a plan; `validated` means its exact source files were inspected. */
  readonly status: "unseen" | "represented" | "validated" | "deferred";
  readonly licenseSha256: string;
}

/**
 * Product-wide coverage ledger. It proves every physical pack has somewhere
 * coherent to go without pretending that every near-duplicate GLB must load.
 */
export const KENNEY_COVERAGE_LEDGER: readonly KenneyCoverageEntry[] = KENNEY_PACKS.map((pack) => {
  const recipeIds: string[] = [];
  const selected = new Set<string>();
  for (const recipe of KENNEY_ISLAND_RECIPES) {
    if (pack.id === recipe.base.packId) {
      recipeIds.push(recipe.id);
      recipe.base.assetIds.forEach((assetId) => selected.add(assetId));
    }
    if (recipe.accentPackIds.includes(pack.id)) {
      recipeIds.push(recipe.id);
      recipe.accentRoles
        .filter((role) => role.packId === pack.id)
        .flatMap((role) => role.assetIds)
        .forEach((assetId) => selected.add(assetId));
    }
  }
  const selectedAssetIds = [...selected].sort();
  return {
    packId: pack.id,
    recipeIds: [...new Set(recipeIds)],
    selectedAssetIds,
    selectedCount: selectedAssetIds.length,
    totalGlbCount: pack.glbCount,
    coverageRatio: selectedAssetIds.length / pack.glbCount,
    status:
      pack.id === "nature-kit" || pack.id === "fantasy-town-kit"
        ? "validated"
        : recipeIds.length > 0
          ? "represented"
          : "unseen",
    licenseSha256: pack.licenseSha256,
  };
});

/**
 * Art direction is data, never a renderer branch. A course can be explicitly
 * curated here; uncurated courses receive a stable recipe from their identity
 * so the catalogue becomes varied without layout changing after a prose edit.
 */
export const ISLAND_RECIPE_ASSIGNMENTS: Readonly<Record<string, string>> = {
  "turing-pact/foundations-before-zero": "R01-forest-academy",
};

export function islandThemeSelectionForCourse(
  studyId: string,
  courseId: string,
): IslandThemeSelection {
  const key = `${studyId}/${courseId}`;
  const explicit = ISLAND_RECIPE_ASSIGNMENTS[key];
  const recipe = explicit
    ? recipeById(explicit)
    : KENNEY_ISLAND_RECIPES[
        Math.floor(hash(`${key}/island-recipe`) * KENNEY_ISLAND_RECIPES.length)
      ];
  if (!recipe) throw new Error(`Island recipe assignment ${explicit ?? key} is missing`);
  return {
    naturalBasePackId: recipe.base.packId,
    accentPackIds: recipe.accentPackIds,
    recipeId: recipe.id,
  };
}
