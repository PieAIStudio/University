/**
 * Deterministic, bounded ground-cover planning for an IslandBlueprint.
 *
 * The planner consumes the shared field compiled from the blueprint's
 * continuous surface rule, rather than a terrain mesh. A blade is accepted
 * only when the field says that its x/z point is inside the authored top
 * surface. It never samples the cliff, underside, or caller-owned geometry.
 * An accepted placement is one rendered blade. The blade's silhouette is
 * supplied by the shared three-vertex card and its vertex shader, so placement
 * data stays small enough to spend the budget on screen-visible density.
 *
 * Algorithm provenance: the area-weighted rejection shape and seeded sample
 * stream were studied from cortiz2894/stylized-components, exact HEAD
 * `8eb0dde5a8e7eae985d69f923b627b0cf253bed5` (MIT), especially its grass
 * surface sampler. This is a small University adapter: no donor renderer,
 * shader, app, or media is copied. The donor's unbounded density is
 * intentionally replaced by the hard semantic budgets below.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { distanceToIslandRoute } from "./island-dressing.js";
import {
  ISLAND_FIELD_GRASS_CUTOFF,
  islandFieldFor,
  sampleIslandField,
  sampleIslandFieldChannel,
  type IslandField,
} from "./island-field.js";
import { seeded } from "./random.js";

export const ISLAND_GRASS_VERSION = 4 as const;
export type IslandGrassDetail = "course" | "world";
export type IslandGrassRenderTier = "desktop" | "mobile";
export type IslandGrassDistanceTier = "near" | "mid" | "far";

/**
 * The outer 17% of the authored silhouette is the continuous shore/cliff
 * falloff. Keep blades on the broad top plateau, with a tiny margin so a
 * perturbed outline cannot put a blade on the cliff lip.
 */
export const ISLAND_GRASS_TOP_MAX_RADIAL = 0.81;
// Bilinear filtering can under-read a curved shoreline by a fraction of a
// raster cell. Keep the field query conservative so the canonical continuous
// sampler would still classify every accepted point as broad-top meadow.
const ISLAND_GRASS_FIELD_MAX_SHORE = ISLAND_GRASS_TOP_MAX_RADIAL - 0.018;

/**
 * Semantic budgets, not an invitation to fill the island. World has no grass
 * resident by default; a miniature grass silhouette would cost more than it
 * communicates at that projection.
 */
export const ISLAND_GRASS_LIMITS: Readonly<
  Record<IslandGrassDetail, Readonly<Record<IslandGrassRenderTier, number>>>
> = {
  // One instance is one three-vertex billboard blade, not a five-leaf clump.
  // The cap leaves room for a readable near meadow while keeping the field
  // open: the B candidate uses 24,255 desktop placements, so this is a
  // ceiling rather than an instruction to fill the island.
  course: { desktop: 30000, mobile: 9000 },
  world: { desktop: 0, mobile: 0 },
};

/**
 * Existing look presets still express density in the retired clump units, but
 * one card is one concentrated point rather than five spatially distributed
 * leaves. Keeping the multiplier at one preserves the field's point spacing
 * instead of multiplying a point source by the old leaf count.
 */
export const ISLAND_GRASS_BLADE_DENSITY_MULTIPLIER = 1;

/** Camera-distance LOD bands, measured in the course island's world units. */
export const ISLAND_GRASS_LOD_THRESHOLDS = {
  nearToMid: 48,
  midToNear: 42,
  midToFar: 92,
  farToMid: 82,
} as const;

