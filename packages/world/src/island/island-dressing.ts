/**
 * Deterministic, renderer-free dressing for an IslandBlueprint.
 *
 * A catalog says what *may* appear. This planner decides what earns a place in
 * the composition. It builds one full course plan, then the world projection
 * removes low-importance detail; it never rolls a second island.
 */
import { sampleIslandSurface, type IslandBlueprint, type IslandPoint } from "./island-blueprint.js";
import { planCourseSpring, overlapsCourseSpring, type CourseSpring } from "./course-spring-plan.js";
import { islandTerrainFootprintRange, sampleIslandTerrainTop } from "./island-geometry.js";
import {
  foliageFootprintRadius,
  bushGroundOffsets,
  COURSE_TREE_ROOT_RADIUS_RATIO,
} from "./foliage-geometry.js";
import { foliageTintAt } from "./foliage-tone.js";
import { courseTreeIsFir, courseTreeEnvelopesClear } from "./course-tree-envelope.js";
import { uplandGroves } from "./course-upland-groves.js";
import {
  islandFieldFor,
  sampleIslandField,
  type IslandField,
  type IslandFieldSample,
} from "./island-field.js";
import {
  recipeById,
  validateIslandRecipe,
  type IslandRecipe,
  type IslandNaturalAssetRef,
  type KenneyPackId,
} from "./kenney-recipes.js";
import {
  resolveIslandRuntimeAssetFromRecipe,
  type IslandAssetPackId,
} from "./island-asset-registry.js";
import { hash, seeded } from "./random.js";
import {
  BORDER_ROCK_TIERS,
  BRIDGE_FRACTIONS,
  borderRockClusterCentres,
  footprintSamplePoints,
  occupiedFromPlacements,
  orientedFootprintFor,
  searchAcademyPlacement,
  searchBridgePlacement,
  searchCampPlacement,
  sourceExtentFor,
  worldSizeForAsset,
  type AssemblyContext,
  type AssemblyKind,
  type AssemblySearchReport,
} from "./island-composition.js";
import {
  distanceToIslandRoute,
  islandRouteClearance,
  islandRouteFrameAtFraction,
} from "./island-route-geometry.js";

export { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import {
  planCourseOutcrops,
  landscapeFootprint,
  type CourseOutcrop,
} from "./course-outcrop-plan.js";

export type IslandDressingDetail = "course" | "world";
export type IslandDressingKind = "tree" | "bush" | "rock" | "landmark" | "prop";
export type IslandDressingSegment = "arrival" | "journey" | "summit";
export type IslandOutpostKind =
  | "camp"
  | "bridge"
  | "stone-ring"
  | "market"
  | "lantern-plaza"
  | "grove";

export interface IslandDressingPlacement extends IslandPoint {
  readonly id: string;
  readonly packId: IslandAssetPackId;
  readonly assetId: string;
  readonly kind: IslandDressingKind;
  /** Authored beat along the single route, when the placement is a landmark accent. */
  readonly segment?: IslandDressingSegment;
  /** Shared identifier for the small group that gives an outpost its sense of place. */
  readonly outpostId?: string;
  readonly outpostKind?: IslandOutpostKind;
  readonly y: number;
  /** Optional authored lift above the sampled surface, used for stacks and paths. */
  readonly lift?: number;
  readonly turn: number;
  /** Target height in unscaled blueprint units; the asset adapter normalises GLBs. */
  readonly height: number;
  /** Semantic LOD, not a camera-distance guess. */
  readonly importance: number;
  /** Visual semantic state (e.g., campfire "lit" | "idle") for downstream effect renderer. */
  readonly state?: "lit" | "idle";
  /** Semantic assembly identity for all-or-none grouped parts. */
  readonly assemblyId?: string;
  readonly companionOf?: string;
  readonly clusterId?: string;
  /** A shared-field colour for the whole grove/verge, not a per-tree dice roll. */
  readonly foliageTint?: number;
  readonly foliageShapeSeed?: string;
  /** Per-lobe downward ground contact, in unscaled blueprint units. */
  readonly foliageGroundOffsets?: readonly number[];
  /** Complete-tree root cut below its full, actually sampled support disk. */
  readonly foliageRootOffset?: number;
}

export interface IslandCompositionDecision extends AssemblySearchReport {
  /** What the learner actually receives when this assembly could not fit. */
  readonly fallback?: "stone-rest-clearing" | "natural-summit" | "open-meadow";
}

export interface IslandDressingPlan {
  readonly landscape?: {
    readonly outcrops: readonly CourseOutcrop[];
    readonly spring?: CourseSpring | null;
    readonly search: Readonly<Record<string, number>>;
  };
  readonly version: 1;
  readonly detail: IslandDressingDetail;
  readonly seed: string;
  readonly recipeId: string | null;
  readonly placements: readonly IslandDressingPlacement[];
  readonly decisions?: readonly IslandCompositionDecision[];
}

export interface IslandDressingSafetyZone extends IslandPoint {
  /** A conservative ground apron in unscaled blueprint units. */
  readonly radius: number;
  readonly kind: "landmark";
}

interface CandidateRule {
  readonly assetRole: "tree" | "bush" | "rock";
  readonly kind: IslandDressingKind;
  readonly count: number;
  readonly minSpacing: number;
  readonly radial: readonly [number, number];
  readonly height: readonly [number, number];
  readonly importance: readonly [number, number];
  readonly maxSlope: number;
  readonly clustered: boolean;
  /**
   * Positive draws the rule toward steep ground and negative toward flat.
   * It is applied as rejection sampling on top of `maxSlope`, so it biases
   * where a kind settles without ever placing one outside its ceiling.
   */
  readonly prefersSlope?: number;
  readonly clusterRadius?: number;
  readonly vegetationBand?: "grove" | "verge";
}

interface AccentSlot {
  /** Overrides the layout's default route beat for a split modular set. */
  readonly segment?: IslandDressingSegment;
  /** Offset along the local courtyard tangent from the composition anchor. */
  readonly along: number;
  /** Offset away from the course route from the composition anchor. */
  readonly away: number;
  readonly turn: number;
  /** Vertical offset above the sampled surface for a stacked or path asset. */
  readonly lift?: number;
}

interface AccentLayout {
  readonly segment: IslandDressingSegment;
  readonly kind: IslandDressingKind;
  readonly height: number;
  readonly importance: number;
  readonly slots: readonly AccentSlot[];
}

interface OutpostPart {
  readonly packId: IslandAssetPackId;
  readonly assetId: string;
  readonly kind: IslandDressingKind;
  readonly along: number;
  readonly away: number;
  readonly height: number;
  readonly importance: number;
  readonly turnOffset?: number;
  readonly headingAxis?: "x" | "z";
  readonly lift?: number;
  readonly state?: "lit" | "idle";
}

interface OutpostLayout {
  readonly id: string;
  readonly kind: IslandOutpostKind;
  readonly segment: IslandDressingSegment;
  /** Fraction of the authored route, independent of lesson or unit count. */
  readonly fraction: number;
  readonly parts: (recipe: IslandRecipe) => readonly OutpostPart[];
}

const ELEMENTAL_SERENITY_PACK = "elemental-serenity" as const;

type SceneryBand = "short" | "medium" | "long";

/** Lesson-length scenery budget. Short courses keep camp/path, not the long-course set. */
const SCENERY_BAND = {
  short: { outposts: 2, treesPerGrove: 2, quota: 0.4 },
  medium: { outposts: 3, treesPerGrove: 8, quota: 0.72 },
  long: { outposts: 4, treesPerGrove: 8, quota: 1 },
} as const;

export function sceneryBandForLessonCount(lessonCount: number): SceneryBand {
  if (lessonCount <= 8) return "short";
  if (lessonCount <= 24) return "medium";
  return "long";
}

/**
 * Vegetation counts, and why they are what they are.
 *
 * Capacity is not a quota. Tree crowns form a few separated groves, bushes
 * occupy their understorey, and headland rocks have their own size hierarchy.
 * Filling an annulus until a per-lesson decoration count passed made an
 * unbroken hedge and obscured the route after the crowns became real volumes.
 *
 * The slope ceilings also had to move. The terrain used to hold a median
 * slope near six degrees, so a tree ceiling of 0.54 rejected nothing; on the
 * relief the island carries now it would refuse about a third of the ground.
 * Rather than raise every ceiling to the same number, each rule states the
 * slope it prefers, so trees settle on the shoulders and flats, rock gathers
 * where the ground is too steep to hold soil, and neither has to be placed by
 * hand. Authored facilities and the entire crown footprint keep a clear apron.
 */
export const COURSE_GROVE_LEADER_HEIGHT = 5.15;
const NATURAL_RULES: readonly CandidateRule[] = [
  {
    assetRole: "tree",
    kind: "tree",
    count: 56,
    minSpacing: 1.35,
    radial: [0.68, 0.97],
    height: [2.35, COURSE_GROVE_LEADER_HEIGHT],
    importance: [0.62, 0.92],
    maxSlope: 0.88,
    clustered: true,
    clusterRadius: 4.6,
    vegetationBand: "grove",
    prefersSlope: -0.7,
  },
  {
    assetRole: "bush",
    kind: "bush",
    // Low understorey stays with the groves. The separate verge rule below
    // supplies the route rhythm without moving these shrubs onto the road.
    count: 68,
    minSpacing: 0.58,
    radial: [0.52, 0.92],
    // A visible middle storey, not more tiny crumbs between tall crowns.
    height: [0.95, 1.45],
    importance: [0.3, 0.58],
    maxSlope: 1.05,
    clustered: true,
    clusterRadius: 4.8,
    vegetationBand: "grove",
    prefersSlope: -0.25,
  },
  {
    assetRole: "bush",
    kind: "bush",
    count: 28,
    minSpacing: 0.58,
    radial: [0.52, 0.92],
    height: [0.35, 0.5],
    importance: [0.42, 0.62],
    maxSlope: 1.05,
    clustered: true,
    clusterRadius: 1.65,
    vegetationBand: "verge",
    prefersSlope: -0.25,
  },
  // 3-tier size hierarchy for border rocks: large anchors, medium cluster
  // stones, and small satellites. Cluster radius keeps hierarchy around
  // rocky headlands instead of a bollard ring.
  ...BORDER_ROCK_TIERS.map((tier) => ({
    assetRole: "rock" as const,
    kind: "rock" as const,
    count: tier.count,
    minSpacing: tier.minSpacing,
    radial: tier.radial,
    height: tier.height,
    importance: tier.importance,
    maxSlope: tier.maxSlope,
    clustered: tier.clustered,
    prefersSlope: tier.prefersSlope,
    clusterRadius: tier.clusterRadius,
  })),
] as const;

/**
 * Route-side Kenney accents that are not a rigid building. The academy
 * walls/roofs are one assembly in island-composition.ts; duplicating them
 * here was how a precheck plus per-part filter left orphan doors and roofs.
 */
const ACCENT_LAYOUT: Readonly<Record<string, AccentLayout>> = {
  "fountain-round": {
    segment: "journey",
    kind: "landmark",
    // Raw fountain proportions are 2 x 0.28 x 2. A 0.56 target height keeps
    // its normalised footprint close to a small 4m plaza feature.
    height: 0.56,
    importance: 0.98,
    slots: [{ along: 0, away: 0.75, turn: 0 }],
  },
};

function recipeAccentAsset(
  recipe: IslandRecipe,
  hints: readonly string[],
): { readonly packId: KenneyPackId; readonly assetId: string } | null {
  const candidates = recipe.accentRoles
    .flatMap((role) => role.assetIds.map((assetId) => ({ packId: role.packId, assetId })))
    .filter(({ packId, assetId }) => {
      const resolved = resolveIslandRuntimeAssetFromRecipe(packId, assetId);
      return (
        resolved &&
        !resolved.usedFallback &&
        !/^(wall|roof|floor|platform|gate|room)(?:[-_]|$)/u.test(resolved.assetId)
      );
    });
  if (candidates.length === 0) return null;
  for (const hint of hints) {
    const match = candidates.find(({ assetId }) => assetId.toLowerCase().includes(hint));
    if (match) return match;
  }
  // A catalogue alias is not a physical asset with the requested proportions
  // or purpose. A crystal mapped to a flat fountain became an eight-metre
  // pool when given a crystal's height. Do not invent a substitute just to
  // fill an outpost: the natural plan remains a complete, usable landscape.
  return null;
}

function donorOutpostPart(
  assetId: string,
  kind: IslandDressingKind,
  along: number,
  away: number,
  height: number,
  importance: number,
  extras: Pick<OutpostPart, "turnOffset" | "headingAxis" | "lift" | "state"> = {},
): OutpostPart {
  return {
    packId: ELEMENTAL_SERENITY_PACK,
    assetId,
    kind,
    along,
    away,
    height,
    importance,
    ...extras,
  };
}

function recipeOutpostPart(
  recipe: IslandRecipe,
  hints: readonly string[],
  kind: IslandDressingKind,
  along: number,
  away: number,
  height: number,
  importance: number,
): OutpostPart | null {
  const asset = recipeAccentAsset(recipe, hints);
  if (!asset) return null;
  return { ...asset, kind, along, away, height, importance };
}

function stoneOutpostPart(
  kind: IslandDressingKind,
  along: number,
  away: number,
  height: number,
  importance: number,
  turnOffset = 0,
): OutpostPart {
  return {
    packId: "nature-kit",
    assetId: kind === "landmark" ? "rock_largeA" : "rock_smallA",
    kind,
    along,
    away,
    height,
    importance,
    turnOffset,
  };
}

/**
 * Route-side compositions are deliberately small and semantic. The first
 * four are guaranteed attempts on every island; two optional compositions
 * make the route feel less templated while remaining seed-driven. The donor
 * set is isolated here: all eight files are registered, while grass_blade is
 * intentionally left for the grass lane owned by the other worktree.
 */
const OUTPOST_LAYOUTS: readonly OutpostLayout[] = [
  {
    id: "water-stone-ring",
    kind: "stone-ring",
    segment: "journey",
    fraction: 0.52,
    parts: () => [
      stoneOutpostPart("landmark", 0, 0, 0.7, 0.91),
      stoneOutpostPart("prop", -1.15, 0.36, 0.38, 0.66, 0.7),
      donorOutpostPart("bushEmitter", "prop", 1.25, 0.48, 0.52, 0.63, { turnOffset: -0.4 }),
      donorOutpostPart("treeTrunks", "prop", 0.35, -1.2, 0.88, 0.71, { turnOffset: 0.24 }),
    ],
  },
  {
    id: "route-market",
    kind: "market",
    segment: "summit",
    fraction: 0.74,
    parts: (recipe) => {
      const parts: OutpostPart[] = [];
      const stall = recipeOutpostPart(
        recipe,
        [
          "stall",
          "market",
          "cart",
          "dock",
          "cabin",
          "platform",
          "floor",
          "room",
          "gate",
          "wall",
          "tower",
        ],
        "landmark",
        0,
        0,
        1.22,
        0.92,
      );
      const marker = recipeOutpostPart(
        recipe,
        [
          "lantern",
          "light",
          "torch",
          "flag",
          "marker",
          "buoy",
          "crystal",
          "fountain",
          "roof",
          "snow",
        ],
        "prop",
        1.65,
        0.42,
        0.84,
        0.74,
      );
      if (stall) parts.push(stall);
      if (marker) parts.push(marker);
      parts.push(stoneOutpostPart("prop", -1.3, -0.48, 0.34, 0.67));
      return parts;
    },
  },
  {
    id: "lantern-plaza",
    kind: "lantern-plaza",
    segment: "journey",
    fraction: 0.34,
    parts: (recipe) => {
      const parts: OutpostPart[] = [];
      const marker = recipeOutpostPart(
        recipe,
        ["lantern", "light", "torch", "flag", "marker", "buoy", "crystal", "fountain"],
        "prop",
        0,
        0,
        0.92,
        0.86,
      );
      if (!marker) return [];
      parts.push(marker);
      parts.push(
        donorOutpostPart("treeTrunks", "prop", -1.35, 0.52, 0.92, 0.7, { turnOffset: 0.2 }),
        stoneOutpostPart("prop", 1.25, 0.38, 0.32, 0.64),
        donorOutpostPart("bushEmitter", "prop", 0.35, -1.2, 0.48, 0.52),
      );
      return parts;
    },
  },
  {
    id: "summit-grove",
    kind: "grove",
    segment: "summit",
    fraction: 0.9,
    parts: () => [
      donorOutpostPart("treeTrunks", "landmark", 0, 0, 1.18, 0.9, { turnOffset: -0.12 }),
      donorOutpostPart("bushEmitter", "prop", -1.45, 0.48, 0.5, 0.55, { turnOffset: -0.42 }),
      // Retired elemental-serenity/leaf.glb (crossed-card foliage). The same
      // offset is a second solid bush: course draw uses procedural lobes and
      // never fetches the paper card.
      donorOutpostPart("bushEmitter", "prop", 1.05, -0.42, 0.36, 0.42, { turnOffset: -0.3 }),
      stoneOutpostPart("prop", 0.8, 0.68, 0.32, 0.62),
    ],
  },
];

/** Inspectable rest when a bridge cannot span. Never a bridge GLB. */
const BRIDGE_REST_LAYOUT = {
  id: "bridge-rest-clearing",
  kind: "stone-ring",
  segment: "journey",
  fraction: 0.5,
  parts: () => [
    stoneOutpostPart("landmark", 0, 0, 0.7, 0.9),
    stoneOutpostPart("prop", -0.95, 0.42, 0.36, 0.64, 0.55),
    donorOutpostPart("bushEmitter", "prop", 1.05, 0.38, 0.4, 0.55, { turnOffset: 0.28 }),
  ],
} satisfies OutpostLayout;

export function assemblyFallbackFromPlacements(
  kind: AssemblyKind,
  placements: readonly IslandDressingPlacement[],
): NonNullable<IslandCompositionDecision["fallback"]> {
  if (kind === "bridge") {
    const rest = placements.filter((placement) => placement.outpostId === "bridge-rest-clearing");
    return rest.length >= 2 ? "stone-rest-clearing" : "open-meadow";
  }
  if (kind === "building") {
    const grove = placements.filter((placement) => placement.outpostId === "summit-grove");
    return grove.length >= 2 ? "natural-summit" : "open-meadow";
  }
  return "open-meadow";
}

function routeClearance(blueprint: IslandBlueprint): number {
  // Centreline distance already covers every lesson node because every node
  // lies on that line. Adding nodeRadius again left a sterile several-metre
  // corridor around the path. Keep the authored shoulder and a small gardening
  // verge; individual placement spacing still prevents trunks touching props.
  return islandRouteClearance(blueprint);
}

function available(
  blueprint: IslandBlueprint,
  point: IslandPoint,
  surface: IslandFieldSample,
  placements: readonly IslandDressingPlacement[],
  minSpacing: number,
  maxSlope: number,
  nodeClearance: number,
  crownClearance = 0,
): boolean {
  const slopeLimit = Math.min(1, Math.max(0, maxSlope / (Math.PI / 2)));
  // B is the shared shoreline/radial mask and A is the height-grid slope.
  // Keep the outermost shoreline out of the placement pool; the remaining
  // radial rule supplies the broad tree ring without sampling the surface.
  if (!surface.inside || surface.shore > 0.975 || surface.rock > slopeLimit) return false;
  if (distanceToIslandRoute(blueprint, point) < routeClearance(blueprint) + crownClearance)
    return false;
  if (
    Math.hypot(point.x - blueprint.hero.x, point.z - blueprint.hero.z) <
    blueprint.hero.radius + 1.4
  ) {
    return false;
  }
  if (
    blueprint.nodes.some((node) => Math.hypot(point.x - node.x, point.z - node.z) < nodeClearance)
  ) {
    return false;
  }
  return placements.every((placement) => {
    const distance = Math.hypot(point.x - placement.x, point.z - placement.z);
    if (placement.kind !== "landmark" && placement.kind !== "prop") return distance >= minSpacing;
    return distance >= placementFootprintRadius(placement) + Math.max(0.25, crownClearance) + 0.2;
  });
}

function radialPoint(
  blueprint: IslandBlueprint,
  random: () => number,
  radial: readonly [number, number],
): IslandPoint {
  const angle = random() * Math.PI * 2;
  const amount = radial[0] + (radial[1] - radial[0]) * Math.sqrt(random());
  return {
    x: Math.cos(angle) * blueprint.bounds.halfX * amount,
    z: Math.sin(angle) * blueprint.bounds.halfZ * amount,
  };
}

export interface RouteVegetationCentre extends IslandPoint {
  readonly routeFraction: number;
  readonly side: number;
  readonly tangent: IslandPoint;
  readonly normal: IslandPoint;
}

function routeClusterCandidate(
  blueprint: IslandBlueprint,
  field: IslandField,
  fraction: number,
  preferredSide: number,
  occupied: readonly IslandDressingPlacement[],
  centres: readonly IslandPoint[],
  separation: number,
  band: "grove" | "verge",
): RouteVegetationCentre | null {
  const frame = islandRouteFrameAtFraction(blueprint, fraction);
  if (!frame) return null;
  const verge = band === "verge";
  const sides = verge ? [preferredSide] : [preferredSide, -preferredSide];
  const offsets = verge
    ? [
        routeClearance(blueprint) + 1.1,
        routeClearance(blueprint) + 1.6,
        routeClearance(blueprint) + 2.1,
      ]
    : [7.2, 8.4, 6.4, 5.2];
  let best: RouteVegetationCentre | null = null;
  let bestScore = -Infinity;
  for (const side of sides) {
    for (const offset of offsets) {
      const candidate = {
        x: frame.point.x + frame.baseNormal.x * offset * side,
        z: frame.point.z + frame.baseNormal.z * offset * side,
      };
      const surface = sampleIslandField(field, candidate.x, candidate.z);
      if (!surface.inside || surface.shore > 0.84) continue;
      if (
        centres.some(
          (centre) => Math.hypot(candidate.x - centre.x, candidate.z - centre.z) < separation,
        )
      )
        continue;
      if (
        occupied.some((placement) => {
          const extent = worldSizeForAsset(placement.assetId, placement.height);
          return (
            Math.hypot(candidate.x - placement.x, candidate.z - placement.z) <
            Math.hypot(extent.x, extent.z) * 0.5 + (verge ? 0.8 : 2.8)
          );
        })
      )
        continue;
      if (
        distanceToIslandRoute(blueprint, candidate) <
        routeClearance(blueprint) + (verge ? 0.65 : 1.4)
      )
        continue;
      if (
        Math.hypot(candidate.x - blueprint.hero.x, candidate.z - blueprint.hero.z) <
        blueprint.hero.radius + (verge ? 1.8 : 3.6)
      )
        continue;
      const score = surface.grass - surface.rock * 0.8;
      if (score > bestScore) {
        best = {
          ...candidate,
          routeFraction: fraction,
          side,
          tangent: frame.tangent,
          normal: { x: frame.baseNormal.x * side, z: frame.baseNormal.z * side },
        };
        bestScore = score;
      }
    }
  }
  return best;
}

/** Bounded route beats, not an annulus or a second procedural field.
 * Long courses request twelve grove beats; narrow/occupied shoulders may omit a
 * beat. Verge centres are independently searched on BOTH sides of the route.
 */
export function routeVegetationCentres(
  blueprint: IslandBlueprint,
  band: "grove" | "verge",
  occupied: readonly IslandDressingPlacement[] = [],
  field: IslandField = islandFieldFor(blueprint),
): readonly RouteVegetationCentre[] {
  const short = blueprint.lessonCount <= 8;
  const count =
    band === "verge"
      ? short
        ? 4
        : blueprint.lessonCount <= 24
          ? 7
          : 10
      : short
        ? 3
        : blueprint.lessonCount <= 24
          ? 7
          : 12;
  const side =
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/dressing-side`)() < 0.5 ? -1 : 1;
  const centres: RouteVegetationCentre[] = [];
  const separation = band === "verge" ? 2.6 : Math.min(7.8, blueprint.bounds.maxHalf * 0.72);
  for (let beat = 0; beat < count; beat += 1) {
    const fraction = 0.04 + (beat / Math.max(1, count - 1)) * 0.92;
    const preferred = beat % 2 === 0 ? side : -side;
    for (const direction of band === "verge" ? [preferred, -preferred] : [preferred]) {
      // A blocked facility shoulder can slide along the SAME route beat.
      // There is no random-island fallback that fills an unseen back lawn.
      for (const slide of [0, -0.025, 0.025, -0.05, 0.05]) {
        const point = routeClusterCandidate(
          blueprint,
          field,
          Math.max(0.01, Math.min(0.99, fraction + slide)),
          direction,
          occupied,
          centres,
          separation,
          band,
        );
        if (point) {
          centres.push(point);
          break;
        }
      }
    }
  }
  if (band === "grove")
    centres.push(
      ...uplandGroves(
        blueprint,
        field,
        occupied.map((p) => ({ ...p, radius: placementFootprintRadius(p) })),
        centres,
      ),
    );
  return centres;
}

interface RouteBeatAnchor {
  readonly point: IslandPoint;
  /** Forward tangent follows the authored route, not the island's screen axis. */
  readonly tangent: IslandPoint;
  /** Outward normal points from the route toward the selected safe courtyard. */
  readonly normal: IslandPoint;
}

function routeBeatAnchor(
  blueprint: IslandBlueprint,
  field: IslandField,
  segment: IslandDressingSegment,
): RouteBeatAnchor | null {
  const zone = blueprint.zones.find((candidate) => candidate.id === segment);
  if (!zone || blueprint.centerline.length === 0) return null;
  let routeIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  blueprint.centerline.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - zone.x, candidate.z - zone.z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      routeIndex = index;
    }
  });
  const preferredSide =
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/academy/${segment}`)() < 0.5 ? -1 : 1;
  const routePoint = blueprint.centerline[routeIndex]!;
  const before = blueprint.centerline[Math.max(0, routeIndex - 2)] ?? routePoint;
  const after =
    blueprint.centerline[Math.min(blueprint.centerline.length - 1, routeIndex + 2)] ?? routePoint;
  const tangentX = after.x - before.x;
  const tangentZ = after.z - before.z;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  const tangent = { x: tangentX / tangentLength, z: tangentZ / tangentLength };
  const baseNormal = { x: -tangent.z, z: tangent.x };
  const slots = Object.values(ACCENT_LAYOUT).flatMap((layout) =>
    layout.slots.filter((slot) => (slot.segment ?? layout.segment) === segment),
  );
  let best: {
    readonly point: IslandPoint;
    readonly normal: IslandPoint;
    score: number;
  } | null = null;
  for (const side of [preferredSide, -preferredSide]) {
    for (const offset of [5.2, 4.35, 6.1]) {
      const point = {
        x: routePoint.x + baseNormal.x * offset * side,
        z: routePoint.z + baseNormal.z * offset * side,
      };
      const surface = sampleIslandField(field, point.x, point.z);
      if (!surface.inside || surface.shore > 0.84) continue;
      if (distanceToIslandRoute(blueprint, point) < routeClearance(blueprint) + 1.4) continue;
      if (
        Math.hypot(point.x - blueprint.hero.x, point.z - blueprint.hero.z) <
        blueprint.hero.radius + 3.6
      ) {
        continue;
      }
      const normal = side < 0 ? { x: -baseNormal.x, z: -baseNormal.z } : baseNormal;
      const safeSlots = slots.filter((slot) => {
        const candidate = {
          x: point.x + tangent.x * slot.along + normal.x * slot.away,
          z: point.z + tangent.z * slot.along + normal.z * slot.away,
        };
        const at = sampleIslandField(field, candidate.x, candidate.z);
        return (
          at.inside &&
          at.shore <= 0.88 &&
          distanceToIslandRoute(blueprint, candidate) >= routeClearance(blueprint) &&
          Math.hypot(candidate.x - blueprint.hero.x, candidate.z - blueprint.hero.z) >=
            blueprint.hero.radius + 1.4
        );
      }).length;
      const score = safeSlots / Math.max(1, slots.length);
      if (best === null || score > best.score) best = { point, normal, score };
      if (score === 1) return { point, tangent, normal };
    }
  }
  return best ? { point: best.point, tangent, normal: best.normal } : null;
}

