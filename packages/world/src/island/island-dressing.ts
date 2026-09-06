/**
 * Deterministic, renderer-free dressing for an IslandBlueprint.
 *
 * A catalog says what *may* appear. This planner decides what earns a place in
 * the composition. It builds one full course plan, then the world projection
 * removes low-importance detail; it never rolls a second island.
 */
import { sampleIslandSurface, type IslandBlueprint, type IslandPoint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
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
import { seeded } from "./random.js";
import {
  BORDER_ROCK_TIERS,
  borderRockClusterCentres,
  footprintSamplePoints,
  occupiedFromPlacements,
  orientedFootprintFor,
  searchAcademyPlacement,
  searchBridgePlacement,
  searchCampPlacement,
  worldSizeForAsset,
  type AssemblyContext,
  type AssemblySearchReport,
} from "./island-composition.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";

export { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";

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
}

export interface IslandCompositionDecision extends AssemblySearchReport {
  /** What the learner actually receives when this assembly could not fit. */
  readonly fallback?: "stone-rest-clearing" | "natural-summit" | "open-meadow";
}

export interface IslandDressingPlan {
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
const NATURAL_RULES: readonly CandidateRule[] = [
  {
    assetRole: "tree",
    kind: "tree",
    count: 42,
    minSpacing: 1.35,
    radial: [0.68, 0.97],
    height: [2.35, 4.15],
    importance: [0.62, 0.92],
    maxSlope: 0.88,
    clustered: true,
    clusterRadius: 2.45,
    prefersSlope: -0.7,
  },
  {
    assetRole: "bush",
    kind: "bush",
    // This donor shrub is a crossed-card silhouette, and a previous pass held
    // it to eight because dozens of them turned into dark starbursts at the
    // aerial camera. The starburst came from the size, not the count: a bush
    // as tall as 0.72 on this island is a small tree. Kept shorter, they fill
    // the gaps under the groves the way undergrowth does.
    count: 46,
    minSpacing: 0.58,
    radial: [0.52, 0.92],
    height: [0.26, 0.46],
    importance: [0.3, 0.58],
    maxSlope: 1.05,
    clustered: true,
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
  fallbackOffset: number,
): { readonly packId: KenneyPackId; readonly assetId: string } | null {
  const candidates = recipe.accentRoles
    .flatMap((role) => role.assetIds.map((assetId) => ({ packId: role.packId, assetId })))
    .filter(({ packId, assetId }) => {
      const resolved = resolveIslandRuntimeAssetFromRecipe(packId, assetId);
      return resolved && !/^(wall|roof|floor|platform|gate|room)(?:[-_]|$)/u.test(resolved.assetId);
    });
  if (candidates.length === 0) return null;
  for (const hint of hints) {
    const match = candidates.find(({ assetId }) => assetId.toLowerCase().includes(hint));
    if (match) return match;
  }
  return candidates[fallbackOffset % candidates.length] ?? null;
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
  fallbackOffset: number,
  kind: IslandDressingKind,
  along: number,
  away: number,
  height: number,
  importance: number,
): OutpostPart | null {
  const asset = recipeAccentAsset(recipe, hints, fallbackOffset);
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
        0,
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
        1,
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
        1,
        "prop",
        0,
        0,
        0.92,
        0.86,
      );
      if (marker) parts.push(marker);
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
      donorOutpostPart("bushEmitter", "prop", -1.45, 0.48, 0.5, 0.55, { turnOffset: 0.42 }),
      donorOutpostPart("leaf", "prop", 1.05, -0.42, 0.18, 0.38, { turnOffset: -0.3 }),
      stoneOutpostPart("prop", 0.8, 0.68, 0.32, 0.62),
    ],
  },
];

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
    const size = worldSizeForAsset(placement.assetId, placement.height);
    return distance >= Math.hypot(size.x, size.z) * 0.5 + Math.max(0.25, crownClearance) + 0.2;
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

