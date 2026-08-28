/**
 * Deterministic, bounded ground-cover planning for an IslandBlueprint.
 *
 * The sampler deliberately consumes the blueprint's continuous surface rule,
 * rather than a terrain mesh. A blade is accepted only when
 * `sampleIslandSurface` says that its x/z point is inside the authored top
 * surface. It never samples the cliff, underside, or a caller-owned geometry.
 * An accepted placement is one clump of leaves, not one rendered blade.
 *
 * Sampler provenance: the area-weighted rejection shape and seeded sample
 * stream were studied from cortiz2894/stylized-components, exact HEAD
 * `8eb0dde5a8e7eae985d69f923b627b0cf253bed5` (MIT), especially its grass
 * surface sampler. The live mesh is a University-authored camera-facing card:
 * elemental-serenity's `grass_blade.glb` is a three-vertex shader carrier, not
 * a visible model. Neither donor renderer, app, or unbounded density is
 * copied. The hard semantic budgets below replace both donors' "fill the
 * tile" defaults.
 */
import { sampleIslandSurface, type IslandBlueprint, type IslandPoint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import { hash, seeded } from "./random.js";

export const ISLAND_GRASS_VERSION = 2 as const;
export type IslandGrassDetail = "course" | "world";
export type IslandGrassRenderTier = "desktop" | "mobile";
export type IslandGrassDistanceTier = "near" | "mid" | "far";

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
  // A short unshadowed field, not 16k shadowed cards. World stays empty.
  // The terrain shader carries the meadow colour; these blades are the
  // silhouette you can actually count in a near shot.
  course: { desktop: 800, mobile: 280 },
  world: { desktop: 0, mobile: 0 },
};

/** Camera-distance LOD bands, measured in the course island's world units. */
export const ISLAND_GRASS_LOD_THRESHOLDS = {
  nearToMid: 48,
  midToNear: 42,
  midToFar: 92,
  farToMid: 82,
} as const;

/**
 * The middle shot keeps 45% of the deterministic clump prefix and lifts it
 * 15% so a smaller silhouette still has readable vertical rhythm. Far is
 * deliberately empty: at the aerial distance, the terrain's meadow colour
 * carries the surface and leaf-sized pixels would only become noise.
 */
export const ISLAND_GRASS_LOD_PROFILES: Readonly<
  Record<
    IslandGrassDistanceTier,
    { readonly densityMultiplier: number; readonly heightMultiplier: number }
  >
> = {
  near: { densityMultiplier: 1, heightMultiplier: 1 },
  mid: { densityMultiplier: 0.45, heightMultiplier: 1.15 },
  far: { densityMultiplier: 0, heightMultiplier: 1.15 },
};

/**
 * Resolve a distance band without storing state. `previous` is the last band
 * held by the renderer; the separated enter/exit thresholds are the
 * hysteresis that prevents camera easing from making the field pop.
 */
export function islandGrassLodForDistance(
  distance: number,
  previous: IslandGrassDistanceTier | null = null,
): IslandGrassDistanceTier {
  const normalizedDistance = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  if (previous === "near") {
    return normalizedDistance >= ISLAND_GRASS_LOD_THRESHOLDS.nearToMid ? "mid" : "near";
  }
  if (previous === "mid") {
    if (normalizedDistance < ISLAND_GRASS_LOD_THRESHOLDS.midToNear) return "near";
    return normalizedDistance >= ISLAND_GRASS_LOD_THRESHOLDS.midToFar ? "far" : "mid";
  }
  if (previous === "far") {
    return normalizedDistance <= ISLAND_GRASS_LOD_THRESHOLDS.farToMid ? "mid" : "far";
  }
  if (normalizedDistance < ISLAND_GRASS_LOD_THRESHOLDS.nearToMid) return "near";
  return normalizedDistance < ISLAND_GRASS_LOD_THRESHOLDS.midToFar ? "mid" : "far";
}

/** Number of already-planned clumps drawn by one distance LOD. */
export function islandGrassInstanceCountForLod(
  plan: Pick<IslandGrassPlan, "placements">,
  distanceTier: IslandGrassDistanceTier,
): number {
  return Math.min(
    plan.placements.length,
    Math.round(plan.placements.length * ISLAND_GRASS_LOD_PROFILES[distanceTier].densityMultiplier),
  );
}

export interface IslandGrassSafetyZone extends IslandPoint {
  /** Radius is measured in unscaled blueprint units. */
  readonly radius: number;
  readonly kind?: "node" | "hero" | "zone" | "accent" | "landmark";
}

export interface IslandGrassClump extends IslandPoint {
  /** Height of the rendered course top mesh at this x/z sample. */
  readonly y: number;
  /** Approximate clump footprint diameter in unscaled blueprint units. */
  readonly width: number;
  /** Base clump height in unscaled blueprint units. */
  readonly height: number;
  readonly rotation: number;
  /** Stable phase for a future wind/material style, never a random runtime id. */
  readonly phase: number;
  /** Retained for pure tests and diagnostics; this is the sampler's top check. */
  readonly radial: number;
}

/** Compatibility name for consumers that still call a placement a blade. */
export type IslandGrassBlade = IslandGrassClump;