interface RouteFractionBasis {
  readonly routePoint: IslandPoint;
  readonly tangent: IslandPoint;
  readonly baseNormal: IslandPoint;
}

function routeFractionBasis(
  blueprint: IslandBlueprint,
  fraction: number,
): RouteFractionBasis | null {
  if (blueprint.centerline.length === 0) return null;
  const index = Math.min(
    blueprint.centerline.length - 1,
    Math.max(0, Math.round(fraction * (blueprint.centerline.length - 1))),
  );
  const routePoint = blueprint.centerline[index]!;
  const before = blueprint.centerline[Math.max(0, index - 2)] ?? routePoint;
  const after =
    blueprint.centerline[Math.min(blueprint.centerline.length - 1, index + 2)] ?? routePoint;
  const tangentX = after.x - before.x;
  const tangentZ = after.z - before.z;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  const tangent = { x: tangentX / tangentLength, z: tangentZ / tangentLength };
  return { routePoint, tangent, baseNormal: { x: -tangent.z, z: tangent.x } };
}

function outpostLayoutsForSeed(blueprint: IslandBlueprint): readonly OutpostLayout[] {
  const count = SCENERY_BAND[sceneryBandForLessonCount(blueprint.lessonCount)].outposts;
  return OUTPOST_LAYOUTS.slice(0, count);
}