function routeClusterCandidate(
  blueprint: IslandBlueprint,
  field: IslandField,
  fraction: number,
  preferredSide: number,
  occupied: readonly IslandDressingPlacement[],
): IslandPoint | null {
  const index = Math.min(
    blueprint.centerline.length - 1,
    Math.max(0, Math.round(fraction * (blueprint.centerline.length - 1))),
  );
  const point = blueprint.centerline[index]!;
  const before = blueprint.centerline[Math.max(0, index - 2)] ?? point;
  const after = blueprint.centerline[Math.min(blueprint.centerline.length - 1, index + 2)] ?? point;
  const tangentX = after.x - before.x;
  const tangentZ = after.z - before.z;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  const normal = { x: -tangentZ / tangentLength, z: tangentX / tangentLength };
  for (const side of [preferredSide, -preferredSide]) {
    for (const offset of [7.2, 8.4, 6.4, 5.2]) {
      const candidate = {
        x: point.x + normal.x * offset * side,
        z: point.z + normal.z * offset * side,
      };
      const surface = sampleIslandField(field, candidate.x, candidate.z);
      if (!surface.inside || surface.shore > 0.84) continue;
      if (
        occupied.some((placement) => {
          const extent = worldSizeForAsset(placement.assetId, placement.height);
          return (
            Math.hypot(candidate.x - placement.x, candidate.z - placement.z) <
            Math.hypot(extent.x, extent.z) * 0.5 + 2.8
          );
        })
      )
        continue;
      if (distanceToIslandRoute(blueprint, candidate) < routeClearance(blueprint) + 1.4) {
        continue;
      }
      if (
        Math.hypot(candidate.x - blueprint.hero.x, candidate.z - blueprint.hero.z) <
        blueprint.hero.radius + 3.6
      ) {
        continue;
      }
      return candidate;
    }
  }
  return null;
}

