/**
 * Deterministic, bounded ground-cover planning for an IslandBlueprint .
 *
 * The sampler deliberately consumes the blueprint's continuous surface rule,
 * rather than a terrain mesh. A blade is accepted only when
 * `sampleIslandSurface` says that its x/z point is inside the authored top
 * surface. It never samples the cliff, underside, or a caller-owned geometry.
 *
 * Algorithm provenance: the area-weighted rejection shape and seeded sample
 * stream were studied from cortiz2894/stylized-components, exact HEAD
 * `8eb0dde5a8e7eae985d69f923b627b0cf253bed5` (MIT), especially its grass
 * surface sampler. This is a small University adapter: no donor renderer,
 * shader, app, or media is copied. The donor's unbounded density is
 * intentionally replaced by the hard semantic budgets below.
 */
import { sampleIslandSurface, type IslandBlueprint, type IslandPoint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import { seeded } from "./random.js";

export const ISLAND_GRASS_VERSION = 1 as const;
export type IslandGrassDetail = "course" | "world";
export type IslandGrassRenderTier = "desktop" | "mobile";

/**
 * The outer 17% of the authored silhouette is the continuous shore/cliff
 * falloff. Keep blades on the broad top plateau, with a tiny margin so a
 * perturbed outline cannot put a blade on the cliff lip.
 */
export const ISLAND_GRASS_TOP_MAX_RADIAL = 0.81;

/**
 * Semantic budgets, not an invitation to fill the island. World has no grass
 * resident by default; a miniature grass silhouette would cost more than it
 * communicates at that projection.
 */
export const ISLAND_GRASS_LIMITS: Readonly<
  Record<IslandGrassDetail, Readonly<Record<IslandGrassRenderTier, number>>>
> = {
  // The field is one instanced batch, so a denser silhouette costs almost no
  // scene-graph overhead. Keep a separate mobile ceiling for fill-rate.
  course: { desktop: 2200, mobile: 760 },
  world: { desktop: 0, mobile: 0 },
};

export interface IslandGrassSafetyZone extends IslandPoint {
  /** Radius is measured in unscaled blueprint units. */
  readonly radius: number;
  readonly kind?: "node" | "hero" | "zone" | "accent" | "landmark";
}

export interface IslandGrassBlade extends IslandPoint {
  /** Height of the rendered course top mesh at this x/z sample. */
  readonly y: number;
  /** Low-model dimensions in unscaled blueprint units. */
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  /** Stable phase for a future wind/material style, never a random runtime id. */
  readonly phase: number;
  /** Retained for pure tests and diagnostics; this is the sampler's top check. */
  readonly radial: number;
}

export interface IslandGrassPlan {
  readonly version: typeof ISLAND_GRASS_VERSION;
  readonly detail: IslandGrassDetail;
  readonly tier: IslandGrassRenderTier;
  readonly seed: string;
  readonly density: number;
  readonly maxCount: number;
  readonly topMaxRadial: number;
  readonly placements: readonly IslandGrassBlade[];
}

export interface IslandGrassPlanOptions {
  /** Defaults to the current semantic render tier only in the R3F adapter. */
  readonly tier?: IslandGrassRenderTier;
  /** Blades per approximate top-surface square unit. */
  readonly density?: number;
  /** Additional cap; the semantic tier cap always wins. */
  readonly maxCount?: number;
  /** Optional independent stream salt; blueprint.seed remains the default. */
  readonly seed?: string;
  /** Explicit accent/landmark keep-clear zones in blueprint units. */
  readonly safetyZones?: readonly IslandGrassSafetyZone[];
  /** Additional route gap beyond road + shoulder. */
  readonly routeGap?: number;
  /** Extra space around lesson node halos and click targets. */
  readonly nodeGap?: number;
  /** Extra space around the hero proxy. */
  readonly heroGap?: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEFAULT_DENSITY: Readonly<Record<IslandGrassRenderTier, number>> = {
  desktop: 3.6,
  mobile: 1.2,
};
// Grass stops just beyond the soil extent. A small margin keeps blades from
// visually growing through the path while preserving the natural verge.
// Leave room for the widest procedural soil verge, blade half-width, and a
// small wind lean. This keeps grass roots on the meadow side of the path while
// retaining a soft, naturally worn edge rather than a clipped lawn border.
const DEFAULT_ROUTE_GAP = 0.24;
const DEFAULT_NODE_GAP = 0.52;
const DEFAULT_HERO_GAP = 0.78;
const MAX_SAMPLING_ATTEMPTS = 96;

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`IslandGrass ${label} must be finite and non-negative`);
  }
  return value;
}