export function placementFootprintRadius(
  placement: Pick<IslandDressingPlacement, "kind" | "height"> & { readonly assetId?: string },
): number {
  const assetId = placement.assetId ?? (placement.kind === "rock" ? "rock_largeA" : undefined);
  if (assetId && sourceExtentFor(assetId)) {
    const size = worldSizeForAsset(assetId, placement.height);
    return Math.hypot(size.x, size.z) * 0.5;
  }
  if (assetId === "treeTrunks" || placement.kind === "tree") {
    return foliageFootprintRadius("tree", placement.height);
  }
  if (assetId === "bushEmitter" || placement.kind === "bush") {
    return foliageFootprintRadius("bush", placement.height);
  }
  return Infinity;
}

/** Footprint of the actual shipped rigid model, or a conservative envelope
 * derived from the shared procedural foliage recipes. Unknown models cannot fit.
 */
export function outpostFootprint(placement: IslandDressingPlacement) {
  const asset = resolveIslandRuntimeAssetFromRecipe(placement.packId, placement.assetId);
  if (!asset || asset.usedFallback) return null;
  if (sourceExtentFor(asset.assetId)) {
    return orientedFootprintFor(
      asset.assetId,
      placement.height,
      placement.x,
      placement.z,
      placement.turn,
    );
  }
  const radius = placementFootprintRadius(placement);
  if (!Number.isFinite(radius)) return null;
  return { x: placement.x, z: placement.z, halfX: radius, halfZ: radius, turn: 0 };
}

function outpostGround(
  blueprint: IslandBlueprint,
  placement: IslandDressingPlacement,
): number | null {
  const footprint = outpostFootprint(placement);
  if (!footprint) return null;
  const polygon = footprintSamplePoints(footprint).slice(1, 5);
  const range = islandTerrainFootprintRange(blueprint, polygon);
  if (!range) return null;
  const foliage = placement.assetId === "treeTrunks" || placement.assetId === "bushEmitter";
  const maxSpan = Math.min(0.25, placement.height * (foliage ? 0.4 : 0.5));
  if (range.maxY - range.minY > maxSpan || range.maxSlope > (foliage ? 0.65 : 0.32)) {
    return null;
  }
  // Sit the base at the lowest support, with a bounded shallow embedding.
  // No positive underside gap; no rigid part buried by more than its limit.
  return range.minY + (placement.lift ?? 0);
}

function spacedOutpostParts(parts: readonly OutpostPart[]): readonly OutpostPart[] {
  let spacing = 1;
  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = parts[i]!,
        b = parts[j]!;
      const separation = Math.hypot(a.along - b.along, a.away - b.away);
      if (separation < 1e-6) return [];
      spacing = Math.max(
        spacing,
        (placementFootprintRadius(a) + placementFootprintRadius(b) + 0.12) / separation,
      );
    }
  }
  if (!Number.isFinite(spacing)) return [];
  return parts.map((part) => ({ ...part, along: part.along * spacing, away: part.away * spacing }));
}

function outpostPlacementIsSafe(
  blueprint: IslandBlueprint,
  field: IslandField,
  placement: IslandDressingPlacement,
  occupied: readonly IslandDressingPlacement[],
): boolean {
  const surface = sampleIslandField(field, placement.x, placement.z);
  if (!surface.inside || surface.shore > 0.88) return false;
  const footprint = placementFootprintRadius(placement);
  const physical = outpostFootprint(placement);
  if (!physical) return false;
  for (const point of footprintSamplePoints(physical)) {
    const sample = sampleIslandField(field, point.x, point.z);
    if (!sample.inside || sample.shore > 0.975) return false;
  }
  if (distanceToIslandRoute(blueprint, placement) < routeClearance(blueprint) + footprint + 0.42) {
    return false;
  }
  if (
    Math.hypot(placement.x - blueprint.hero.x, placement.z - blueprint.hero.z) <
    blueprint.hero.radius + footprint + 1.45
  ) {
    return false;
  }
  if (
    blueprint.nodes.some(
      (node) =>
        Math.hypot(placement.x - node.x, placement.z - node.z) <
        blueprint.route.nodeRadius + footprint + 0.5,
    )
  ) {
    return false;
  }
  const clear = occupied.every((other) => {
    const otherFootprint = placementFootprintRadius(other);
    const sameOutpost =
      placement.outpostId !== undefined && other.outpostId === placement.outpostId;
    const minRadius = sameOutpost ? 0.18 : 0.4;
    return (
      Math.hypot(placement.x - other.x, placement.z - other.z) >=
      Math.max(minRadius, footprint) +
        Math.max(minRadius, otherFootprint) +
        (sameOutpost ? 0.08 : 0.32)
    );
  });
  return clear && outpostGround(blueprint, placement) !== null;
}

function makeOutpostPlacement(
  layout: OutpostLayout,
  anchor: RouteBeatAnchor,
  part: OutpostPart,
  partIndex: number,
): IslandDressingPlacement {
  const point = {
    x: anchor.point.x + anchor.tangent.x * part.along + anchor.normal.x * part.away,
    z: anchor.point.z + anchor.tangent.z * part.along + anchor.normal.z * part.away,
  };
  const routeHeading =
    part.headingAxis === "x"
      ? Math.atan2(anchor.tangent.z, anchor.tangent.x)
      : Math.atan2(anchor.tangent.x, anchor.tangent.z);
  const lift = part.lift ?? 0;
  return {
    id: `outpost-${layout.id}-${partIndex + 1}`,
    packId: part.packId,
    assetId: part.assetId,
    kind: part.kind,
    segment: layout.segment,
    outpostId: layout.id,
    outpostKind: layout.kind,
    x: point.x,
    // Safety is decided from the shared field before this draft receives a
    // terrain y. Rejected route/shore candidates therefore do not pay for a
    // second continuous top-mesh interpolation.
    y: 0,
    z: point.z,
    ...(part.lift === undefined ? {} : { lift }),
    turn: routeHeading + (part.turnOffset ?? 0),
    height: part.height,
    importance: part.importance,
    ...(part.state ? { state: part.state } : {}),
  };
}

function semanticAssemblies(
  blueprint: IslandBlueprint,
  field: IslandField,
  reserved: readonly IslandDressingPlacement[],
  packByAsset: ReadonlyMap<string, IslandAssetPackId>,
  reports: AssemblySearchReport[],
): IslandDressingPlacement[] {
  const result: IslandDressingPlacement[] = [];
  const seedBase = `${blueprint.seed}/${blueprint.layoutRevision}/assembly`;
  const camp = searchCampPlacement(
    assemblyContextFor(blueprint, field, [...reserved, ...result], packByAsset, reports),
    `${seedBase}/camp`,
  );
  if (camp) result.push(...asDressingPlacements(camp));
  const bridge = searchBridgePlacement(
    assemblyContextFor(blueprint, field, [...reserved, ...result], packByAsset, reports),
    `${seedBase}/bridge`,
  );
  if (bridge) {
    result.push(...asDressingPlacements(bridge));
    return result;
  }
  result.push(...placeBridgeRestClearing(blueprint, field, [...reserved, ...result]));
  return result;
}

function outpostPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
  reserved: readonly IslandDressingPlacement[] = [],
  field: IslandField = islandFieldFor(blueprint),
): IslandDressingPlacement[] {
  const result: IslandDressingPlacement[] = [];
  const occupied: IslandDressingPlacement[] = [...reserved];
  for (const layout of outpostLayoutsForSeed(blueprint)) {
    const parts = spacedOutpostParts(layout.parts(recipe));
    if (parts.length < 2) continue;
    const preferredSide =
      seeded(`${blueprint.seed}/${blueprint.layoutRevision}/outpost/${layout.id}/side`)() < 0.5
        ? -1
        : 1;
    let selected: readonly IslandDressingPlacement[] | null = null;
    // A small set of deterministic alternatives keeps the authored route beat
    // while allowing a compact island's shoreline or an existing R01 accent to
    // reject one side of the composition.
    for (const fraction of [
      layout.fraction,
      layout.fraction - 0.035,
      layout.fraction + 0.035,
      layout.fraction - 0.07,
      layout.fraction + 0.07,
    ]) {
      if (selected) break;
      const basis = routeFractionBasis(blueprint, Math.max(0.02, Math.min(0.98, fraction)));
      if (!basis) continue;
      for (const side of [preferredSide, -preferredSide]) {
        if (selected) break;
        for (const offset of [3.2, 3.9, 4.7, 5.5, 6.4, 7.1]) {
          const anchorPoint = {
            x: basis.routePoint.x + basis.baseNormal.x * offset * side,
            z: basis.routePoint.z + basis.baseNormal.z * offset * side,
          };
          const normal =
            side < 0 ? { x: -basis.baseNormal.x, z: -basis.baseNormal.z } : basis.baseNormal;
          const anchor: RouteBeatAnchor = {
            point: anchorPoint,
            tangent: basis.tangent,
            normal,
          };
          const draft = parts.map((part, partIndex) =>
            makeOutpostPlacement(layout, anchor, part, partIndex),
          );
          const safe = draft.every((placement, partIndex) =>
            outpostPlacementIsSafe(blueprint, field, placement, [
              ...occupied,
              ...draft.slice(0, partIndex),
            ]),
          );
          if (safe) {
            selected = draft;
            break;
          }
        }
      }
    }
    if (!selected) continue;
    const grounded = selected.map((placement) => {
      return { ...placement, y: outpostGround(blueprint, placement)! };
    });
    result.push(...grounded);
    occupied.push(...grounded);
  }
  return result;
}