/**
 * Near keeps the full deterministic blade prefix. Mid keeps 45% of it and
 * lifts it 15% so a smaller silhouette still has readable vertical rhythm.
 * Far is deliberately empty: at the aerial distance, the terrain's meadow
 * colour carries the surface and blade-sized pixels would only become noise.
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
  /** Approximate blade footprint diameter in unscaled blueprint units. */
  readonly width: number;
  /** Base blade height in unscaled blueprint units. */
  readonly height: number;
  readonly rotation: number;
  /** Stable phase for a future wind/material style, never a random runtime id. */
  readonly phase: number;
  /** Retained for pure tests and diagnostics; this is the sampler's top check. */
  readonly radial: number;
  /** CPU-sampled top-surface normal consumed by the billboard vertex shader. */
  readonly groundNormal: readonly [number, number, number];
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
  /** Existing look-preset density, measured in the retired five-leaf clumps. */
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
/** Only the strong meadow portion of the shared field receives blades. */
export const ISLAND_GRASS_DENSITY_THRESHOLD = ISLAND_FIELD_GRASS_CUTOFF;
const ISLAND_GRASS_DENSITY_FULL = 0.9;
/** The measured course top is about 4,900 square units inside its 85 × 112 grid. */
const MEASURED_COURSE_TOP_AREA = 4900;
const DEFAULT_DENSITY: Readonly<Record<IslandGrassRenderTier, number>> = {
  desktop: 23,
  mobile: 6.2,
};
// Grass stops just beyond the soil extent. A small margin keeps blades from
// visually growing through the path while preserving the natural verge.
// Leave room for the widest procedural soil verge, blade half-width, and a
// small wind lean. The extra clearance is deliberately generous in the near
// camera: the road is the learner's reading line, so a soft meadow edge must
// not turn into a green seam across it.
const DEFAULT_ROUTE_GAP = 0.8;
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

/** Read the shared terrain-derived meadow density with bilinear filtering. */
export function islandGrassDensityAt(field: IslandField, x: number, z: number): number {
  return sampleIslandFieldChannel(field, "grass", x, z);
}

function densityAcceptance(density: number): number {
  if (density < ISLAND_GRASS_DENSITY_THRESHOLD) return 0;
  return smoothUnit(
    (density - ISLAND_GRASS_DENSITY_THRESHOLD) /
      (ISLAND_GRASS_DENSITY_FULL - ISLAND_GRASS_DENSITY_THRESHOLD),
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
  field: IslandField,
  point: IslandPoint,
  radial: number,
  zones: readonly IslandGrassSafetyZone[],
  routeClearance: number,
): boolean {
  // The field's shore channel carries the same radial boundary for all
  // consumers. The candidate radial remains as a conservative disk guard.
  const surface = sampleIslandField(field, point.x, point.z);
  if (
    !surface.inside ||
    radial > ISLAND_GRASS_TOP_MAX_RADIAL ||
    surface.shore > ISLAND_GRASS_FIELD_MAX_SHORE
  ) {
    return false;
  }
  if (distanceToIslandRoute(blueprint, point) < routeClearance) return false;
  if (clearanceToSafetyZones(point, zones) < 0) return false;
  return true;
}

interface IslandGrassNormalGrid {
  readonly resolution: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly normals: Float32Array;
}

const ISLAND_GRASS_NORMAL_GRID_RESOLUTION = 32;
const islandGrassNormalGrids = new WeakMap<IslandBlueprint, IslandGrassNormalGrid>();

function rawIslandGrassGroundNormalAt(
  blueprint: IslandBlueprint,
  point: IslandPoint,
): readonly [number, number, number] {
  const centreSample = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
  if (!centreSample.inside) return [0, 1, 0];
  const delta = Math.min(0.45, Math.max(0.08, blueprint.bounds.maxHalf * 0.004));
  const heightAt = (x: number, z: number): number => {
    const sample = sampleIslandTerrainTop(blueprint, "course", x, z);
    return sample.inside ? sample.y : centreSample.y;
  };
  const slopeX =
    (heightAt(point.x + delta, point.z) - heightAt(point.x - delta, point.z)) / (2 * delta);
  const slopeZ =
    (heightAt(point.x, point.z + delta) - heightAt(point.x, point.z - delta)) / (2 * delta);
  const length = Math.hypot(slopeX, 1, slopeZ) || 1;
  return [-slopeX / length, 1 / length, -slopeZ / length];
}

/** Linear blend, used by the cached ground-normal raster below. */
function lerp(first: number, second: number, amount: number): number {
  return first + (second - first) * amount;
}

function islandGrassNormalGridFor(blueprint: IslandBlueprint): IslandGrassNormalGrid {
  const existing = islandGrassNormalGrids.get(blueprint);
  if (existing !== undefined) return existing;

  const resolution = ISLAND_GRASS_NORMAL_GRID_RESOLUTION;
  const normals = new Float32Array(resolution * resolution * 3);
  const halfX = blueprint.bounds.halfX;
  const halfZ = blueprint.bounds.halfZ;
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    const z = lerp(-halfZ, halfZ, zIndex / (resolution - 1));
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const x = lerp(-halfX, halfX, xIndex / (resolution - 1));
      const normal = rawIslandGrassGroundNormalAt(blueprint, { x, z });
      const offset = (zIndex * resolution + xIndex) * 3;
      normals[offset] = normal[0];
      normals[offset + 1] = normal[1];
      normals[offset + 2] = normal[2];
    }
  }
  const grid: IslandGrassNormalGrid = { resolution, halfX, halfZ, normals };
  islandGrassNormalGrids.set(blueprint, grid);
  return grid;
}

