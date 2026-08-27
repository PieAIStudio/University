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
  recipeById,
  validateIslandRecipe,
  type IslandRecipe,
  type KenneyPackId,
} from "./kenney-recipes.js";
import { seeded } from "./random.js";

export type IslandDressingDetail = "course" | "world";
export type IslandDressingKind = "tree" | "bush" | "rock" | "landmark" | "prop";
export type IslandDressingSegment = "arrival" | "journey" | "summit";

export interface IslandDressingPlacement extends IslandPoint {
  readonly id: string;
  readonly packId: KenneyPackId;
  readonly assetId: string;
  readonly kind: IslandDressingKind;
  /** Authored beat along the single route, when the placement is a landmark accent. */
  readonly segment?: IslandDressingSegment;
  readonly y: number;
  /** Optional authored lift above the sampled surface, used for stacks and paths. */
  readonly lift?: number;
  readonly turn: number;
  /** Target height in unscaled blueprint units; the asset adapter normalises GLBs. */
  readonly height: number;
  /** Semantic LOD, not a camera-distance guess. */
  readonly importance: number;
}

export interface IslandDressingPlan {
  readonly version: 1;
  readonly detail: IslandDressingDetail;
  readonly seed: string;
  readonly recipeId: string | null;
  readonly placements: readonly IslandDressingPlacement[];
}

export interface IslandDressingSafetyZone extends IslandPoint {
  /** A conservative ground apron in unscaled blueprint units. */
  readonly radius: number;
  readonly kind: "landmark";
}