export function placeBridgeRestClearing(
  blueprint: IslandBlueprint,
  field: IslandField,
  occupied: readonly IslandDressingPlacement[],
  compact = false,
): readonly IslandDressingPlacement[] {
  // A seat-height rock, its smaller companion and low undergrowth form a
  // real compact rest, not a scaled-down building. Do not displace scenery
  // that already fits: the compact tier is attempted only after all ordinary
  // outposts failed. Both tiers keep the exact same physical safety test.
  const parts = spacedOutpostParts(
    compact
      ? [
          stoneOutpostPart("landmark", 0, 0, 0.42, 0.9),
          stoneOutpostPart("prop", -0.7, 0.24, 0.25, 0.64, 0.55),
          donorOutpostPart("bushEmitter", "prop", 0.72, 0.24, 0.3, 0.55),
        ]
      : BRIDGE_REST_LAYOUT.parts(),
  );
  const preferredSide =
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/bridge-rest/side`)() < 0.5 ? -1 : 1;
  // A failed bridge has six crossing beats, not six exhaustive places to
  // rest. The compact tier also searches intervening and endpoint shoulders,
  // with at most 20 beats × 2 sides × 8 offsets = 320 whole-group attempts.
  // Keep the normal tier's existing placement identity and tree aprons.
  const fractions = compact
    ? [
        ...BRIDGE_FRACTIONS,
        0.18,
        0.22,
        0.3,
        0.38,
        0.46,
        0.54,
        0.62,
        0.7,
        0.78,
        0.04,
        0.1,
        0.86,
        0.92,
        0.98,
      ]
    : BRIDGE_FRACTIONS;
  const offsets = compact ? [3.2, 3.9, 4.7, 5.5, 6.4, 7.3, 8.2, 9.1] : [3.2, 3.9, 4.7, 5.5, 6.4];
  for (const fraction of fractions) {
    const basis = routeFractionBasis(blueprint, fraction);
    if (!basis) continue;
    for (const side of [preferredSide, -preferredSide]) {
      for (const offset of offsets) {
        const anchor: RouteBeatAnchor = {
          point: {
            x: basis.routePoint.x + basis.baseNormal.x * offset * side,
            z: basis.routePoint.z + basis.baseNormal.z * offset * side,
          },
          tangent: basis.tangent,
          normal: side < 0 ? { x: -basis.baseNormal.x, z: -basis.baseNormal.z } : basis.baseNormal,
        };
        const draft = parts.map((part, partIndex) =>
          makeOutpostPlacement(BRIDGE_REST_LAYOUT, anchor, part, partIndex),
        );
        const safe = draft.every((placement, partIndex) =>
          outpostPlacementIsSafe(blueprint, field, placement, [
            ...occupied,
            ...draft.slice(0, partIndex),
          ]),
        );
        if (!safe) continue;
        return draft.map((placement) => {
          return {
            ...placement,
            y: outpostGround(blueprint, placement)!,
            companionOf: "route-bridge",
          };
        });
      }
    }
  }
  return [];
}

function candidatePoint(
  blueprint: IslandBlueprint,
  rule: CandidateRule,
  centres: readonly IslandPoint[],
  random: () => number,
  attempt: number,
): IslandPoint {
  if (!rule.clustered || centres.length === 0 || (rule.kind === "rock" && random() < 0.12)) {
    return radialPoint(blueprint, random, rule.radial);
  }
  const centre =
    centres[
      rule.kind === "rock" ? Math.floor(random() * centres.length) : attempt % centres.length
    ]!;
  if (rule.vegetationBand === "verge") {
    const frame = centre as RouteVegetationCentre;
    const along = (random() - 0.5) * (rule.clusterRadius ?? 1.65) * 2;
    const away = (random() - 0.5) * 0.72;
    return {
      x: centre.x + frame.tangent.x * along + frame.normal.x * away,
      z: centre.z + frame.tangent.z * along + frame.normal.z * away,
    };
  }
  const angle = random() * Math.PI * 2;
  const radius =
    rule.kind === "tree" && Math.floor(attempt / centres.length) < 2
      ? 0.45 + random() * 1.35
      : 0.45 + Math.sqrt(random()) * (rule.clusterRadius ?? 2.75);
  return { x: centre.x + Math.cos(angle) * radius, z: centre.z + Math.sin(angle) * radius };
}

/**
 * Rejection sampling that lets a rule lean toward flat or steep ground.
 *
 * The acceptance floor is 0.22 rather than zero so a preference never empties
 * a kind off an island whose relief happens to run the other way; it changes
 * where things gather, not whether they exist.
 */
function slopePreferred(
  surface: IslandFieldSample,
  rule: CandidateRule,
  random: () => number,
): boolean {
  const preference = rule.prefersSlope ?? 0;
  if (preference === 0) return true;
  const steepness = surface.rock;
  const wanted = preference > 0 ? steepness : 1 - steepness;
  return random() < 0.22 + wanted * Math.abs(preference) * 0.78;
}

function densityAcceptanceForRule(surface: IslandFieldSample, rule: CandidateRule): number {
  // Vegetation follows meadow density; exposed rock follows the same field's
  // A channel. A modest floor keeps a rule from disappearing on an unusual
  // but valid seed while the dominant term still shapes where it settles.
  const density = rule.kind === "rock" ? surface.rock : surface.grass;
  return rule.kind === "rock" ? 0.34 + density * 0.66 : 0.12 + density * density * 0.88;
}

function naturalPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
  reserved: readonly IslandDressingPlacement[] = [],
  field: IslandField = islandFieldFor(blueprint),
  outcrops: readonly CourseOutcrop[] = [],
  spring: CourseSpring | null = null,
): IslandDressingPlacement[] {
  const placements: IslandDressingPlacement[] = [];
  const occupied: IslandDressingPlacement[] = [...reserved];
  const bushOccupied: IslandDressingPlacement[] = [...reserved];
  const routeGroveCentres = routeVegetationCentres(blueprint, "grove", reserved, field);
  const groveCentres = routeGroveCentres.map((centre) => {
    // Bias proposals toward a nearby rock shoulder INSIDE the original
    // route patch. Identity and its envelope still belong to routeGroveCentres;
    // this preference is not a replacement centre or a second forest field.
    const nearby = outcrops
      .filter((rock) => rock.feature !== "ruin")
      .map((rock) => ({ rock, distance: Math.hypot(centre.x - rock.x, centre.z - rock.z) }))
      .sort((a, b) => a.distance - a.rock.radius - (b.distance - b.rock.radius))[0];
    if (!nearby || nearby.distance - nearby.rock.radius > 6 || nearby.distance < 0.01)
      return centre;
    const { rock, distance } = nearby;
    const reach = rock.radius + 3.2;
    const point = {
      x: rock.x + ((centre.x - rock.x) / distance) * reach,
      z: rock.z + ((centre.z - rock.z) / distance) * reach,
    };
    const ground = sampleIslandField(field, point.x, point.z);
    if (
      !ground.inside ||
      ground.shore > 0.8 ||
      distanceToIslandRoute(blueprint, point) < routeClearance(blueprint) + 3 ||
      reserved.some(
        (p) => Math.hypot(p.x - point.x, p.z - point.z) < placementFootprintRadius(p) + 3.6,
      )
    )
      return centre;
    return { ...centre, ...point };
  });
  const vergeCentres = routeVegetationCentres(blueprint, "verge", reserved, field);
  const rockCentres = borderRockClusterCentres(
    blueprint,
    field,
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/dressing/rock-centres`),
  );
  const density = Math.min(1.78, Math.max(0.9, 0.72 + Math.sqrt(blueprint.lessonCount) / 6.8));
  for (const rule of NATURAL_RULES) {
    const assets: readonly IslandNaturalAssetRef[] =
      rule.assetRole === "rock"
        ? recipe.base.naturalAssets.rocks
        : [recipe.base.naturalAssets[rule.assetRole]];
    const random = seeded(
      `${blueprint.seed}/${blueprint.layoutRevision}/dressing/${rule.kind}/${rule.height[0]}`,
    );
    const centres =
      rule.kind === "rock"
        ? rockCentres
        : rule.vegetationBand === "verge"
          ? vergeCentres
          : groveCentres;
    const identityCentres =
      rule.kind !== "rock" && rule.vegetationBand !== "verge" ? routeGroveCentres : centres;
    if (rule.kind !== "rock" && centres.length === 0) continue;
    const start = placements.length;
    const band = SCENERY_BAND[sceneryBandForLessonCount(blueprint.lessonCount)];
    const scaled = Math.round(rule.count * density * band.quota);
    const targetCount =
      rule.kind === "tree"
        ? Math.min(64, scaled, Math.max(1, centres.length) * band.treesPerGrove)
        : scaled;
    // A short course has less scenery, not a weaker chance of finding a safe
    // headland. Scaling the search down with quota left the six-lesson hill
    // fixture without a single rock despite usable footprint candidates.
    // Keep the original per-rule search capacity; emitted instances still
    // stop at the smaller targetCount and every clearance remains unchanged.
    const maxAttempts =
      rule.kind === "rock" ? Math.max(targetCount, rule.count) * 22 : targetCount * 44;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (placements.length - start >= targetCount) break;
      let point = candidatePoint(blueprint, rule, centres, random, attempt);
      // Three candidates in the SAME patch favour its usable meadow instead
      // of filling the per-rule capacity with whichever rocky point arrived
      // first. Rock/route/height still come from the one shared field.
      if (rule.kind === "tree" || rule.kind === "bush") {
        const meadowScore = (candidate: IslandPoint) => {
          const sample = sampleIslandField(field, candidate.x, candidate.z);
          return sample.inside ? sample.grass - sample.rock * 0.8 : -Infinity;
        };
        let score = meadowScore(point);
        for (let choice = 0; choice < 2; choice += 1) {
          const candidate = candidatePoint(blueprint, rule, centres, random, attempt);
          const candidateScore = meadowScore(candidate);
          if (candidateScore > score) {
            point = candidate;
            score = candidateScore;
          }
        }
      }
      const spacingOccupied = rule.kind === "bush" ? bushOccupied : occupied;
      const fieldSample = sampleIslandField(field, point.x, point.z);
      if (random() > densityAcceptanceForRule(fieldSample, rule)) continue;
      // Choose the plant's growth tier BEFORE testing its envelope. Using the
      // largest tree for every young edge candidate prevented a real graded
      // forest edge; enlarging it blindly would only make the groves emptier.
      const candidateCluster = identityCentres.reduce(
        (nearest, centre, index) =>
          nearest < 0 ||
          Math.hypot(point.x - centre.x, point.z - centre.z) <
            Math.hypot(point.x - identityCentres[nearest]!.x, point.z - identityCentres[nearest]!.z)
            ? index
            : nearest,
        -1,
      );
      const clusterTrees =
        rule.kind === "tree"
          ? placements.filter(
              (p) => p.kind === "tree" && p.clusterId === `grove-${candidateCluster + 1}`,
            )
          : [];
      const treeMembers = clusterTrees.length;
      const growth = hash(`${blueprint.seed}/grove-growth/${attempt}/${candidateCluster}`);
      // A steep or narrow grove may not support a full leader. Use the same
      // bounded search to try a younger leader only after the tall candidates
      // failed; never relax the footprint, root or path clearance to fill it.
      const leaderRecovery =
        treeMembers === 0
          ? attempt > targetCount * 24
            ? 0.64
            : attempt > targetCount * 10
              ? 0.8
              : 1
          : 1;
      const plannedTreeHeight =
        rule.height[1] *
        // When the site could only support a younger leader, its companions
        // grow relative to THAT tree. The old absolute tiers could outgrow
        // the recovered leader and erase the intended grove hierarchy.
        (treeMembers ? clusterTrees[0]!.height / rule.height[1] : leaderRecovery) *
        (treeMembers === 0
          ? 0.94 + growth * 0.06
          : treeMembers % 3 === 1
            ? 0.46 + growth * 0.18
            : 0.65 + growth * 0.15);
      const nodeClearance =
        blueprint.route.nodeRadius +
        (rule.kind === "tree"
          ? plannedTreeHeight * 0.52
          : rule.kind === "rock"
            ? 0.3
            : placementFootprintRadius({ kind: rule.kind, height: rule.height[1] }));
      if (
        !available(
          blueprint,
          point,
          fieldSample,
          spacingOccupied,
          rule.minSpacing,
          rule.maxSlope,
          nodeClearance,
          rule.kind === "tree"
            ? plannedTreeHeight * 0.52
            : rule.kind === "bush"
              ? foliageFootprintRadius("bush", rule.height[1])
              : 0,
        )
      ) {
        continue;
      }
      if (!slopePreferred(fieldSample, rule, random)) continue;
      const surface =
        rule.kind === "rock" ? null : sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      const asset = assets[Math.floor(random() * assets.length)]!;
      const amount = random();
      const clusterIndex = identityCentres.reduce(
        (nearest, centre, index) =>
          nearest < 0 ||
          Math.hypot(point.x - centre.x, point.z - centre.z) <
            Math.hypot(point.x - identityCentres[nearest]!.x, point.z - identityCentres[nearest]!.z)
            ? index
            : nearest,
        -1,
      );
      if (rule.kind !== "rock" && rule.vegetationBand !== "verge") {
        const anchor = identityCentres[clusterIndex]!;
        // Keep the existing route-side patch envelope; no looser test budget
        // merely because a nearby bank would be an attractive background.
        if (Math.hypot(point.x - anchor.x, point.z - anchor.z) > (rule.kind === "tree" ? 5.1 : 5.3))
          continue;
      }
      const turn = random() * Math.PI * 2;
      const height =
        rule.kind === "tree"
          ? plannedTreeHeight
          : rule.height[0] + (rule.height[1] - rule.height[0]) * amount;

      let finalPoint = point;
      let finalTurn = turn;
      let finalSurface = surface ?? { y: 0 };

      if (rule.kind === "rock") {
        const inwardDist = Math.hypot(point.x, point.z);
        const inwardDir =
          inwardDist > 0.1
            ? { x: -point.x / inwardDist, z: -point.z / inwardDist }
            : { x: 0, z: 0 };
        const inwardOffsets = [0, 0.8, 1.6, 2.4];
        const turns = [turn, turn + Math.PI * 0.5];
        const rockRadius = placementFootprintRadius({
          kind: "rock",
          height,
          assetId: asset.assetId,
        });

        let chosen: { point: IslandPoint; turn: number; surface: { y: number } } | null = null;

        offsetLoop: for (const offset of inwardOffsets) {
          const candX = point.x + inwardDir.x * offset;
          const candZ = point.z + inwardDir.z * offset;
          const candField = sampleIslandField(field, candX, candZ);
          if (!candField.inside || candField.shore > 0.96) continue;
          if (
            distanceToIslandRoute(blueprint, { x: candX, z: candZ }) < routeClearance(blueprint)
          ) {
            continue;
          }

          // Existing occupied clearance (turn-invariant)
          if (
            occupied.some(
              (other) =>
                Math.hypot(candX - other.x, candZ - other.z) <
                Math.max(rule.minSpacing, rockRadius + placementFootprintRadius(other) * 0.4),
            )
          ) {
            continue;
          }

          let centerTop: ReturnType<typeof sampleIslandTerrainTop> | null = null;

          for (const testTurn of turns) {
            const footprint = orientedFootprintFor(asset.assetId, height, candX, candZ, testTurn);
            const samplePoints = footprintSamplePoints(footprint);

            let valid = true;
            // 1. Whole-footprint shoreline / inside check
            for (const pt of samplePoints) {
              const ptField = sampleIslandField(field, pt.x, pt.z);
              if (!ptField.inside || ptField.shore > 0.975) {
                valid = false;
                break;
              }
            }
            if (!valid) continue;

            // 2. Whole-footprint node clearance & hero clearance
            for (const pt of samplePoints) {
              if (
                blueprint.nodes.some(
                  (node) => Math.hypot(pt.x - node.x, pt.z - node.z) < blueprint.route.nodeRadius,
                )
              ) {
                valid = false;
                break;
              }
              if (
                Math.hypot(pt.x - blueprint.hero.x, pt.z - blueprint.hero.z) < blueprint.hero.radius
              ) {
                valid = false;
                break;
              }
            }
            if (!valid) continue;

            // 3. Whole-footprint road clearance
            for (const pt of samplePoints) {
              if (distanceToIslandRoute(blueprint, pt) < routeClearance(blueprint)) {
                valid = false;
                break;
              }
            }
            if (!valid) continue;

            // 4. Grounding: bounded elevation delta <= 0.25 and rock top emerges
            if (!centerTop) {
              centerTop = sampleIslandTerrainTop(blueprint, "course", candX, candZ);
            }
            for (let i = 1; i < samplePoints.length; i += 1) {
              const pt = samplePoints[i]!;
              const top = sampleIslandTerrainTop(blueprint, "course", pt.x, pt.z);
              if (Math.abs(top.y - centerTop.y) > 0.25 || centerTop.y + height <= top.y) {
                valid = false;
                break;
              }
            }
            if (!valid) continue;

            chosen = {
              point: { x: candX, z: candZ },
              turn: testTurn,
              surface: centerTop,
            };
            break offsetLoop;
          }
        }

        if (!chosen) continue;
        finalPoint = chosen.point;
        finalTurn = chosen.turn;
        finalSurface = chosen.surface;
      }

      let rootOffset = 0;
      if (rule.kind === "tree") {
        const root = islandTerrainFootprintRange(
          blueprint,
          landscapeFootprint(finalPoint.x, finalPoint.z, height * COURSE_TREE_ROOT_RADIUS_RATIO),
          "course",
        );
        if (!root || root.maxY - root.minY > 0.25) continue;
        rootOffset = Math.min(0, root.minY - 0.01 - finalSurface.y);
        const form = courseTreeIsFir(
          `${blueprint.seed}/nature-tree-${placements.length + 1}`,
          finalPoint.x,
          finalPoint.z,
        )
          ? "fir"
          : "broadleaf";
        if (
          placements.some(
            (p) =>
              p.kind === "tree" &&
              !courseTreeEnvelopesClear(
                {
                  x: p.x,
                  y: p.y + (p.foliageRootOffset ?? 0),
                  z: p.z,
                  height: p.height,
                  form: courseTreeIsFir(`${blueprint.seed}/${p.id}`, p.x, p.z)
                    ? "fir"
                    : "broadleaf",
                },
                { ...finalPoint, y: finalSurface.y + rootOffset, height, form },
              ),
          )
        )
          continue;
      }
      const placement: IslandDressingPlacement = {
        id: `nature-${rule.kind}-${placements.length + 1}`,
        packId: asset.packId,
        assetId: asset.assetId,
        kind: rule.kind,
        x: finalPoint.x,
        y: finalSurface.y,
        z: finalPoint.z,
        turn: finalTurn,
        height,
        ...(rule.kind === "tree" ? { foliageRootOffset: rootOffset } : {}),
        importance: rule.importance[0] + (rule.importance[1] - rule.importance[0]) * amount,
        ...(clusterIndex >= 0
          ? {
              clusterId: `${rule.kind === "rock" ? "headland" : rule.vegetationBand === "verge" ? "verge" : "grove"}-${clusterIndex + 1}`,
            }
          : {}),
        ...(rule.kind === "tree" || rule.kind === "bush"
          ? { foliageTint: foliageTintAt(field, centres[clusterIndex] ?? finalPoint) }
          : {}),
      };
      // Large geological scenery is reserved before natural scatter, not
      // squeezed into leftovers or made to intersect a previously drawn tree.
      if (
        spring &&
        overlapsCourseSpring(spring, placement, placementFootprintRadius(placement) + 0.2)
      )
        continue;
      if (
        outcrops.some(
          (rock) =>
            Math.hypot(placement.x - rock.x, placement.z - rock.z) <
            rock.radius + placementFootprintRadius(placement) + 0.45,
        )
      )
        continue;
      placements.push(placement);
      (rule.kind === "bush" ? bushOccupied : occupied).push(placement);
    }
  }
  return placements;
}