/**
 * Return a cached, rendered course-top normal at a grass root without
 * importing Three.js into the serialisable planner. The 32 × 32 finite-
 * difference grid is the cheap CPU equivalent of the donor's terrain normal
 * map: it is built once per blueprint, then bilinearly sampled for every
 * deterministic blade placement. Samples crossing the authored outline fall
 * back to the centre height so an edge blade cannot acquire an inverted normal.
 */
export function islandGrassGroundNormalAt(
  blueprint: IslandBlueprint,
  point: IslandPoint,
): readonly [number, number, number] {
  const grid = islandGrassNormalGridFor(blueprint);
  const xAmount = Math.min(1, Math.max(0, (point.x + grid.halfX) / (grid.halfX * 2)));
  const zAmount = Math.min(1, Math.max(0, (point.z + grid.halfZ) / (grid.halfZ * 2)));
  const xGrid = xAmount * (grid.resolution - 1);
  const zGrid = zAmount * (grid.resolution - 1);
  const x0 = Math.floor(xGrid);
  const z0 = Math.floor(zGrid);
  const x1 = Math.min(grid.resolution - 1, x0 + 1);
  const z1 = Math.min(grid.resolution - 1, z0 + 1);
  const xMix = xGrid - x0;
  const zMix = zGrid - z0;
  const component = (componentIndex: number): number => {
    const at = (x: number, z: number): number =>
      grid.normals[(z * grid.resolution + x) * 3 + componentIndex] ?? 0;
    const near = lerp(at(x0, z0), at(x1, z0), xMix);
    const far = lerp(at(x0, z1), at(x1, z1), xMix);
    return lerp(near, far, zMix);
  };
  const normalX = component(0);
  const normalY = component(1);
  const normalZ = component(2);
  const length = Math.hypot(normalX, normalY, normalZ) || 1;
  return [normalX / length, normalY / length, normalZ / length];
}

/**
 * Plan bounded, deterministic blades. Sampling a disk with `sqrt(u)` is the
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
    Math.round(
      approximateTopArea(blueprint) *
        resolved.density *
        (detail === "course" ? ISLAND_GRASS_BLADE_DENSITY_MULTIPLIER : 1),
    ),
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
  const field = islandFieldFor(blueprint);

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
    const density = islandGrassDensityAt(field, point.x, point.z);
    const acceptance = densityAcceptance(density);
    if (acceptance <= 0 || random() > acceptance) continue;
    if (!isAvailable(blueprint, field, point, radial, resolved.safetyZones, routeClearance))
      continue;
    const surface = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
    // One placement is one billboard blade. Its wider root and deterministic
    // height variation keep the field readable after the five-leaf geometry is
    // removed; the shader supplies the taper and wind bend.
    // Shore and slope add a small structural lift, so clumps near the water
    // and on rough ground break the carpet without adding triangles.
    const fieldSample = sampleIslandField(field, point.x, point.z);
    placements.push({
      x: point.x,
      z: point.z,
      y: surface.y,
      // A blade varies from a short meadow accent to a visibly taller tuft.
      width: 0.6 + random() * 0.24,
      height:
        0.28 +
        random() * 0.34 +
        smoothUnit(fieldSample.shore) * 0.08 +
        smoothUnit(fieldSample.rock) * 0.08,
      rotation: random() * TAU,
      phase: random(),
      radial: surface.radial,
      groundNormal: islandGrassGroundNormalAt(blueprint, point),
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
 * why a candidate is not eligible. It reads the same cached field as the
 * planner and never reads or mutates a terrain mesh.
 */
export function islandGrassPointIsTopSurface(
  blueprint: IslandBlueprint,
  point: IslandPoint,
): boolean {
  const sample = sampleIslandField(islandFieldFor(blueprint), point.x, point.z);
  return sample.inside && sample.shore <= ISLAND_GRASS_FIELD_MAX_SHORE;
}