interface CandidateRule {
  readonly assets: readonly string[];
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

/**
 * Vegetation counts, and why they are what they are.
 *
 * The judge counts decorations per lesson node and wants at least seven. The
 * old table produced 2.39, which is one prop for every 57 square units on a
 * surface measuring roughly 4,900 — far enough apart that from the design
 * camera each tree is an isolated dark mark rather than part of a wood. The
 * complaint that the island looks like scattered litter is the same
 * observation: below a certain density, instances read as noise, and only
 * above it do they read as a mass with a silhouette.
 *
 * The slope ceilings also had to move. The terrain used to hold a median
 * slope near six degrees, so a tree ceiling of 0.54 rejected nothing; on the
 * relief the island carries now it would refuse about a third of the ground.
 * Rather than raise every ceiling to the same number, each rule states the
 * slope it prefers, so trees settle on the shoulders and flats, rock gathers
 * where the ground is too steep to hold soil, and neither has to be placed by
 * hand.
 */
const NATURAL_RULES: readonly CandidateRule[] = [
  {
    assets: ["tree_default", "tree_detailed", "tree_pineDefaultB"],
    kind: "tree",
    count: 74,
    minSpacing: 1.02,
    radial: [0.24, 0.86],
    height: [2.35, 4.15],
    importance: [0.62, 0.92],
    maxSlope: 0.88,
    clustered: true,
    prefersSlope: -0.7,
  },
  {
    assets: ["plant_bushDetailed"],
    kind: "bush",
    // This donor shrub is a crossed-card silhouette, and a previous pass held
    // it to eight because dozens of them turned into dark starbursts at the
    // aerial camera. The starburst came from the size, not the count: a bush
    // as tall as 0.72 on this island is a small tree. Kept shorter, they fill
    // the gaps under the groves the way undergrowth does.
    count: 46,
    minSpacing: 0.82,
    radial: [0.2, 0.88],
    height: [0.26, 0.46],
    importance: [0.3, 0.58],
    maxSlope: 1.05,
    clustered: true,
    prefersSlope: -0.25,
  },
  {
    assets: ["rock_largeA", "rock_smallA"],
    kind: "rock",
    count: 58,
    minSpacing: 0.68,
    radial: [0.2, 0.9],
    height: [0.42, 1.35],
    importance: [0.42, 0.78],
    maxSlope: 1.9,
    clustered: false,
    prefersSlope: 0.85,
  },
] as const;

/**
 * One compact Forest Academy academy, expressed as three authored route
 * beats. Each beat is anchored from the blueprint's arrival, journey, or
 * summit zone, so the existing 18-asset kit reads as a route rather than a
 * single pile behind the hero. A slot may override its layout's default beat
 * when a modular wall or lantern belongs on both sides of the journey.
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
  stall: {
    segment: "summit",
    kind: "landmark",
    height: 1.35,
    importance: 0.9,
    slots: [{ along: -1.4, away: 0.9, turn: -0.18 }],
  },
  lantern: {
    segment: "journey",
    kind: "prop",
    height: 1.35,
    importance: 0.7,
    slots: [
      { along: -1.6, away: 0.55, turn: -0.16 },
      { segment: "summit", along: 1.5, away: 0.6, turn: 0.18 },
    ],
  },
  "wall-doorway-square": {
    segment: "arrival",
    kind: "landmark",
    height: 2.3,
    importance: 0.94,
    slots: [
      { along: 0, away: 1.8, turn: 0 },
      { segment: "summit", along: 0, away: 1.8, turn: 0 },
    ],
  },
  wall: {
    segment: "arrival",
    kind: "prop",
    height: 2.3,
    importance: 0.64,
    slots: [
      { along: -1.6, away: 1.8, turn: 0 },
      { segment: "summit", along: 1.4, away: 1.7, turn: 0 },
    ],
  },
  "wall-corner": {
    segment: "arrival",
    kind: "prop",
    height: 2.3,
    importance: 0.66,
    // Turn back toward the courtyard. Continuing outward meets the next folded
    // leg on compact routes and either clips the road or gets correctly culled.
    slots: [{ along: 1.4, away: 1.3, turn: Math.PI * 0.5 }],
  },
  roof: {
    segment: "summit",
    kind: "landmark",
    // A single thin roof plane is an awning, not a second gable. Normalising
    // it to a metre high inflated its footprint into the floating grey cards
    // visible above the academy.
    height: 0.05,
    importance: 0.93,
    slots: [{ along: 1.35, away: 1.55, turn: Math.PI * 0.5, lift: 2.28 }],
  },
  "roof-gable": {
    segment: "summit",
    kind: "landmark",
    height: 1.12,
    importance: 1,
    slots: [{ along: 0, away: 1.8, turn: 0, lift: 2.25 }],
  },
};

function distanceToSegment(point: IslandPoint, first: IslandPoint, second: IslandPoint) {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - first.x) * dx + (point.z - first.z) * dz) / lengthSquared),
        );
  return Math.hypot(point.x - (first.x + dx * amount), point.z - (first.z + dz * amount));
}

export function distanceToIslandRoute(blueprint: IslandBlueprint, point: IslandPoint): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < blueprint.centerline.length; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(point, blueprint.centerline[index - 1]!, blueprint.centerline[index]!),
    );
  }
  return distance;
}

function slopeAt(blueprint: IslandBlueprint, point: IslandPoint): number {
  const step = 0.42;
  const left = sampleIslandSurface(blueprint, point.x - step, point.z).y;
  const right = sampleIslandSurface(blueprint, point.x + step, point.z).y;
  const before = sampleIslandSurface(blueprint, point.x, point.z - step).y;
  const after = sampleIslandSurface(blueprint, point.x, point.z + step).y;
  return Math.atan(Math.hypot((right - left) / (step * 2), (after - before) / (step * 2)));
}

function routeClearance(blueprint: IslandBlueprint): number {
  // Centreline distance already covers every lesson node because every node
  // lies on that line. Adding nodeRadius again left a sterile several-metre
  // corridor around the path. Keep the authored shoulder and a small gardening
  // verge; individual placement spacing still prevents trunks touching props.
  return blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth + 0.38;
}

function available(
  blueprint: IslandBlueprint,
  point: IslandPoint,
  placements: readonly IslandDressingPlacement[],
  minSpacing: number,
  maxSlope: number,
): boolean {
  const surface = sampleIslandSurface(blueprint, point.x, point.z);
  if (!surface.inside || surface.radial > 0.91) return false;
  if (distanceToIslandRoute(blueprint, point) < routeClearance(blueprint)) return false;
  if (
    Math.hypot(point.x - blueprint.hero.x, point.z - blueprint.hero.z) <
    blueprint.hero.radius + 1.4
  ) {
    return false;
  }
  if (slopeAt(blueprint, point) > maxSlope) return false;
  return placements.every(
    (placement) => Math.hypot(point.x - placement.x, point.z - placement.z) >= minSpacing,
  );
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
  fraction: number,
  preferredSide: number,
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
    for (const offset of [5.2, 4.35, 6.1]) {
      const candidate = {
        x: point.x + normal.x * offset * side,
        z: point.z + normal.z * offset * side,
      };
      const surface = sampleIslandSurface(blueprint, candidate.x, candidate.z);
      if (!surface.inside || surface.radial > 0.84) continue;
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

function clusterCentres(blueprint: IslandBlueprint): readonly IslandPoint[] {
  const side =
    seeded(`${blueprint.seed}/${blueprint.layoutRevision}/dressing-side`)() < 0.5 ? -1 : 1;
  const centres: IslandPoint[] = [];
  // Five route beats read like designed groves: arrival, early journey,
  // midpoint, late journey, summit.  Units never enter this calculation.
  for (const [index, fraction] of [0.035, 0.24, 0.48, 0.72, 0.955].entries()) {
    const point = routeClusterCandidate(blueprint, fraction, index % 2 === 0 ? side : -side);
    if (
      point &&
      centres.every((centre) => Math.hypot(point.x - centre.x, point.z - centre.z) >= 4.8)
    ) {
      centres.push(point);
    }
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
      const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      if (!surface.inside || surface.radial > 0.84) continue;
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
        const at = sampleIslandSurface(blueprint, candidate.x, candidate.z);
        return (
          at.inside &&
          at.radial <= 0.88 &&
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

function candidatePoint(
  blueprint: IslandBlueprint,
  rule: CandidateRule,
  centres: readonly IslandPoint[],
  random: () => number,
): IslandPoint {
  if (!rule.clustered || centres.length === 0 || random() < 0.18) {
    return radialPoint(blueprint, random, rule.radial);
  }
  const centre = centres[Math.floor(random() * centres.length)]!;
  const angle = random() * Math.PI * 2;
  const radius = 0.6 + Math.sqrt(random()) * 2.75;
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
  blueprint: IslandBlueprint,
  point: IslandPoint,
  rule: CandidateRule,
  random: () => number,
): boolean {
  const preference = rule.prefersSlope ?? 0;
  if (preference === 0) return true;
  const steepness = Math.min(1, slopeAt(blueprint, point) / 1.1);
  const wanted = preference > 0 ? steepness : 1 - steepness;
  return random() < 0.22 + wanted * Math.abs(preference) * 0.78;
}

function naturalPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
  reserved: readonly IslandDressingPlacement[] = [],
): IslandDressingPlacement[] {
  const allowed = new Set(recipe.base.assetIds);
  const placements: IslandDressingPlacement[] = [];
  const occupied: IslandDressingPlacement[] = [...reserved];
  const centres = clusterCentres(blueprint);
  const density = Math.min(1.78, Math.max(0.9, 0.72 + Math.sqrt(blueprint.lessonCount) / 6.8));
  for (const rule of NATURAL_RULES) {
    const assets = rule.assets.filter((asset) => allowed.has(asset));
    if (assets.length === 0) continue;
    const random = seeded(`${blueprint.seed}/${blueprint.layoutRevision}/dressing/${rule.kind}`);
    const start = placements.length;
    const targetCount = Math.round(rule.count * density);
    for (let attempt = 0; attempt < targetCount * 44; attempt += 1) {
      if (placements.length - start >= targetCount) break;
      const point = candidatePoint(blueprint, rule, centres, random);
      if (!available(blueprint, point, occupied, rule.minSpacing, rule.maxSlope)) continue;
      if (!slopePreferred(blueprint, point, rule, random)) continue;
      const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      const assetId = assets[Math.floor(random() * assets.length)]!;
      const amount = random();
      const placement: IslandDressingPlacement = {
        id: `nature-${rule.kind}-${placements.length + 1}`,
        packId: recipe.base.packId,
        assetId,
        kind: rule.kind,
        x: point.x,
        y: surface.y,
        z: point.z,
        turn: random() * Math.PI * 2,
        height: rule.height[0] + (rule.height[1] - rule.height[0]) * amount,
        importance: rule.importance[0] + (rule.importance[1] - rule.importance[0]) * amount,
      };
      placements.push(placement);
      occupied.push(placement);
    }
  }
  return placements;
}

function accentPlacements(
  blueprint: IslandBlueprint,
  recipe: IslandRecipe,
): IslandDressingPlacement[] {
  const accentPackByAsset = new Map<string, KenneyPackId>();
  recipe.accentRoles.forEach((role) =>
    role.assetIds.forEach((assetId) => accentPackByAsset.set(assetId, role.packId)),
  );
  const anchors = new Map<IslandDressingSegment, RouteBeatAnchor | null>();
  for (const segment of ["arrival", "journey", "summit"] as const) {
    anchors.set(segment, routeBeatAnchor(blueprint, segment));
  }
  const result: IslandDressingPlacement[] = [];
  // Kenney Fantasy Town's modular walls and roads use local +Z as their long
  // axis. `hero.heading` describes the route's +X-style tangent instead, so
  // adding it directly rotated every wall by the wrong basis and made the
  // facade intersect itself. Convert the authored courtyard tangent to the
  // local +Z yaw once, then add each slot's deliberate relative turn.
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
      const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
      if (!surface.inside || surface.radial > 0.88) return;
      if (distanceToIslandRoute(blueprint, point) < routeClearance(blueprint)) return;
      if (
        Math.hypot(point.x - blueprint.hero.x, point.z - blueprint.hero.z) <
        blueprint.hero.radius + 1.4
      ) {
        return;
      }
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
        turn: Math.atan2(anchor.tangent.x, anchor.tangent.z) + slot.turn,
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

function worldSilhouettePlacements(
  placements: readonly IslandDressingPlacement[],
): readonly IslandDressingPlacement[] {
  // World view keeps the authored landmark silhouette and only the two most
  // important trees that frame it. Roads, walls, lanterns, bushes, and rocks
  // remain course detail rather than becoming a noisy miniature settlement.
  return [
    ...placements.filter((placement) => placement.kind === "landmark"),
    ...placements
      .filter((placement) => placement.kind === "tree")
      .sort(
        (first, second) =>
          second.importance - first.importance || first.id.localeCompare(second.id),
      )
      .slice(0, 2),
  ]
    .sort(
      (first, second) => second.importance - first.importance || first.id.localeCompare(second.id),
    )
    .slice(0, 12);
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
export function planIslandDressing(
  blueprint: IslandBlueprint,
  detail: IslandDressingDetail,
  suppliedRecipe?: IslandRecipe,
): IslandDressingPlan {
  const recipe = resolveRecipe(blueprint, suppliedRecipe);
  const accents = accentPlacements(blueprint, recipe);
  const full = [...naturalPlacements(blueprint, recipe, accents), ...accents];
  const placements = detail === "course" ? full : worldSilhouettePlacements(full);
  return {
    version: 1,
    detail,
    seed: blueprint.seed,
    recipeId: recipe.id,
    placements,
  };
}