export interface IslandGrassPlan {
  readonly version: typeof ISLAND_GRASS_VERSION;
  readonly detail: IslandGrassDetail;
  readonly tier: IslandGrassRenderTier;
  readonly seed: string;
  readonly density: number;
  readonly maxCount: number;
  readonly topMaxRadial: number;
  readonly placements: readonly IslandGrassClump[];
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
/** A nine-unit lattice wavelength makes broad groves instead of per-instance noise. */
export const ISLAND_GRASS_DENSITY_WAVELENGTH = 9;
const ISLAND_GRASS_DENSITY_THRESHOLD = 0.26;
/** The measured course top is about 4,900 square units inside its 85 × 112 grid. */
const MEASURED_COURSE_TOP_AREA = 4900;
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

function smoothUnit(value: number): number {
  const amount = Math.min(1, Math.max(0, value));
  return amount * amount * (3 - 2 * amount);
}

function lerp(first: number, second: number, amount: number): number {
  return first + (second - first) * amount;
}

function valueNoise2d(seed: string, x: number, z: number, wavelength: number): number {
  const gridX = x / wavelength;
  const gridZ = z / wavelength;
  const left = Math.floor(gridX);
  const top = Math.floor(gridZ);
  const xAmount = smoothUnit(gridX - left);
  const zAmount = smoothUnit(gridZ - top);
  const lattice = (offsetX: number, offsetZ: number): number =>
    hash(`${seed}/grass-density/${left + offsetX}/${top + offsetZ}`);
  const topRow = lerp(lattice(0, 0), lattice(1, 0), xAmount);
  const bottomRow = lerp(lattice(0, 1), lattice(1, 1), xAmount);
  return lerp(topRow, bottomRow, zAmount);
}

/**
 * Stable macro density in [0, 1]. The primary nine-unit field and a softer
 * eighteen-unit envelope are both derived from the blueprint seed, so high
 * values form groves while the low tail remains visibly bare ground.
 */
export function islandGrassDensityAt(seed: string, x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const local = valueNoise2d(seed, x, z, ISLAND_GRASS_DENSITY_WAVELENGTH);
  const broad = valueNoise2d(`${seed}/broad`, x, z, ISLAND_GRASS_DENSITY_WAVELENGTH * 2);
  return Math.min(1, Math.max(0, local * 0.72 + broad * 0.28));
}

function densityAcceptance(density: number): number {
  return smoothUnit(
    (density - ISLAND_GRASS_DENSITY_THRESHOLD) / (0.68 - ISLAND_GRASS_DENSITY_THRESHOLD),
  );
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
  const blueprintArea =
    Math.PI *
    Math.abs(blueprint.bounds.halfX * blueprint.bounds.halfZ) *
    ISLAND_GRASS_TOP_MAX_RADIAL ** 2;
  // The serialised envelope is intentionally conservative for some generated
  // courses. Calibrate the default meadow against the measured 85 × 112
  // course surface so a legitimate blueprint does not silently fall back to
  // the old 2,200-instance scale; larger blueprints still use their own area.
  return Math.max(blueprintArea, MEASURED_COURSE_TOP_AREA);
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
 * Plan bounded, deterministic clumps. Sampling a disk with `sqrt(u)` is the
 * same area-uniform correction used by the donor's triangle sampler; rejecting
 * against the authored outline, density field, and safety envelopes leaves a
 * stable, seed-addressable distribution over the eligible top surface.
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
    // The low-discrepancy angular progression avoids accidental bands while
    // the jitter keeps the stream seed-sensitive. `sqrt` is essential: a
    // linear radial draw would overpopulate the centre and leave a bald outer
    // field. The separate macro field below is what intentionally creates
    // groves; this stream remains the reproducible point source inside them.
    const radial = ISLAND_GRASS_TOP_MAX_RADIAL * Math.sqrt(random());
    const angle = (attempt * GOLDEN_ANGLE + random() * TAU) % TAU;
    const point = {
      x: Math.cos(angle) * blueprint.bounds.halfX * radial,
      z: Math.sin(angle) * blueprint.bounds.halfZ * radial,
    };
    const density = islandGrassDensityAt(resolved.seed, point.x, point.z);
    const acceptance = densityAcceptance(density);
    if (acceptance <= 0 || random() > acceptance) continue;
    const densityHeight = smoothUnit(
      Math.min(1, Math.max(0, (density - ISLAND_GRASS_DENSITY_THRESHOLD) / 0.42)),
    );
    if (!isAvailable(blueprint, point, radial, resolved.safetyZones, routeClearance)) continue;
    const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
    // One placement is a 5–8-leaf clump. A 0.72–1.0 footprint leaves small
    // seams between clumps at low field values, while the 0.72–1.06 height
    // range gives close views enough volume without multiplying instances.
    placements.push({
      x: point.x,
      z: point.z,
      y: surface.y,
      // A clump 0.72 to 1.06 tall stands roughly waist high against the
      // lesson markers on this island: the near camera came back looking
      // through undergrowth rather than across a meadow. Two thirds of that
      // keeps the clumped silhouette and puts the horizon back.
      width: 0.1 + random() * 0.06,
      // Looked down on, donor-height blades are skyscrapers. Keep them short
      // enough that the diorama camera sees a field, not a palisade; the
      // density field still makes lush patches a little taller.
      height: (0.34 + random() * 0.16) * (0.82 + densityHeight * 0.4),
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