function assemblyContextFor(
  blueprint: IslandBlueprint,
  field: IslandField,
  occupied: readonly IslandDressingPlacement[],
  packByAsset?: ReadonlyMap<string, IslandAssetPackId>,
  reports?: AssemblySearchReport[],
): AssemblyContext {
  return {
    blueprint,
    field,
    heightAt: (x, z) => sampleIslandTerrainTop(blueprint, "course", x, z).y,
    occupied: occupiedFromPlacements(occupied),
    packByAsset,
    ...(reports ? { onSearchResult: (report: AssemblySearchReport) => reports.push(report) } : {}),
  };
}

function asDressingPlacements(
  placements: readonly { readonly id: string }[],
): IslandDressingPlacement[] {
  return placements as IslandDressingPlacement[];
}

function accentFootprintClear(
  blueprint: IslandBlueprint,
  field: IslandField,
  assetId: string,
  height: number,
  point: IslandPoint,
  turn: number,
): boolean {
  const footprint = orientedFootprintFor(assetId, height, point.x, point.z, turn);
  const routeLimit = routeClearance(blueprint);
  for (const sample of footprintSamplePoints(footprint)) {
    const fieldSample = sampleIslandField(field, sample.x, sample.z);
    const surface = sampleIslandSurface(blueprint, sample.x, sample.z);
    if (!fieldSample.inside || !surface.inside || fieldSample.shore > 0.9) return false;
    if (distanceToIslandRoute(blueprint, sample) < routeLimit) return false;
    if (
      Math.hypot(sample.x - blueprint.hero.x, sample.z - blueprint.hero.z) <
      blueprint.hero.radius + 1.4
    ) {
      return false;
    }
    if (
      blueprint.nodes.some(
        (node) =>
          Math.hypot(sample.x - node.x, sample.z - node.z) < blueprint.route.nodeRadius + 0.55,
      )
    ) {
      return false;
    }
  }
  return true;
}

function accentPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
  field: IslandField = islandFieldFor(blueprint),
  reports?: AssemblySearchReport[],
): IslandDressingPlacement[] {
  const accentPackByAsset = new Map<string, KenneyPackId>();
  recipe.accentRoles.forEach((role) =>
    role.assetIds.forEach((assetId) => accentPackByAsset.set(assetId, role.packId)),
  );
  const academy = searchAcademyPlacement(
    assemblyContextFor(blueprint, field, [], accentPackByAsset, reports),
    `${blueprint.seed}/${blueprint.layoutRevision}/assembly/academy`,
  );
  const result: IslandDressingPlacement[] = academy ? asDressingPlacements(academy) : [];
  const anchors = new Map<IslandDressingSegment, RouteBeatAnchor | null>();
  for (const segment of ["arrival", "journey", "summit"] as const) {
    anchors.set(segment, routeBeatAnchor(blueprint, field, segment));
  }

  // Kenney Fantasy Town's modular walls use local +Z as their long axis.
  // Courtyard yaw is atan2(tangent.x, tangent.z) so +Z follows the route.
  for (const [assetId, layout] of Object.entries(ACCENT_LAYOUT)) {
    const packId = accentPackByAsset.get(assetId);
    if (!packId) continue;

    layout.slots.forEach((slot, slotIndex) => {
      const segment = slot.segment ?? layout.segment;
      const anchor = anchors.get(segment);
      if (!anchor) return;
      const point = {
        x: anchor.point.x + anchor.tangent.x * slot.along + anchor.normal.x * slot.away,
        z: anchor.point.z + anchor.tangent.z * slot.along + anchor.normal.z * slot.away,
      };
      const turn = Math.atan2(anchor.tangent.x, anchor.tangent.z) + slot.turn;
      if (!accentFootprintClear(blueprint, field, assetId, layout.height, point, turn)) return;
      const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      const lift = slot.lift ?? 0;
      result.push({
        id: `accent-${assetId}-${slotIndex + 1}`,
        packId,
        assetId,
        kind: layout.kind,
        segment,
        x: point.x,
        y: surface.y + lift,
        z: point.z,
        ...(slot.lift === undefined ? {} : { lift }),
        turn,
        height: layout.height,
        importance: layout.importance,
      });
    });
  }
  return result;
}

function resolveRecipe(blueprint: IslandBlueprint, supplied?: IslandRecipe): IslandRecipe {
  const recipe = supplied ?? recipeById(blueprint.themeSelection.recipeId ?? "");
  if (!recipe) throw new Error("Island dressing needs a registered recipe");
  const validation = validateIslandRecipe(recipe);
  if (!validation.ok) throw new Error(`Invalid island recipe: ${validation.errors.join("; ")}`);
  if (
    blueprint.themeSelection.naturalBasePackId !== recipe.base.packId ||
    blueprint.themeSelection.accentPackIds.join("/") !== recipe.accentPackIds.join("/")
  ) {
    throw new Error("Island blueprint theme selection does not match its dressing recipe");
  }
  return recipe;
}

/** A light belongs to a usable facility, never to an arbitrary empty lawn. */
function facilityLights(
  blueprint: IslandBlueprint,
  field: IslandField,
  authored: readonly IslandDressingPlacement[],
  packByAsset: ReadonlyMap<string, IslandAssetPackId>,
): IslandDressingPlacement[] {
  const packId = packByAsset.get("lantern");
  if (!packId) return [];
  const result: IslandDressingPlacement[] = [];
  for (const segment of ["arrival", "journey", "summit"] as const) {
    const anchors = authored.filter(
      (placement) =>
        placement.segment === segment &&
        ["camp", "fountain-round", "wall-doorway-square", "stall"].includes(placement.assetId),
    );
    const anchor = anchors[0];
    if (!anchor) continue;
    const size = worldSizeForAsset(anchor.assetId, anchor.height);
    const radius = Math.max(1.3, Math.hypot(size.x, size.z) * 0.5 + 0.45);
    const start = seeded(`${blueprint.seed}/facility-light/${segment}`)() * Math.PI * 2;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const angle = start + (attempt * Math.PI) / 8;
      const point = {
        x: anchor.x + Math.cos(angle) * radius,
        z: anchor.z + Math.sin(angle) * radius,
      };
      if (!accentFootprintClear(blueprint, field, "lantern", 1.2, point, angle)) continue;
      if (
        [...authored, ...result].some((other) => {
          const extent = worldSizeForAsset(other.assetId, other.height);
          return (
            Math.hypot(point.x - other.x, point.z - other.z) <
            Math.hypot(extent.x, extent.z) * 0.5 + 0.18
          );
        })
      )
        continue;
      const samples = footprintSamplePoints(
        orientedFootprintFor("lantern", 1.2, point.x, point.z, angle),
      ).map((sample) => sampleIslandTerrainTop(blueprint, "course", sample.x, sample.z).y);
      if (Math.max(...samples) - Math.min(...samples) > 0.08) continue;
      result.push({
        id: `facility-light-${segment}`,
        packId,
        assetId: "lantern",
        kind: "prop",
        segment,
        companionOf: anchor.id,
        x: point.x,
        z: point.z,
        y: Math.min(...samples),
        turn: angle,
        height: 1.2,
        importance: 0.64,
      });
      break;
    }
  }
  return result;
}