function nonEmptySeed(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("IslandGrass seed must be a non-empty string");
  }
  return value;
}

function distanceBetween(first: IslandPoint, second: IslandPoint): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function defaultSafetyZones(
  blueprint: IslandBlueprint,
  nodeGap: number,
  heroGap: number,
): readonly IslandGrassSafetyZone[] {
  const nodeZones = blueprint.nodes.map((node) => ({
    x: node.x,
    z: node.z,
    radius: nodeRadius(blueprint) + nodeGap,
    kind: "node" as const,
  }));
  const heroZone = {
    x: blueprint.hero.x,
    z: blueprint.hero.z,
    radius: blueprint.hero.radius + heroGap,
    kind: "hero" as const,
  };
  // Asset-aware landmark aprons are supplied by the renderer. Reserving the
  // three broad composition zones here as well covered nearly the whole
  // switchback island and made a valid grass plan empty.
  return [...nodeZones, heroZone];
}

function nodeRadius(blueprint: IslandBlueprint): number {
  return Math.max(0, blueprint.route.nodeRadius);
}

function normalizedSafetyZones(
  blueprint: IslandBlueprint,
  safetyZones: readonly IslandGrassSafetyZone[] | undefined,
  nodeGap: number,
  heroGap: number,
): readonly IslandGrassSafetyZone[] {
  const explicit = safetyZones ?? [];
  explicit.forEach((zone, index) => {
    if (!Number.isFinite(zone.x) || !Number.isFinite(zone.z)) {
      throw new RangeError(`IslandGrass safetyZones[${index}] point must be finite`);
    }
    if (!Number.isFinite(zone.radius) || zone.radius < 0) {
      throw new RangeError(`IslandGrass safetyZones[${index}] radius must be non-negative`);
    }
  });
  return [...defaultSafetyZones(blueprint, nodeGap, heroGap), ...explicit];
}

function resolvePlanOptions(
  blueprint: IslandBlueprint,
  detail: IslandGrassDetail,
  options: IslandGrassPlanOptions | undefined,
): {
  readonly detail: IslandGrassDetail;
  readonly tier: IslandGrassRenderTier;
  readonly seed: string;
  readonly density: number;
  readonly maxCount: number;
  readonly routeGap: number;
  readonly nodeGap: number;
  readonly heroGap: number;
  readonly safetyZones: readonly IslandGrassSafetyZone[];
} {
  const tier = options?.tier ?? "desktop";
  if (tier !== "desktop" && tier !== "mobile") {
    throw new RangeError("IslandGrass tier must be desktop or mobile");
  }
  if (detail !== "course" && detail !== "world") {
    throw new RangeError("IslandGrass detail must be course or world");
  }
  const density = finiteNonNegative(options?.density ?? DEFAULT_DENSITY[tier], "density");
  const requestedMax =
    options?.maxCount === undefined
      ? ISLAND_GRASS_LIMITS[detail][tier]
      : finiteNonNegative(options.maxCount, "maxCount");
  const maxCount = Math.min(ISLAND_GRASS_LIMITS[detail][tier], Math.floor(requestedMax));
  return {
    detail,
    tier,
    seed: nonEmptySeed(options?.seed ?? blueprint.seed),
    density,
    maxCount,
    routeGap: finiteNonNegative(options?.routeGap ?? DEFAULT_ROUTE_GAP, "routeGap"),
    nodeGap: finiteNonNegative(options?.nodeGap ?? DEFAULT_NODE_GAP, "nodeGap"),
    heroGap: finiteNonNegative(options?.heroGap ?? DEFAULT_HERO_GAP, "heroGap"),
    safetyZones: normalizedSafetyZones(
      blueprint,
      options?.safetyZones,
      finiteNonNegative(options?.nodeGap ?? DEFAULT_NODE_GAP, "nodeGap"),
      finiteNonNegative(options?.heroGap ?? DEFAULT_HERO_GAP, "heroGap"),
    ),
  };
}

function approximateTopArea(blueprint: IslandBlueprint): number {
  return (
    Math.PI *
    Math.abs(blueprint.bounds.halfX * blueprint.bounds.halfZ) *
    ISLAND_GRASS_TOP_MAX_RADIAL ** 2
  );
}