function clusterCentres(
  blueprint: IslandBlueprint,
  field: IslandField,
  occupied: readonly IslandDressingPlacement[],
): readonly IslandPoint[] {
  const side =
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/dressing-side`)() < 0.5 ? -1 : 1;
  const centres: IslandPoint[] = [];
  // Five route beats read like designed groves: arrival, early journey,
  // midpoint, late journey, summit.  Units never enter this calculation.
  const fractions =
    blueprint.lessonCount <= 8 ? [0.08, 0.48, 0.9] : [0.035, 0.24, 0.48, 0.72, 0.955];
  const separation = Math.min(9.4, blueprint.bounds.maxHalf * 0.72);
  for (const [index, fraction] of fractions.entries()) {
    const point = routeClusterCandidate(
      blueprint,
      field,
      fraction,
      index % 2 === 0 ? side : -side,
      occupied,
    );
    if (
      point &&
      centres.every((centre) => Math.hypot(point.x - centre.x, point.z - centre.z) >= separation)
    ) {
      centres.push(point);
    }
  }
  // A very short route may have fewer usable beat shoulders. Find a small
  // bounded set of inland headlands, rather than falling back to a tree ring.
  const random = seeded(`${blueprint.seed}/${blueprint.layoutRevision}/grove-headlands`);
  for (
    let attempt = 0;
    attempt < 48 && centres.length < Math.min(3, fractions.length);
    attempt += 1
  ) {
    const point = radialPoint(blueprint, random, [0.52, 0.78]);
    const at = sampleIslandField(field, point.x, point.z);
    if (
      !at.inside ||
      at.shore > 0.86 ||
      distanceToIslandRoute(blueprint, point) < routeClearance(blueprint) + 2.8
    )
      continue;
    if (
      Math.hypot(point.x - blueprint.hero.x, point.z - blueprint.hero.z) <
      blueprint.hero.radius + 3.8
    )
      continue;
    if (centres.every((centre) => Math.hypot(point.x - centre.x, point.z - centre.z) >= separation))
      centres.push(point);
  }
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
  if (blueprint.lessonCount <= 8) return OUTPOST_LAYOUTS.slice(0, 2);
  return OUTPOST_LAYOUTS;
}

function placementFootprintRadius(
  placement: Pick<IslandDressingPlacement, "kind" | "height">,
): number {
  if (placement.kind === "landmark") return Math.max(0.42, placement.height * 0.22);
  if (placement.kind === "prop") return Math.max(0.2, placement.height * 0.18);
  return Math.max(0.12, placement.height * 0.14);
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
  return occupied.every((other) => {
    const otherFootprint = placementFootprintRadius(other);
    const sameOutpost = other.outpostId === placement.outpostId;
    const minRadius = sameOutpost ? 0.18 : 0.4;
    return (
      Math.hypot(placement.x - other.x, placement.z - other.z) >=
      Math.max(minRadius, footprint) +
        Math.max(minRadius, otherFootprint) +
        (sameOutpost ? 0.08 : 0.32)
    );
  });
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
  if (bridge) result.push(...asDressingPlacements(bridge));
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
    const parts = layout.parts(recipe);
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
          const safeParts = draft.map((placement, partIndex) =>
            outpostPlacementIsSafe(blueprint, field, placement, [
              ...occupied,
              ...draft.slice(0, partIndex),
            ]),
          );
          if (safeParts.every(Boolean)) {
            selected = draft;
            break;
          }
        }
      }
    }
    if (!selected) continue;
    const grounded = selected.map((placement) => {
      const surface = sampleIslandTerrainTop(blueprint, "course", placement.x, placement.z);
      return { ...placement, y: surface.y + (placement.lift ?? 0) };
    });
    result.push(...grounded);
    occupied.push(...grounded);
  }
  return result;
}

function candidatePoint(
  blueprint: IslandBlueprint,
  rule: CandidateRule,
  centres: readonly IslandPoint[],
  random: () => number,
): IslandPoint {
  if (!rule.clustered || centres.length === 0 || (rule.kind !== "tree" && random() < 0.12)) {
    return radialPoint(blueprint, random, rule.radial);
  }
  const centre = centres[Math.floor(random() * centres.length)]!;
  const angle = random() * Math.PI * 2;
  const radius = 0.45 + Math.sqrt(random()) * (rule.clusterRadius ?? 2.75);
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
  return 0.34 + density * 0.66;
}

function naturalPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
  reserved: readonly IslandDressingPlacement[] = [],
  field: IslandField = islandFieldFor(blueprint),
): IslandDressingPlacement[] {
  const placements: IslandDressingPlacement[] = [];
  const occupied: IslandDressingPlacement[] = [...reserved];
  const bushOccupied: IslandDressingPlacement[] = [...reserved];
  const groveCentres = clusterCentres(blueprint, field, reserved);
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
    const centres = rule.kind === "rock" ? rockCentres : groveCentres;
    const start = placements.length;
    const targetCount =
      rule.kind === "tree"
        ? Math.min(Math.round(rule.count * density), centres.length * 14)
        : Math.round(rule.count * density);
    for (let attempt = 0; attempt < targetCount * 44; attempt += 1) {
      if (placements.length - start >= targetCount) break;
      const point = candidatePoint(blueprint, rule, centres, random);
      const spacingOccupied = rule.kind === "bush" ? bushOccupied : occupied;
      const fieldSample = sampleIslandField(field, point.x, point.z);
      if (random() > densityAcceptanceForRule(fieldSample, rule)) continue;
      const nodeClearance =
        blueprint.route.nodeRadius +
        (rule.kind === "tree"
          ? rule.height[1] * 0.52
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
          rule.kind === "tree" ? rule.height[1] * 0.52 : 0,
        )
      ) {
        continue;
      }
      if (!slopePreferred(fieldSample, rule, random)) continue;
      const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      const asset = assets[Math.floor(random() * assets.length)]!;
      const amount = random();
      const clusterIndex = centres.reduce(
        (nearest, centre, index) =>
          nearest < 0 ||
          Math.hypot(point.x - centre.x, point.z - centre.z) <
            Math.hypot(point.x - centres[nearest]!.x, point.z - centres[nearest]!.z)
            ? index
            : nearest,
        -1,
      );
      const placement: IslandDressingPlacement = {
        id: `nature-${rule.kind}-${placements.length + 1}`,
        packId: asset.packId,
        assetId: asset.assetId,
        kind: rule.kind,
        x: point.x,
        y: surface.y,
        z: point.z,
        turn: random() * Math.PI * 2,
        height: rule.height[0] + (rule.height[1] - rule.height[0]) * amount,
        importance: rule.importance[0] + (rule.importance[1] - rule.importance[0]) * amount,
        ...(clusterIndex >= 0
          ? { clusterId: `${rule.kind === "rock" ? "headland" : "grove"}-${clusterIndex + 1}` }
          : {}),
      };
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
        y: sampleIslandTerrainTop(blueprint, "course", point.x, point.z).y,
        turn: angle,
        height: 1.2,
        importance: 0.64,
      });
      break;
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
  const authored = [...facilities, ...facilityLights(blueprint, field, facilities, packByAsset)];
  const full = [
    // All facilities reserve real space, including camp and outpost members.
    ...naturalPlacements(blueprint, recipe, authored, field),
    ...authored,
  ];
  const placements = detail === "course" ? full : worldSilhouettePlacements(full);
  return {
    version: 1,
    detail,
    seed: blueprint.seed,
    recipeId: recipe.id,
    placements,
    decisions: reports.map((report) => ({
      ...report,
      ...(report.status === "omitted"
        ? {
            fallback:
              report.kind === "bridge" &&
              outposts.some((placement) => placement.outpostId === "water-stone-ring")
                ? ("stone-rest-clearing" as const)
                : report.kind === "building"
                  ? ("natural-summit" as const)
                  : ("open-meadow" as const),
          }
        : {}),
    })),
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