/** Optional furniture belongs to a real facility, never to a random lawn.
 * The original assembly keeps its site; each companion uses the SAME bounded
 * whole-footprint/clearance query as other outposts and is omitted if unsafe.
 */
function facilityFurniture(
  blueprint: IslandBlueprint,
  field: IslandField,
  authored: readonly IslandDressingPlacement[],
  packByAsset: ReadonlyMap<string, IslandAssetPackId>,
): IslandDressingPlacement[] {
  const result: IslandDressingPlacement[] = [];
  const anchors = authored.filter((p) =>
    ["camp", "wall-doorway-square", "stall"].includes(p.assetId),
  );
  for (const anchor of anchors) {
    const items =
      anchor.assetId === "stall" && blueprint.lessonCount > 8
        ? ["stall-bench", "cart"]
        : ["stall-bench"];
    if (blueprint.lessonCount <= 8 && result.length > 0) break;
    for (const assetId of items) {
      const packId = packByAsset.get(assetId);
      if (!packId) continue;
      const height = assetId === "cart" ? 0.75 : 0.45;
      const radius =
        placementFootprintRadius(anchor) +
        placementFootprintRadius({ assetId, height, kind: "prop" }) +
        0.65;
      const start =
        seeded(`${blueprint.seed}/facility-furniture/${anchor.id}/${assetId}`)() * Math.PI * 2;
      let placed = false;
      for (const reach of [1, 1.25, 1.5]) {
        for (let attempt = 0; attempt < 24; attempt++) {
          const angle = start + (attempt * Math.PI) / 12;
          const candidate: IslandDressingPlacement = {
            id: `furniture-${anchor.id}-${assetId}`,
            packId,
            assetId,
            kind: "prop",
            segment: anchor.segment,
            companionOf: anchor.id,
            x: anchor.x + Math.cos(angle) * radius * reach,
            z: anchor.z + Math.sin(angle) * radius * reach,
            y: 0,
            height,
            turn: assetId === "cart" ? anchor.turn : Math.PI / 2 - angle,
            importance: 0.56,
          };
          if (!outpostPlacementIsSafe(blueprint, field, candidate, [...authored, ...result]))
            continue;
          result.push({ ...candidate, y: outpostGround(blueprint, candidate)! });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
  }
  return result;
}

function worldSilhouettePlacements(
  placements: readonly IslandDressingPlacement[],
): readonly IslandDressingPlacement[] {
  // World view keeps the authored landmark silhouette, one representative from
  // each route outpost, and the most important tree that frames it.
  // The hard cap matters: a world island is a readable map marker, not a second
  // course scene or an accidental miniature settlement.
  const outpostRepresentatives = new Map<string, IslandDressingPlacement>();
  for (const placement of placements) {
    if (!placement.outpostId) continue;
    const current = outpostRepresentatives.get(placement.outpostId);
    if (
      !current ||
      placement.importance > current.importance ||
      (placement.importance === current.importance && placement.id < current.id)
    ) {
      outpostRepresentatives.set(placement.outpostId, placement);
    }
  }
  const landmarks = [
    ...placements.filter((placement) => placement.kind === "landmark" && !placement.outpostId),
    ...outpostRepresentatives.values(),
  ].sort(
    (first, second) => second.importance - first.importance || first.id.localeCompare(second.id),
  );
  const trees = placements
    .filter((placement) => placement.kind === "tree")
    .sort(
      (first, second) => second.importance - first.importance || first.id.localeCompare(second.id),
    )
    .slice(0, 1);
  return [...landmarks.slice(0, 8 - trees.length), ...trees].sort(
    (first, second) => second.importance - first.importance || first.id.localeCompare(second.id),
  );
}

/**
 * Return the small aprons that grass must keep clear around authored props.
 *
 * The planner remains the single source of placement coordinates; this is a
 * derived safety envelope, not a second hand-written layout. Natural trees,
 * rocks, and bushes intentionally remain eligible for grass overlap so groves
 * still read as layered ground cover. Large accent structures get a wider
 * apron based on their semantic kind and authored height.
 */
export function islandDressingSafetyZones(
  plan: IslandDressingPlan,
): readonly IslandDressingSafetyZone[] {
  return plan.placements
    .filter((placement) => placement.kind === "landmark" || placement.kind === "prop")
    .map((placement) => ({
      x: placement.x,
      z: placement.z,
      radius:
        placement.kind === "landmark"
          ? Math.max(0.72, Math.min(1.7, placement.height * 0.42))
          : Math.max(0.42, Math.min(0.92, placement.height * 0.24)),
      kind: "landmark" as const,
    }));
}

/** Build the full authored-feeling plan, then remove minor detail for world LOD. */
function buildIslandDressingPlan(
  blueprint: IslandBlueprint,
  detail: IslandDressingDetail,
  suppliedRecipe?: IslandRecipe,
): IslandDressingPlan {
  const recipe = resolveRecipe(blueprint, suppliedRecipe);
  const field = islandFieldFor(blueprint);
  const packByAsset = new Map<string, IslandAssetPackId>();
  recipe.accentRoles.forEach((role) =>
    role.assetIds.forEach((assetId) => packByAsset.set(assetId, role.packId)),
  );
  const reports: AssemblySearchReport[] = [];
  const accents = accentPlacements(blueprint, recipe, field, reports);
  const assemblies = semanticAssemblies(blueprint, field, accents, packByAsset, reports);
  const outposts = outpostPlacements(blueprint, recipe, [...accents, ...assemblies], field);
  const facilities = [...accents, ...assemblies, ...outposts];
  if (
    !facilities.some((placement) => placement.outpostId && !placement.assemblyId) &&
    !assemblies.some((placement) => placement.assemblyId === "route-bridge")
  ) {
    facilities.push(...placeBridgeRestClearing(blueprint, field, facilities, true));
  }
  const litFacilities = [
    ...facilities,
    ...facilityLights(blueprint, field, facilities, packByAsset),
  ];
  const authored = [
    ...litFacilities,
    ...facilityFurniture(blueprint, field, litFacilities, packByAsset),
  ];
  const geology = planCourseOutcrops(
    blueprint,
    authored.map((p) => ({ ...p, radius: placementFootprintRadius(p) })),
  );
  // Semantic places first, then large scenery, THEN vegetation. Looking for
  // water after filling every shore with trees made a valid spring disappear.
  const landscape = {
    ...geology,
    spring: planCourseSpring(blueprint, [
      ...authored.map((p) => ({ ...p, radius: placementFootprintRadius(p) })),
      ...geology.outcrops,
    ]),
  };
  const full = [
    // All facilities reserve real space, including camp and outpost members.
    ...naturalPlacements(blueprint, recipe, authored, field, landscape.outcrops, landscape.spring),
    ...authored,
  ].map((placement) => {
    if (placement.kind !== "tree" && placement.kind !== "bush") return placement;
    const foliageShapeSeed = `${blueprint.seed}/${placement.id}`;
    return {
      ...placement,
      foliageTint: placement.foliageTint ?? foliageTintAt(field, placement),
      foliageShapeSeed,
      ...(placement.kind === "bush"
        ? {
            foliageGroundOffsets: bushGroundOffsets(
              {
                position: { x: placement.x, y: placement.y, z: placement.z },
                height: placement.height,
                turn: placement.turn,
                shapeSeed: foliageShapeSeed,
              },
              (x, z) => sampleIslandTerrainTop(blueprint, "course", x, z).y,
            ),
          }
        : {}),
    };
  });
  const placements = detail === "course" ? full : worldSilhouettePlacements(full);
  return {
    version: 1,
    detail,
    seed: blueprint.seed,
    recipeId: recipe.id,
    placements,
    landscape,
    decisions: reports.map((report) => {
      if (report.status !== "omitted") return report;
      const fallback = assemblyFallbackFromPlacements(report.kind, full);
      const fallbackMembers =
        fallback === "stone-rest-clearing"
          ? full
              .filter((placement) => placement.outpostId === "bridge-rest-clearing")
              .map((placement) => placement.id)
          : fallback === "natural-summit"
            ? full
                .filter((placement) => placement.outpostId === "summit-grove")
                .map((placement) => placement.id)
            : [];
      return {
        ...report,
        fallback,
        members: fallbackMembers,
      };
    }),
  };
}

// Blueprint and recipe objects own the lifetime. Camera/hover renders never
// rerun the bounded placement searches, and leaving a course permits GC.
const dressingPlans = new WeakMap<
  IslandBlueprint,
  WeakMap<
    IslandRecipe,
    {
      readonly course: IslandDressingPlan;
      world?: IslandDressingPlan;
    }
  >
>();

export function planIslandDressing(
  blueprint: IslandBlueprint,
  detail: IslandDressingDetail,
  suppliedRecipe?: IslandRecipe,
): IslandDressingPlan {
  const recipe = resolveRecipe(blueprint, suppliedRecipe);
  let recipes = dressingPlans.get(blueprint);
  if (!recipes) {
    recipes = new WeakMap();
    dressingPlans.set(blueprint, recipes);
  }
  let plans = recipes.get(recipe);
  if (!plans) {
    plans = { course: buildIslandDressingPlan(blueprint, "course", recipe) };
    recipes.set(recipe, plans);
  }
  if (detail === "course") return plans.course;
  plans.world ??= {
    ...plans.course,
    detail: "world",
    placements: worldSilhouettePlacements(plans.course.placements),
  };
  return plans.world;
}