function clearanceToSafetyZones(
  point: IslandPoint,
  zones: readonly IslandGrassSafetyZone[],
): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const zone of zones) {
    distance = Math.min(distance, distanceBetween(point, zone) - zone.radius);
  }
  return distance;
}

function isAvailable(
  blueprint: IslandBlueprint,
  point: IslandPoint,
  radial: number,
  zones: readonly IslandGrassSafetyZone[],
  routeClearance: number,
): boolean {
  // `inside` and `radial` are both required. `inside` protects the authored
  // outline; radial protects the broad top from the continuous shore/cliff.
  const surface = sampleIslandSurface(blueprint, point.x, point.z);
  if (
    !surface.inside ||
    radial > ISLAND_GRASS_TOP_MAX_RADIAL ||
    surface.radial > ISLAND_GRASS_TOP_MAX_RADIAL
  ) {
    return false;
  }
  if (distanceToIslandRoute(blueprint, point) < routeClearance) return false;
  if (clearanceToSafetyZones(point, zones) < 0) return false;
  return true;
}

/**
 * Plan bounded, deterministic blades. Sampling a disk with `sqrt(u)` is the
 * same area-uniform correction used by the donor's triangle sampler; rejecting
 * against the authored outline and safety envelopes leaves a stable uniform
 * distribution over the eligible top surface.
 */
export function planIslandGrass(
  blueprint: IslandBlueprint,
  detail: IslandGrassDetail,
  options?: IslandGrassPlanOptions,
): IslandGrassPlan {
  const resolved = resolvePlanOptions(blueprint, detail, options);
  const placements: IslandGrassBlade[] = [];
  const targetCount = Math.min(
    resolved.maxCount,
    Math.round(approximateTopArea(blueprint) * resolved.density),
  );
  const routeClearance =
    blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth + resolved.routeGap;
  const random = seeded(
    `${resolved.seed}/${blueprint.layoutRevision}/grass/${detail}/${resolved.tier}`,
  );
  const maxAttempts = targetCount * MAX_SAMPLING_ATTEMPTS + 256;

  // World intentionally remains an empty resident. Still return a complete
  // plan object so callers can compare semantic detail without a second API.
  if (targetCount === 0) {
    return {
      version: ISLAND_GRASS_VERSION,
      detail,
      tier: resolved.tier,
      seed: resolved.seed,
      density: resolved.density,
      maxCount: resolved.maxCount,
      topMaxRadial: ISLAND_GRASS_TOP_MAX_RADIAL,
      placements,
    };
  }

  for (let attempt = 0; attempt < maxAttempts && placements.length < targetCount; attempt += 1) {
    // The low-discrepancy angular progression avoids visible clumps while the
    // jitter keeps the stream seed-sensitive. `sqrt` is essential: a linear
    // radial draw would overpopulate the centre and leave a bald outer field.
    const radial = ISLAND_GRASS_TOP_MAX_RADIAL * Math.sqrt(random());
    const angle = (attempt * GOLDEN_ANGLE + random() * TAU) % TAU;
    const point = {
      x: Math.cos(angle) * blueprint.bounds.halfX * radial,
      z: Math.sin(angle) * blueprint.bounds.halfZ * radial,
    };
    if (!isAvailable(blueprint, point, radial, resolved.safetyZones, routeClearance)) continue;
    const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
    // A slightly broader tuft keeps enough projected area under the course
    // camera to read as ground cover instead of black needles. All values
    // remain deterministic and instance-local; density is not increased.
    placements.push({
      x: point.x,
      z: point.z,
      y: surface.y,
      width: 0.15 + random() * 0.14,
      height: 0.26 + random() * 0.32,
      rotation: random() * TAU,
      phase: random(),
      radial: surface.radial,
    });
  }

  return {
    version: ISLAND_GRASS_VERSION,
    detail,
    tier: resolved.tier,
    seed: resolved.seed,
    density: resolved.density,
    maxCount: resolved.maxCount,
    topMaxRadial: ISLAND_GRASS_TOP_MAX_RADIAL,
    placements,
  };
}

/**
 * A small test/diagnostic predicate shared by callers that want to explain
 * why a candidate is not eligible. It intentionally delegates height to the
 * blueprint and never reads or mutates a terrain mesh.
 */
export function islandGrassPointIsTopSurface(
  blueprint: IslandBlueprint,
  point: IslandPoint,
): boolean {
  const sample = sampleIslandSurface(blueprint, point.x, point.z);
  return sample.inside && sample.radial <= ISLAND_GRASS_TOP_MAX_RADIAL;
}
