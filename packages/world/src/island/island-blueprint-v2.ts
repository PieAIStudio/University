/**
 * Serializable data for one course island.
 *
 * This module deliberately knows nothing about a renderer. A blueprint can be
 * cached, compared in a test, or sent to a worker without bringing a scene
 * graph along with it. The route is always one semantic line, even when its
 * visual shape changes. An arc, loop, or switchback changes placement only;
 * it never becomes a prerequisite graph.
 */
import { hash, seeded } from "./random.js";

export const ISLAND_BLUEPRINT_V2_VERSION = 2 as const;
export const ISLAND_BLUEPRINT_V2_LAYOUT_REVISION = "island-v2-r3" as const;
export const DEFAULT_NATURAL_BASE_PACK_ID_V2 = "nature-kit" as const;

export const ISLAND_ROUTE_ARCHETYPES_V2 = [
  "arc",
  "horseshoe",
  "loop-around-hill",
  "switchback",
  "serpentine",
] as const;

export type IslandRouteSemanticV2 = "linear";
export type IslandRouteArchetypeV2 = (typeof ISLAND_ROUTE_ARCHETYPES_V2)[number];
export type IslandUnitSigilV2 = "leaf" | "wave" | "star" | "shell" | "mountain" | "sun";
export type IslandUnitMotionVariantV2 = "drift" | "pulse" | "orbit" | "sway" | "spark" | "breathe";

export interface IslandThemeSelectionV2 {
  /** Opaque, stable package identity; the catalog assigns its assets later. */
  readonly naturalBasePackId: string;
  /** At most two opaque accent package identities for this island. */
  readonly accentPackIds: readonly string[];
  /** Optional named recipe identity for authored, reusable combinations. */
  readonly recipeId?: string;
}

export interface IslandBlueprintV2Input {
  readonly studyId: string;
  readonly courseId: string;
  /** A fixture may provide a count; real courses should provide lessonIds. */
  readonly lessonCount?: number;
  /** Real lesson identities in teaching order. */
  readonly lessonIds?: readonly string[];
  /** Authored unit identity per lesson; it never affects geometry or themes. */
  readonly unitIds?: readonly string[];
  /** Caller-owned stable seed. If omitted, the stable study/course identity is used. */
  readonly seed?: string;
  /** Changing this value intentionally starts a new layout contract. */
  readonly layoutRevision?: string;
  /** Omit to retain deterministic size/seed selection of the visual shape. */
  readonly routeArchetype?: IslandRouteArchetypeV2;
  /** Omit to use the natural base only. No package is selected randomly. */
  readonly themeSelection?: IslandThemeSelectionV2;
}

export interface IslandPointV2 {
  readonly x: number;
  readonly z: number;
}

export interface IslandOutlinePointV2 extends IslandPointV2 {
  readonly angle: number;
  /** Radius multiplier at `angle`, before the ellipse's half extents. */
  readonly scale: number;
}

export interface IslandUnitVisualTokenV2 {
  /** A semantic palette token; renderers decide its actual colour. */
  readonly palette: string;
  readonly sigil: IslandUnitSigilV2;
  /**
   * State-motion vocabulary for restrained current/completed cues. It is not
   * an instruction that every node should animate continuously.
   */
  readonly motionVariant: IslandUnitMotionVariantV2;
  /** Explicit non-colour distinction, useful when a palette is unavailable. */
  readonly variant: string;
}

export interface IslandRouteNodeV2 extends IslandPointV2 {
  /** The real lesson identity, or a clearly synthetic fixture identity. */
  readonly id: string;
  readonly index: number;
  /** The next lesson identity; `null` marks the single terminal node. */
  readonly next: string | null;
  /** Distance fraction along the one route, from 0 to 1. */
  readonly t: number;
  readonly y: number;
  readonly unitId: string;
  readonly unitIndex: number;
  readonly visualToken: IslandUnitVisualTokenV2;
}

/**
 * A lesson anchor without any lesson or unit identity.  These positions are
 * part of the island geometry contract; semantic nodes are projected onto
 * them by the course view when real ids are available.
 */
export interface IslandGeometryNodeV2 extends IslandPointV2 {
  readonly index: number;
  readonly t: number;
  readonly y: number;
}

export interface IslandCenterlinePointV2 extends IslandPointV2 {
  readonly t: number;
  readonly y: number;
}

export interface IslandRouteV2 {
  readonly semantic: IslandRouteSemanticV2;
  readonly archetype: IslandRouteArchetypeV2;
  /** A linear route has no junctions or branches. */
  readonly branchCount: 0;
  readonly nodeCount: number;
  readonly centerlineSamples: number;
  /** Total width of the walkable road ribbon. */
  readonly roadWidth: number;
  /** Natural shoulder on each side of the road ribbon. */
  readonly shoulderWidth: number;
  /** Radius reserved around each lesson node for hit/readability. */
  readonly nodeRadius: number;
  /** Additional minimum gap beyond the route envelopes. */
  readonly clearance: number;
}

export interface IslandTerrainPatchV2 extends IslandPointV2 {
  readonly id: string;
  readonly radius: number;
  readonly amplitude: number;
  /** Cycles per world unit; deliberately low frequency. */
  readonly frequency: number;
  readonly phase: number;
}

export interface IslandZoneV2 extends IslandPointV2 {
  readonly id: "arrival" | "journey" | "summit";
  readonly radius: number;
  readonly importance: number;
}

export interface IslandHeroV2 extends IslandPointV2 {
  readonly y: number;
  readonly heading: number;
  readonly radius: number;
  readonly importance: number;
}

export interface IslandUndersideV2 {
  readonly depth: number;
  readonly taper: number;
  readonly ringCount: number;
  readonly importance: number;
}

export interface IslandVisibilityImportanceV2 {
  readonly course: number;
  readonly world: number;
}

export interface IslandGeometryBlueprintV2 {
  readonly version: typeof ISLAND_BLUEPRINT_V2_VERSION;
  readonly layoutRevision: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly seed: string;
  readonly lessonCount: number;
  readonly route: IslandRouteV2;
  /** Canonical lesson positions, independent of lesson/unit identities. */
  readonly geometryNodes: readonly IslandGeometryNodeV2[];
  /** A dense rendering guide for the same route; never a second route. */
  readonly centerline: readonly IslandCenterlinePointV2[];
  readonly outline: readonly IslandOutlinePointV2[];
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly maxHalf: number;
  };
  readonly terrainPatches: readonly IslandTerrainPatchV2[];
  readonly zones: readonly IslandZoneV2[];
  /** A composition anchor, deliberately offset from the route by a normal. */
  readonly hero: IslandHeroV2;
  readonly underside: IslandUndersideV2;
  readonly themeSelection: IslandThemeSelectionV2;
  readonly visibilityImportance: IslandVisibilityImportanceV2;
}

/**
 * The renderer-facing compatibility shape.  `nodes` is the semantic
 * extension of the stable geometry base, not a second source of positions.
 */
export interface IslandBlueprintV2 extends IslandGeometryBlueprintV2 {
  /** Canonical lesson markers, projected onto `geometryNodes`. */
  readonly nodes: readonly IslandRouteNodeV2[];
}

export interface IslandSurfaceSampleV2 {
  readonly y: number;
  /** 0 at the island centre and approximately 1 at its authored shoreline. */
  readonly radial: number;
  readonly inside: boolean;
}

export type IslandGeometryBlueprintV2Input = Omit<
  IslandBlueprintV2Input,
  "lessonCount" | "lessonIds" | "unitIds"
> & {
  readonly lessonCount: number;
};

export type IslandSemanticNodesV2Input = Pick<IslandBlueprintV2Input, "lessonIds" | "unitIds">;

export const ISLAND_BLUEPRINT_V2_MIN_NODE_SPACING = 0.5;
export const ISLAND_BLUEPRINT_V2_MIN_CENTERLINE_SPACING = 0.01;

const TAU = Math.PI * 2;
const OUTLINE_SAMPLES = 96;
const MIN_CENTERLINE_SAMPLES = 64;
const MAX_GENERATED_LESSONS = 4096;
const MAX_ACCENT_PACKS = 2;

// These are part of the route contract, not a renderer-specific style tune.
const DEFAULT_ROUTE_WIDTHS = {
  // The road is connective tissue, not a second chain of white geometry.
  // Its warm centre is ~35% of a node diameter; even after the darker natural
  // shoulder is added the whole path stays near 55%.  That leaves visible
  // meadow between forty-one lesson stones instead of drawing one pale tube.
  roadWidth: 0.44,
  shoulderWidth: 0.12,
  nodeRadius: 0.62,
  clearance: 0.38,
} as const;
const HERO_RADIUS = 1.2;
const HERO_EXTRA_GAP = 0.6;

const UNIT_SIGILS: readonly IslandUnitSigilV2[] = [
  "leaf",
  "wave",
  "star",
  "shell",
  "mountain",
  "sun",
];

const UNIT_MOTION_VARIANTS: readonly IslandUnitMotionVariantV2[] = [
  "drift",
  "pulse",
  "orbit",
  "sway",
  "spark",
  "breathe",
];

type RawPoint = IslandPointV2;

interface ResampledPath {
  readonly points: readonly RawPoint[];
  readonly cumulative: readonly number[];
  readonly length: number;
}

interface ResolvedInput {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonCount: number;
  readonly lessonIds?: readonly string[];
  readonly unitIds?: readonly string[];
  readonly seed: string;
  readonly layoutRevision: string;
  readonly routeArchetype?: IslandRouteArchetypeV2;
  readonly themeSelection: IslandThemeSelectionV2;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(from: number, to: number, value: number): number {
  if (from === to) return value < from ? 0 : 1;
  const amount = clamp((value - from) / (to - from), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

/**
 * Pull broad relief toward a few soft shelves without making voxel stairs.
 * The middle 44% of every step remains a slope, so the continuous height rule
 * still gives roads and props a stable surface while the aerial camera can
 * read large, designed landforms instead of one inflated cushion.
 */
function softTerrace(value: number, step: number): number {
  const scaled = Math.max(0, value) / step;
  const level = Math.floor(scaled);
  const fraction = scaled - level;
  return (level + smoothstep(0.28, 0.72, fraction)) * step;
}

function stableString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`IslandBlueprint V2 ${label} must be a non-empty string`);
  }
  return value;
}

function normalizeLessonCount(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RangeError("IslandBlueprint V2 lessonCount must be a positive integer");
  }
  if (value > MAX_GENERATED_LESSONS) {
    throw new RangeError(`IslandBlueprint V2 lessonCount must be at most ${MAX_GENERATED_LESSONS}`);
  }
  return value;
}

function normalizeRevision(value: unknown): string {
  return stableString(value ?? ISLAND_BLUEPRINT_V2_LAYOUT_REVISION, "layoutRevision");
}

function isRouteArchetype(value: unknown): value is IslandRouteArchetypeV2 {
  return (
    typeof value === "string" &&
    ISLAND_ROUTE_ARCHETYPES_V2.includes(value as IslandRouteArchetypeV2)
  );
}

function normalizeIdentityList(
  value: unknown,
  label: string,
  expectedLength?: number,
  unique = true,
): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`IslandBlueprint V2 ${label} must be an array`);
  if (expectedLength !== undefined && value.length !== expectedLength) {
    throw new RangeError(`IslandBlueprint V2 ${label} must contain one id per lesson`);
  }
  const result = value.map((entry, index) => stableString(entry, `${label}[${index}]`));
  if (unique && new Set(result).size !== result.length) {
    throw new RangeError(`IslandBlueprint V2 ${label} must contain unique ids`);
  }
  return result;
}

function normalizeThemeSelection(value: unknown): IslandThemeSelectionV2 {
  if (value === undefined) {
    return {
      naturalBasePackId: DEFAULT_NATURAL_BASE_PACK_ID_V2,
      accentPackIds: [],
    };
  }
  if (!isRecord(value)) throw new TypeError("IslandBlueprint V2 themeSelection must be an object");
  const naturalBasePackId = stableString(
    value.naturalBasePackId,
    "themeSelection.naturalBasePackId",
  );
  if (!Array.isArray(value.accentPackIds)) {
    throw new TypeError("IslandBlueprint V2 themeSelection.accentPackIds must be an array");
  }
  if (value.accentPackIds.length > MAX_ACCENT_PACKS) {
    throw new RangeError("IslandBlueprint V2 themeSelection allows at most two accent packs");
  }
  const accentPackIds = value.accentPackIds.map((entry, index) =>
    stableString(entry, `themeSelection.accentPackIds[${index}]`),
  );
  if (new Set([naturalBasePackId, ...accentPackIds]).size !== accentPackIds.length + 1) {
    throw new RangeError("IslandBlueprint V2 themeSelection pack ids must be unique");
  }
  const recipeId =
    value.recipeId === undefined
      ? undefined
      : stableString(value.recipeId, "themeSelection.recipeId");
  return recipeId === undefined
    ? { naturalBasePackId, accentPackIds }
    : { naturalBasePackId, accentPackIds, recipeId };
}

function resolveInput(input: IslandBlueprintV2Input): ResolvedInput {
  if (!isRecord(input)) throw new TypeError("islandBlueprintV2 needs an input object");

  const studyId = stableString(input.studyId, "studyId");
  const courseId = stableString(input.courseId, "courseId");
  const providedLessonIds =
    input.lessonIds === undefined ? undefined : normalizeIdentityList(input.lessonIds, "lessonIds");
  const countValue = input.lessonCount ?? providedLessonIds?.length;
  if (countValue === undefined) {
    throw new TypeError("IslandBlueprint V2 input needs lessonCount or lessonIds");
  }
  const lessonCount = normalizeLessonCount(countValue);
  if (providedLessonIds !== undefined && providedLessonIds.length !== lessonCount) {
    throw new RangeError("IslandBlueprint V2 lessonIds length must match lessonCount");
  }
  const unitIds =
    input.unitIds === undefined
      ? undefined
      : normalizeIdentityList(input.unitIds, "unitIds", lessonCount, false);
  if (input.routeArchetype !== undefined && !isRouteArchetype(input.routeArchetype)) {
    throw new RangeError("IslandBlueprint V2 routeArchetype is unsupported");
  }
  return {
    studyId,
    courseId,
    lessonCount,
    lessonIds: providedLessonIds,
    unitIds,
    seed: stableString(input.seed ?? `${studyId}/${courseId}`, "seed"),
    layoutRevision: normalizeRevision(input.layoutRevision),
    routeArchetype: input.routeArchetype,
    themeSelection: normalizeThemeSelection(input.themeSelection),
  };
}

/** Pick a visual road shape using content scale and the stable seed. */
export function selectRouteArchetypeV2(
  lessonCount: number,
  seed: string,
  layoutRevision: string = ISLAND_BLUEPRINT_V2_LAYOUT_REVISION,
): IslandRouteArchetypeV2 {
  const count = normalizeLessonCount(lessonCount);
  const safeSeed = stableString(seed, "seed");
  const revision = normalizeRevision(layoutRevision);
  const sizeBand = count <= 5 ? 0 : count <= 15 ? 1 : count <= 30 ? 2 : 3;
  const seedSlot = Math.floor(hash(`${safeSeed}/${revision}/route-archetype`) * 5);
  return ISLAND_ROUTE_ARCHETYPES_V2[(seedSlot + sizeBand + (count % 5)) % 5]!;
}

function rotate(point: RawPoint, angle: number): RawPoint {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.z * sine,
    z: point.x * sine + point.z * cosine,
  };
}

function routeShapePoint(
  archetype: IslandRouteArchetypeV2,
  t: number,
  phase: number,
  lessonCount: number,
): RawPoint {
  const u = t * 2 - 1;
  let x: number;
  let z: number;

  switch (archetype) {
    case "arc":
      x = 0.74 * Math.sin(Math.PI * (t - 0.5));
      z = 1.18 * u;
      break;
    case "horseshoe":
      x = 0.94 * Math.sin(Math.PI * t);
      z = 1.15 * u;
      break;
    case "loop-around-hill": {
      const angle = -Math.PI * 0.55 + Math.PI * 1.72 * t;
      x = 0.9 * Math.cos(angle);
      z = 0.9 * Math.sin(angle);
      break;
    }
    case "switchback": {
      // Spend a long course's distance in several legible folds instead of one
      // sixty-unit lateral sweep. z remains monotonic, so the extra bends are
      // visual composition rather than semantic branches.
      const cycles =
        lessonCount <= 8 ? 0.75 : lessonCount <= 18 ? 1.25 : lessonCount <= 30 ? 1.8 : 2.5;
      x = 0.82 * Math.sin(TAU * cycles * t + phase * 0.22);
      z = 0.95 * u;
      break;
    }
    case "serpentine": {
      const cycles =
        lessonCount <= 8 ? 0.65 : lessonCount <= 18 ? 1.05 : lessonCount <= 30 ? 1.55 : 2.1;
      x =
        0.78 * Math.sin(TAU * cycles * t + phase * 0.32) +
        0.1 * Math.sin(TAU * cycles * 2 * t - phase);
      z = 1.05 * u;
      break;
    }
  }

  return { x, z };
}

function cumulativePath(points: readonly RawPoint[]): ResampledPath {
  const cumulative: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    cumulative.push(
      cumulative[index - 1]! + Math.hypot(current.x - previous.x, current.z - previous.z),
    );
  }
  return { points, cumulative, length: cumulative.at(-1) ?? 0 };
}

function pointAtDistance(path: ResampledPath, fraction: number): RawPoint {
  if (path.points.length === 0) return { x: 0, z: 0 };
  if (path.points.length === 1 || path.length <= Number.EPSILON) return path.points[0]!;

  const target = clamp(fraction, 0, 1) * path.length;
  if (target <= 0) return path.points[0]!;
  if (target >= path.length) return path.points.at(-1)!;

  let low = 1;
  let high = path.cumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (path.cumulative[middle]! < target) low = middle + 1;
    else high = middle;
  }
  const index = low;
  const before = path.points[index - 1]!;
  const after = path.points[index]!;
  const segmentStart = path.cumulative[index - 1]!;
  const segmentLength = path.cumulative[index]! - segmentStart;
  const amount = segmentLength <= Number.EPSILON ? 0 : (target - segmentStart) / segmentLength;
  return { x: lerp(before.x, after.x, amount), z: lerp(before.z, after.z, amount) };
}

function distanceBetween(first: IslandPointV2, second: IslandPointV2): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function outlineScaleAt(outline: readonly IslandOutlinePointV2[], angle: number): number {
  if (outline.length === 0) return 1;
  const wrapped = ((angle % TAU) + TAU) % TAU;
  const at = (wrapped / TAU) * outline.length;
  const floor = Math.floor(at);
  const index = floor % outline.length;
  const next = (index + 1) % outline.length;
  return lerp(outline[index]!.scale, outline[next]!.scale, at - floor);
}

function pointOnSegment(
  point: IslandPointV2,
  first: IslandPointV2,
  second: IslandPointV2,
): boolean {
  const cross =
    (point.z - first.z) * (second.x - first.x) - (point.x - first.x) * (second.z - first.z);
  if (Math.abs(cross) > 1e-7) return false;
  const dot =
    (point.x - first.x) * (point.x - second.x) + (point.z - first.z) * (point.z - second.z);
  return dot <= 1e-7;
}

function pointInsideOutline(point: IslandPointV2, outline: readonly IslandPointV2[]): boolean {
  if (outline.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const current = outline[index]!;
    const before = outline[previous]!;
    if (pointOnSegment(point, before, current)) return true;
    const crosses =
      current.z > point.z !== before.z > point.z &&
      point.x <
        ((before.x - current.x) * (point.z - current.z)) / (before.z - current.z) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function createOutline(
  path: readonly RawPoint[],
  seed: string,
): {
  readonly outline: readonly IslandOutlinePointV2[];
  readonly halfX: number;
  readonly halfZ: number;
} {
  const pathHalfX = path.reduce((maximum, point) => Math.max(maximum, Math.abs(point.x)), 0);
  const pathHalfZ = path.reduce((maximum, point) => Math.max(maximum, Math.abs(point.z)), 0);
  const margin = Math.max(5.5, Math.min(9.5, Math.max(pathHalfX, pathHalfZ) * 0.23));
  // Short courses previously hit an identical 18×18 minimum, so every world
  // icon became the same green coin even though its seed and route differed.
  // A restrained seeded aspect belongs to the blueprint (and therefore both
  // projections), while the route-fit pass below remains the authority that
  // prevents a decorative silhouette from crowding the road.
  const identityAspect = 0.78 + hash(`${seed}/identity-aspect`) * 0.44;
  const aspectX = Math.sqrt(identityAspect);
  const aspectZ = 1 / aspectX;
  const candidateHalfX = Math.max(14, pathHalfX + margin) * aspectX;
  const candidateHalfZ = Math.max(14, pathHalfZ + margin) * aspectZ;
  // Keep the route at roughly 70% of the ellipse radius so a hero can move to
  // a local normal without leaving the authored shoreline.
  const maximumRouteRadius = path.reduce(
    (maximum, point) =>
      Math.max(maximum, Math.hypot(point.x / candidateHalfX, point.z / candidateHalfZ)),
    0,
  );
  const fit = Math.max(1, maximumRouteRadius / 0.7);
  const halfX = candidateHalfX * fit;
  const halfZ = candidateHalfZ * fit;
  const phase = hash(`${seed}/outline`) * TAU;
  const outline = Array.from({ length: OUTLINE_SAMPLES }, (_, index) => {
    const angle = (index / OUTLINE_SAMPLES) * TAU;
    const scale =
      1 +
      Math.sin(angle * 2 + phase) * 0.08 +
      Math.sin(angle * 3 - phase * 0.71) * 0.04 +
      Math.sin(angle * 5 + phase * 0.37) * 0.018;
    return {
      angle,
      scale,
      x: Math.cos(angle) * halfX * scale,
      z: Math.sin(angle) * halfZ * scale,
    };
  });
  return { outline, halfX, halfZ };
}

function createTerrainPatches(
  lessonCount: number,
  seed: string,
  layoutRevision: string,
  halfX: number,
  halfZ: number,
): readonly IslandTerrainPatchV2[] {
  const count = lessonCount <= 6 ? 2 : lessonCount <= 18 ? 3 : 4;
  const random = seeded(`${seed}/${layoutRevision}/terrain-patches`);
  const patches: IslandTerrainPatchV2[] = [];
  const minimumHalf = Math.min(halfX, halfZ);
  const minimumSeparation = minimumHalf * 0.34;
  for (let index = 0; index < count; index += 1) {
    let point: IslandPointV2 | undefined;
    for (let attempt = 0; attempt < 80 && point === undefined; attempt += 1) {
      const angle = random() * TAU;
      const radial = 0.18 + random() * 0.4;
      const candidate = {
        x: Math.cos(angle) * halfX * radial,
        z: Math.sin(angle) * halfZ * radial,
      };
      if (patches.every((patch) => distanceBetween(candidate, patch) >= minimumSeparation)) {
        point = candidate;
      }
    }
    // A deterministic fallback is preferable to two hills accidentally
    // occupying the same patch of ground, which visually cancels the terrain
    // system even though its numeric relief remains non-zero.
    point ??= {
      x: Math.cos((index / count) * TAU) * halfX * 0.42,
      z: Math.sin((index / count) * TAU) * halfZ * 0.42,
    };
    const sign = index % 2 === 0 ? 1 : -1;
    const magnitude = sign > 0 ? 1.08 + random() * 0.46 : 0.58 + random() * 0.34;
    patches.push({
      id: `terrain-${index + 1}`,
      x: point.x,
      z: point.z,
      radius: minimumHalf * (0.28 + random() * 0.12),
      // Alternating broad hills and shallow valleys create readable masses.
      // Units and lesson nodes remain entirely absent from this calculation.
      amplitude: sign * magnitude,
      frequency: 0.025 + random() * 0.035,
      phase: random() * TAU,
    });
  }
  return patches;
}

function sampleCountForLessons(lessonCount: number): number {
  return Math.max(MIN_CENTERLINE_SAMPLES, lessonCount * 8 + 1);
}

function routePhase(seed: string, layoutRevision: string): number {
  return hash(`${seed}/${layoutRevision}/route-phase`) * TAU;
}

/**
 * The physical breathing room each lesson earns along the route.  It grows
 * only slightly with course size: large courses gain folds, not giant lawns.
 */
function desiredNodeSpacing(lessonCount: number): number {
  return 2.18 + Math.min(0.3, Math.sqrt(lessonCount) * 0.047);
}

function routeLengthFactor(archetype: IslandRouteArchetypeV2): number {
  // Tight folds spend more arc length making a turn and need a little more
  // physical scale for two neighbouring lanes to keep their road envelopes
  // apart.  This is still far smaller than scaling every archetype by count.
  if (archetype === "switchback") return 1.65;
  if (archetype === "serpentine") return 1.28;
  return 1;
}

/**
 * Derive visual identity from the unit itself, never from route position or
 * terrain. The motion token names a possible state cue; it does not make all
 * nodes continuously animate.
 */
export function unitVisualTokenV2(
  studyId: string,
  courseId: string,
  unitId: string,
  unitIndex: number,
): IslandUnitVisualTokenV2 {
  const safeStudyId = stableString(studyId, "studyId");
  const safeCourseId = stableString(courseId, "courseId");
  const safeUnitId = stableString(unitId, "unitId");
  if (!Number.isFinite(unitIndex) || !Number.isInteger(unitIndex) || unitIndex < 0) {
    throw new RangeError("IslandBlueprint V2 unitIndex must be a non-negative integer");
  }
  const unitSeed = `${safeStudyId}/${safeCourseId}/${safeUnitId}`;
  return {
    palette: `unit-palette-${Math.floor(hash(`${unitSeed}/palette`) * 8)}`,
    sigil: UNIT_SIGILS[unitIndex % UNIT_SIGILS.length]!,
    motionVariant:
      UNIT_MOTION_VARIANTS[
        (unitIndex + Math.floor(hash(`${unitSeed}/motion`) * UNIT_MOTION_VARIANTS.length)) %
          UNIT_MOTION_VARIANTS.length
      ]!,
    variant: `unit-variant-${unitIndex}`,
  };
}

function unitIdentityForLesson(
  input: ResolvedInput,
  lessonIndex: number,
  seenUnitIndices: Map<string, number>,
): {
  readonly unitId: string;
  readonly unitIndex: number;
  readonly visualToken: IslandUnitVisualTokenV2;
} {
  // This is only a synthetic fixture partition. Real courses pass unitIds;
  // neither form participates in route, terrain, outline, or theme generation.
  const unitId =
    input.unitIds?.[lessonIndex] ??
    `${input.courseId}/fixture-unit-${Math.floor(lessonIndex / 4) + 1}`;
  let unitIndex = seenUnitIndices.get(unitId);
  if (unitIndex === undefined) {
    unitIndex = seenUnitIndices.size;
    seenUnitIndices.set(unitId, unitIndex);
  }
  return {
    unitId,
    unitIndex,
    visualToken: unitVisualTokenV2(input.studyId, input.courseId, unitId, unitIndex),
  };
}

function sampledSurfaceY(blueprint: IslandGeometryBlueprintV2, point: IslandPointV2): number {
  return sampleIslandSurfaceV2(blueprint, point.x, point.z).y;
}

function zoneAround(
  id: IslandZoneV2["id"],
  point: IslandPointV2,
  radius: number,
  importance: number,
): IslandZoneV2 {
  return { id, x: point.x, z: point.z, radius, importance };
}

function makeGeometryBlueprint(input: ResolvedInput): IslandGeometryBlueprintV2 {
  const { studyId, courseId, lessonCount, seed, layoutRevision } = input;
  const archetype =
    input.routeArchetype ?? selectRouteArchetypeV2(lessonCount, seed, layoutRevision);
  const phase = routePhase(seed, layoutRevision);
  const rawCount = Math.max(256, lessonCount * 32 + 1);
  const unitPath = Array.from({ length: rawCount }, (_, index) =>
    routeShapePoint(archetype, index / (rawCount - 1), phase, lessonCount),
  );
  const unitLength = cumulativePath(unitPath).length;
  // Normalise by arc length.  Previously every archetype received the same
  // scale even though a 2.5-cycle switchback is almost twice as long as an
  // arc.  The result was a 153-unit island with four visible nodes and a lawn
  // occupying most of the first screen.  One lesson now buys one stable amount
  // of walking distance, while the archetype decides how that distance folds.
  const desiredLength =
    Math.max(7, Math.max(0, lessonCount - 1) * desiredNodeSpacing(lessonCount)) *
    routeLengthFactor(archetype);
  const routeScale = desiredLength / Math.max(unitLength, Number.EPSILON);
  const scaleX = routeScale * (1 + (hash(`${seed}/${layoutRevision}/route-width`) - 0.5) * 0.08);
  const scaleZ = routeScale * (1 + (hash(`${seed}/${layoutRevision}/route-depth`) - 0.5) * 0.08);
  const orientation = (hash(`${seed}/${layoutRevision}/route-orientation`) - 0.5) * 0.42;
  const rawPath = unitPath.map((point) => {
    return rotate({ x: point.x * scaleX, z: point.z * scaleZ }, orientation);
  });
  const raw = cumulativePath(rawPath);
  const centerlineCount = sampleCountForLessons(lessonCount);
  const centerlineXY = Array.from({ length: centerlineCount }, (_, index) => {
    const t = index / (centerlineCount - 1);
    return { ...pointAtDistance(raw, t), t };
  });
  const nodeXY = Array.from({ length: lessonCount }, (_, index) => {
    const t = lessonCount === 1 ? 0 : index / (lessonCount - 1);
    return { ...pointAtDistance(raw, t), t };
  });
  const { outline, halfX, halfZ } = createOutline(rawPath, `${seed}/${layoutRevision}`);
  const terrainPatches = createTerrainPatches(lessonCount, seed, layoutRevision, halfX, halfZ);
  const route: IslandRouteV2 = {
    semantic: "linear",
    archetype,
    branchCount: 0,
    nodeCount: lessonCount,
    centerlineSamples: centerlineCount,
    ...DEFAULT_ROUTE_WIDTHS,
  };

  const geometryNodes: IslandGeometryNodeV2[] = nodeXY.map((point, index) => ({
    index,
    t: point.t,
    x: point.x,
    y: 0,
    z: point.z,
  }));
  const baseCenterline: IslandCenterlinePointV2[] = centerlineXY.map((point) => ({
    t: point.t,
    x: point.x,
    y: 0,
    z: point.z,
  }));

  const midpoint = geometryNodes[Math.floor((lessonCount - 1) / 2)]!;
  const first = geometryNodes[0]!;
  const last = geometryNodes.at(-1)!;
  // The first authored landmark belongs to the arrival shot.  Putting it at
  // 55% made the course technically decorated but visually empty until the
  // learner had already completed half of it.
  const heroT = lessonCount <= 6 ? 0.42 : 0.12;
  const heroOffset =
    route.roadWidth / 2 +
    route.shoulderWidth +
    route.nodeRadius +
    route.clearance +
    HERO_RADIUS +
    HERO_EXTRA_GAP;
  const preferredHeroFractions = [heroT, 0.08, 0.18, 0.25, 0.35, 0.5, 0.65, 0.75];
  const minimumHeroClearance =
    route.roadWidth / 2 + route.shoulderWidth + route.nodeRadius + route.clearance + HERO_RADIUS;
  let bestHero:
    | {
        readonly point: RawPoint;
        readonly tangent: RawPoint;
        readonly score: number;
        readonly compositionScore: number;
      }
    | undefined;
  for (const fraction of preferredHeroFractions) {
    const routePoint = pointAtDistance(raw, fraction);
    const tangentBefore = pointAtDistance(raw, Math.max(0, fraction - 0.012));
    const tangentAfter = pointAtDistance(raw, Math.min(1, fraction + 0.012));
    const tangentX = tangentAfter.x - tangentBefore.x;
    const tangentZ = tangentAfter.z - tangentBefore.z;
    const tangentLength = Math.hypot(tangentX, tangentZ);
    const tangent =
      tangentLength > Number.EPSILON
        ? { x: tangentX / tangentLength, z: tangentZ / tangentLength }
        : { x: 1, z: 0 };
    const normal = { x: -tangent.z, z: tangent.x };
    const preferredSide = hash(`${seed}/${layoutRevision}/hero-side`) < 0.5 ? -1 : 1;
    for (const side of [preferredSide, -preferredSide]) {
      const point = {
        x: routePoint.x + normal.x * heroOffset * side,
        z: routePoint.z + normal.z * heroOffset * side,
      };
      if (!pointInsideOutline(point, outline)) continue;
      const routeDistance = pointToPolylineDistance(point, rawPath);
      const nodeDistance = Math.min(...geometryNodes.map((node) => distanceBetween(point, node)));
      const score = Math.min(routeDistance, nodeDistance);
      if (score < minimumHeroClearance) continue;
      const compositionScore = score - Math.abs(fraction - heroT) * 3.2;
      if (bestHero === undefined || compositionScore > bestHero.compositionScore) {
        bestHero = { point, tangent, score, compositionScore };
      }
    }
  }
  if (bestHero === undefined) {
    throw new Error("IslandBlueprint V2 could not place hero inside the island outline");
  }
  const zoneRadius = Math.max(3.2, Math.min(7.5, Math.min(halfX, halfZ) * 0.2));

  const base: IslandGeometryBlueprintV2 = {
    version: ISLAND_BLUEPRINT_V2_VERSION,
    layoutRevision,
    studyId,
    courseId,
    seed,
    lessonCount,
    route,
    geometryNodes,
    centerline: baseCenterline,
    outline,
    bounds: { halfX, halfZ, maxHalf: Math.max(halfX, halfZ) },
    terrainPatches,
    zones: [
      zoneAround("arrival", first, zoneRadius, 0.9),
      zoneAround("journey", midpoint, zoneRadius * 1.08, 1),
      zoneAround("summit", last, zoneRadius, 0.95),
    ],
    hero: {
      x: bestHero.point.x,
      y: 0,
      z: bestHero.point.z,
      heading: Math.atan2(bestHero.tangent.z, bestHero.tangent.x),
      radius: HERO_RADIUS,
      importance: 1,
    },
    underside: {
      depth: Math.max(6, Math.min(11, Math.min(halfX, halfZ) * 0.34)),
      taper: 0.72 + hash(`${seed}/${layoutRevision}/underside`) * 0.14,
      ringCount: 3,
      importance: 0.25,
    },
    themeSelection: input.themeSelection,
    visibilityImportance: {
      course: 1,
      world: 0.58 + hash(`${seed}/${layoutRevision}/world-importance`) * 0.14,
    },
  };

  const geometryNodesWithSurface = base.geometryNodes.map((node) => ({
    ...node,
    y: sampledSurfaceY(base, node),
  }));
  const centerline = base.centerline.map((point) => ({
    ...point,
    y: sampledSurfaceY(base, point),
  }));
  return {
    ...base,
    geometryNodes: geometryNodesWithSurface,
    centerline,
    hero: { ...base.hero, y: sampledSurfaceY(base, base.hero) },
  };
}

function projectSemanticNodesV2(
  geometry: IslandGeometryBlueprintV2,
  input: IslandSemanticNodesV2Input,
): readonly IslandRouteNodeV2[] {
  const lessonIds =
    input.lessonIds === undefined
      ? Array.from(
          { length: geometry.lessonCount },
          (_, index) => `${geometry.courseId}/fixture-lesson-${index + 1}`,
        )
      : normalizeIdentityList(input.lessonIds, "lessonIds", geometry.lessonCount);
  const unitIds =
    input.unitIds === undefined
      ? undefined
      : normalizeIdentityList(input.unitIds, "unitIds", geometry.lessonCount, false);
  const resolved: ResolvedInput = {
    studyId: geometry.studyId,
    courseId: geometry.courseId,
    lessonCount: geometry.lessonCount,
    lessonIds,
    unitIds,
    seed: geometry.seed,
    layoutRevision: geometry.layoutRevision,
    routeArchetype: geometry.route.archetype,
    themeSelection: geometry.themeSelection,
  };
  const seenUnitIndices = new Map<string, number>();
  return geometry.geometryNodes.map((point, index) => {
    const unit = unitIdentityForLesson(resolved, index, seenUnitIndices);
    return {
      id: lessonIds[index]!,
      index: point.index,
      next: lessonIds[index + 1] ?? null,
      t: point.t,
      x: point.x,
      y: point.y,
      z: point.z,
      unitId: unit.unitId,
      unitIndex: unit.unitIndex,
      visualToken: unit.visualToken,
    };
  });
}

/** Build the stable serializable island base without any lesson/unit ids. */
export function islandGeometryBlueprintV2(
  input: IslandGeometryBlueprintV2Input,
): IslandGeometryBlueprintV2 {
  return makeGeometryBlueprint(resolveInput(input));
}

/** Project semantic lesson/unit nodes onto an existing stable geometry base. */
export function projectIslandBlueprintV2(
  geometry: IslandGeometryBlueprintV2,
  input: IslandSemanticNodesV2Input = {},
): IslandBlueprintV2 {
  return {
    ...geometry,
    nodes: projectSemanticNodesV2(geometry, input),
  };
}

/**
 * Compatibility API: build the stable base first, then add its semantic node
 * projection. Geometry never sees lesson or unit identities.
 */
export function islandBlueprintV2(input: IslandBlueprintV2Input): IslandBlueprintV2 {
  const resolved = resolveInput(input);
  return projectIslandBlueprintV2(makeGeometryBlueprint(resolved), {
    lessonIds: resolved.lessonIds,
    unitIds: resolved.unitIds,
  });
}

/** Remove the semantic node projection for a stable deep-equality comparison. */
export function islandGeometryProjectionV2(
  blueprint: IslandBlueprintV2,
): IslandGeometryBlueprintV2 {
  const { nodes: _nodes, ...geometry } = blueprint;
  return geometry;
}

/** The continuous height rule shared by nodes, terrain, and future render LODs. */
export function sampleIslandSurfaceV2(
  blueprint: IslandGeometryBlueprintV2,
  x: number,
  z: number,
): IslandSurfaceSampleV2 {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { y: 0, radial: Number.POSITIVE_INFINITY, inside: false };
  }
  const normalX = x / blueprint.bounds.halfX;
  const normalZ = z / blueprint.bounds.halfZ;
  const angle = Math.atan2(normalZ, normalX);
  const edgeScale = outlineScaleAt(blueprint.outline, angle);
  const radial = Math.hypot(normalX, normalZ) / edgeScale;
  const inside = pointInsideOutline({ x, z }, blueprint.outline);
  if (!inside) return { y: 0, radial, inside: false };

  const edge = clamp(1 - radial, 0, 1);
  // Most of the island is a broad playable plateau; only the outer ~17% rolls
  // into the cliff. Applying smoothstep across the whole radius made a dome,
  // which the aerial camera reads as a concave green bowl.
  const shore = clamp(edge / 0.17, 0, 1);
  const plateau = shore * shore * (3 - 2 * shore);
  const basePhase = blueprint.terrainPatches[0]?.phase ?? 0;
  // A level land mass plus broad patches gives visible hills and shallow
  // valleys without making the lesson road a roller-coaster.
  let y = plateau * (2.35 + Math.sin(normalX * 1.7 + basePhase) * 0.1);
  for (const patch of blueprint.terrainPatches) {
    const distance = distanceBetween({ x, z }, patch);
    const influence = Math.exp(-1.35 * (distance / patch.radius) ** 2);
    const lowFrequency =
      0.78 +
      0.22 *
        Math.sin((x - patch.x) * patch.frequency + patch.phase) *
        Math.cos((z - patch.z) * patch.frequency * 0.83 - patch.phase);
    y += plateau * patch.amplitude * influence * lowFrequency;
  }
  // Terracing belongs to the natural base, never to units.  It follows the
  // continuous relief and fades before the shoreline, so it creates broad
  // hill shelves in arbitrary places rather than six chapter-shaped zones or
  // a bullseye of concentric rings.
  const terraceInfluence = smoothstep(0.9, 0.73, radial) * 0.72;
  y = lerp(y, softTerrace(y, 0.46), terraceInfluence);
  return { y: clamp(y, 0, 4.35), radial, inside: true };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finitePoint(value: unknown): value is IslandPointV2 {
  return isRecord(value) && finiteNumber(value.x) && finiteNumber(value.z);
}

function polygonArea(outline: readonly IslandPointV2[]): number {
  let area = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function orientation(first: IslandPointV2, second: IslandPointV2, third: IslandPointV2): number {
  return (second.x - first.x) * (third.z - first.z) - (second.z - first.z) * (third.x - first.x);
}

function segmentsIntersect(
  first: IslandPointV2,
  second: IslandPointV2,
  third: IslandPointV2,
  fourth: IslandPointV2,
): boolean {
  const ab = orientation(first, second, third);
  const ac = orientation(first, second, fourth);
  const cd = orientation(third, fourth, first);
  const ce = orientation(third, fourth, second);
  const epsilon = 1e-7;
  if (Math.abs(ab) <= epsilon && pointOnSegment(third, first, second)) return true;
  if (Math.abs(ac) <= epsilon && pointOnSegment(fourth, first, second)) return true;
  if (Math.abs(cd) <= epsilon && pointOnSegment(first, third, fourth)) return true;
  if (Math.abs(ce) <= epsilon && pointOnSegment(second, third, fourth)) return true;
  return ab > 0 !== ac > 0 && cd > 0 !== ce > 0;
}

function pointToSegmentDistance(
  point: IslandPointV2,
  first: IslandPointV2,
  second: IslandPointV2,
): number {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared <= Number.EPSILON
      ? 0
      : clamp(((point.x - first.x) * dx + (point.z - first.z) * dz) / lengthSquared, 0, 1);
  return distanceBetween(point, { x: first.x + dx * amount, z: first.z + dz * amount });
}

function segmentToSegmentDistance(
  firstStart: IslandPointV2,
  firstEnd: IslandPointV2,
  secondStart: IslandPointV2,
  secondEnd: IslandPointV2,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
  return Math.min(
    pointToSegmentDistance(firstStart, secondStart, secondEnd),
    pointToSegmentDistance(firstEnd, secondStart, secondEnd),
    pointToSegmentDistance(secondStart, firstStart, firstEnd),
    pointToSegmentDistance(secondEnd, firstStart, firstEnd),
  );
}

function pointToPolylineDistance(point: IslandPointV2, path: readonly IslandPointV2[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    minimum = Math.min(minimum, pointToSegmentDistance(point, path[index - 1]!, path[index]!));
  }
  return path.length === 1 ? distanceBetween(point, path[0]!) : minimum;
}

type RouteDimensions = Pick<
  IslandRouteV2,
  "roadWidth" | "shoulderWidth" | "nodeRadius" | "clearance"
>;

function hasRouteWidths(
  route: Record<string, unknown> | undefined,
): route is Record<string, unknown> & RouteDimensions {
  return (
    route !== undefined &&
    finiteNumber(route.roadWidth) &&
    finiteNumber(route.shoulderWidth) &&
    finiteNumber(route.nodeRadius) &&
    finiteNumber(route.clearance)
  );
}

function requiredRouteSeparation(route: RouteDimensions): number {
  // Two route envelopes include road, both shoulders, both node/readability
  // reservations, then the authored extra gap.
  return route.roadWidth + route.shoulderWidth * 2 + route.nodeRadius * 2 + route.clearance;
}

function requiredNodeSeparation(route: RouteDimensions): number {
  return route.nodeRadius * 2 + route.clearance;
}

function addFiniteNumberIssues(
  value: unknown,
  path: string,
  errors: string[],
  seen: WeakSet<object>,
): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`finite: ${path} must be finite`);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => addFiniteNumberIssues(item, `${path}[${index}]`, errors, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    addFiniteNumberIssues(item, `${path}.${key}`, errors, seen);
  }
}

function addPointIssues(
  value: unknown,
  path: string,
  errors: string[],
  outline: readonly IslandPointV2[],
): value is IslandPointV2 {
  if (!finitePoint(value)) {
    errors.push(`point: ${path} must contain finite x and z`);
    return false;
  }
  if (!pointInsideOutline(value, outline)) errors.push(`inside: ${path} must be inside outline`);
  return true;
}

function addStableIdIssues(
  value: unknown,
  path: string,
  errors: string[],
  seen: Set<string>,
): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`identity: ${path} must be a non-empty string`);
    return false;
  }
  if (seen.has(value)) {
    errors.push(`identity: ${path} must be unique`);
    return false;
  }
  seen.add(value);
  return true;
}

function validateThemeSelection(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("themeSelection: missing theme selection");
    return;
  }
  const natural = value.naturalBasePackId;
  if (typeof natural !== "string" || natural.trim().length === 0) {
    errors.push("themeSelection.naturalBasePackId: must be a non-empty stable pack id");
  }
  const accents = value.accentPackIds;
  if (!Array.isArray(accents)) {
    errors.push("themeSelection.accentPackIds: must be an array");
  } else {
    if (accents.length > MAX_ACCENT_PACKS) {
      errors.push("themeSelection.accentPackIds: at most two accent packs are allowed");
    }
    const packIds = new Set<string>();
    if (typeof natural === "string" && natural.trim().length > 0) packIds.add(natural);
    accents.forEach((accent, index) => {
      if (typeof accent !== "string" || accent.trim().length === 0) {
        errors.push(`themeSelection.accentPackIds[${index}]: must be a non-empty stable pack id`);
      } else if (packIds.has(accent)) {
        errors.push(`themeSelection.accentPackIds[${index}]: pack ids must be unique`);
      } else {
        packIds.add(accent);
      }
    });
  }
  if (
    value.recipeId !== undefined &&
    (typeof value.recipeId !== "string" || value.recipeId.trim().length === 0)
  ) {
    errors.push("themeSelection.recipeId: must be a non-empty stable string when present");
  }
}

export type IslandBlueprintV2Validation = readonly string[];

/** Check invariants that keep V2 one stable, walkable, serializable road. */
export function validateIslandBlueprintV2(input: unknown): IslandBlueprintV2Validation {
  const errors: string[] = [];
  if (!isRecord(input)) return ["shape: blueprint must be an object"];
  const blueprint = input;
  addFiniteNumberIssues(blueprint, "blueprint", errors, new WeakSet<object>());

  if (blueprint.version !== ISLAND_BLUEPRINT_V2_VERSION) errors.push("version: expected V2");
  if (typeof blueprint.layoutRevision !== "string" || blueprint.layoutRevision.trim() === "") {
    errors.push("layoutRevision: must be a non-empty explicit revision");
  }
  for (const key of ["studyId", "courseId", "seed"] as const) {
    if (typeof blueprint[key] !== "string" || blueprint[key].trim().length === 0) {
      errors.push(`${key}: must be a non-empty stable string`);
    }
  }

  const lessonCount = blueprint.lessonCount;
  const hasLessonCount =
    finiteNumber(lessonCount) && Number.isInteger(lessonCount) && lessonCount >= 1;
  if (!hasLessonCount) errors.push("lessonCount: must be a positive integer");

  const outlineValues = Array.isArray(blueprint.outline) ? blueprint.outline : [];
  const outline = outlineValues.filter(finitePoint);
  if (!Array.isArray(blueprint.outline) || outlineValues.length < 16) {
    errors.push("outline: needs at least 16 points");
  } else if (outline.length !== outlineValues.length) {
    errors.push("outline: every point must contain finite x and z");
  } else if (polygonArea(outline) <= 1) {
    errors.push("outline: must enclose a non-zero area");
  }

  if (!isRecord(blueprint.bounds)) {
    errors.push("bounds: missing half extents");
  } else if (
    !finiteNumber(blueprint.bounds.halfX) ||
    !finiteNumber(blueprint.bounds.halfZ) ||
    !finiteNumber(blueprint.bounds.maxHalf) ||
    blueprint.bounds.halfX <= 0 ||
    blueprint.bounds.halfZ <= 0 ||
    blueprint.bounds.maxHalf < Math.max(blueprint.bounds.halfX, blueprint.bounds.halfZ)
  ) {
    errors.push("bounds: halfX, halfZ and maxHalf must be positive finite extents");
  }

  const route = isRecord(blueprint.route) ? blueprint.route : undefined;
  const routeHasWidths = hasRouteWidths(route);
  if (route === undefined) {
    errors.push("route: missing route metadata");
  } else {
    if (route.semantic !== "linear") errors.push("route.semantic: must be linear");
    if (!isRouteArchetype(route.archetype)) errors.push("route.archetype: unsupported archetype");
    if (route.branchCount !== 0) errors.push("route.branchCount: linear routes cannot branch");
    if (!hasLessonCount || route.nodeCount !== lessonCount) {
      errors.push("route.nodeCount: must match lessonCount");
    }
    if (
      !finiteNumber(route.centerlineSamples) ||
      !Number.isInteger(route.centerlineSamples) ||
      route.centerlineSamples < 1
    ) {
      errors.push("route.centerlineSamples: must be a positive integer");
    }
    if (!routeHasWidths) {
      errors.push("route: roadWidth, shoulderWidth, nodeRadius, and clearance are required");
    } else {
      if (route.roadWidth <= 0) errors.push("route.roadWidth: must be positive");
      if (route.shoulderWidth < 0) errors.push("route.shoulderWidth: must be non-negative");
      if (route.nodeRadius <= 0) errors.push("route.nodeRadius: must be positive");
      if (route.clearance <= 0) errors.push("route.clearance: must be positive");
    }
  }

  const centerline = Array.isArray(blueprint.centerline) ? blueprint.centerline : [];
  if (
    !hasLessonCount ||
    centerline.length < Math.max(MIN_CENTERLINE_SAMPLES, Number(lessonCount) * 4 + 1)
  ) {
    errors.push("centerline: must be densely sampled");
  }
  let previousCenterline: IslandCenterlinePointV2 | undefined;
  let previousCenterlineT = -1;
  centerline.forEach((point, index) => {
    if (!isRecord(point)) {
      errors.push(`centerline[${index}]: must be an object`);
      return;
    }
    if (!finiteNumber(point.t) || point.t <= previousCenterlineT || point.t < 0 || point.t > 1) {
      errors.push(`centerline[${index}].t: must be strictly increasing in [0, 1]`);
    }
    if (finiteNumber(point.t)) previousCenterlineT = point.t;
    if (addPointIssues(point, `centerline[${index}]`, errors, outline)) {
      if (
        previousCenterline &&
        distanceBetween(previousCenterline, point) < ISLAND_BLUEPRINT_V2_MIN_CENTERLINE_SPACING
      ) {
        errors.push(`centerline[${index}]: duplicate/near-duplicate point`);
      }
      previousCenterline = point as unknown as IslandCenterlinePointV2;
    }
  });
  if (
    route &&
    Array.isArray(blueprint.centerline) &&
    route.centerlineSamples !== centerline.length
  ) {
    errors.push("route.centerlineSamples: must match centerline length");
  }

  const geometryNodes = Array.isArray(blueprint.geometryNodes) ? blueprint.geometryNodes : [];
  if (!hasLessonCount || geometryNodes.length !== lessonCount) {
    errors.push("geometryNodes: count must match lessonCount");
  }
  geometryNodes.forEach((node, index) => {
    if (!isRecord(node)) {
      errors.push(`geometryNodes[${index}]: must be an object`);
      return;
    }
    if (node.index !== index) {
      errors.push(`geometryNodes[${index}].index: must preserve teaching order`);
    }
    if (!finiteNumber(node.t) || node.t < 0 || node.t > 1) {
      errors.push(`geometryNodes[${index}].t: must be finite in [0, 1]`);
    }
    if (!finitePoint(node)) {
      errors.push(`point: geometryNodes[${index}] must contain finite x and z`);
    }
  });

  const nodes = Array.isArray(blueprint.nodes) ? blueprint.nodes : [];
  if (!hasLessonCount || nodes.length !== lessonCount)
    errors.push("nodes: count must match lessonCount");
  const nodeIds = new Set<string>();
  const nodeValues: IslandRouteNodeV2[] = [];
  const unitTokens = new Map<
    string,
    { readonly unitIndex: number; readonly visualToken: IslandUnitVisualTokenV2 }
  >();
  let previousNode: IslandRouteNodeV2 | undefined;
  let previousNodeT = -1;
  nodes.forEach((node, index) => {
    if (!isRecord(node)) {
      errors.push(`nodes[${index}]: must be an object`);
      return;
    }
    nodeValues.push(node as unknown as IslandRouteNodeV2);
    const geometryNode = geometryNodes[index];
    if (isRecord(geometryNode)) {
      for (const key of ["index", "t", "x", "y", "z"] as const) {
        if (node[key] !== geometryNode[key]) {
          errors.push(`nodes[${index}].${key}: must match geometryNodes`);
        }
      }
    }
    if (node.index !== index) errors.push(`nodes[${index}].index: must preserve teaching order`);
    addStableIdIssues(node.id, `nodes[${index}].id`, errors, nodeIds);
    if (node.next !== (index + 1 < nodes.length ? nodes[index + 1]?.id : null)) {
      errors.push(`nodes[${index}].next: must point to the next lesson or null at the end`);
    }
    if (typeof node.unitId !== "string" || node.unitId.trim().length === 0) {
      errors.push(`nodes[${index}].unitId: must be a non-empty stable identity`);
    }
    if (!finiteNumber(node.unitIndex) || !Number.isInteger(node.unitIndex) || node.unitIndex < 0) {
      errors.push(`nodes[${index}].unitIndex: must be a non-negative integer`);
    }
    if (!isRecord(node.visualToken)) {
      errors.push(`nodes[${index}].visualToken: missing unit visual token`);
    } else {
      const token = node.visualToken;
      if (
        typeof token.palette !== "string" ||
        typeof token.sigil !== "string" ||
        typeof token.motionVariant !== "string" ||
        typeof token.variant !== "string"
      ) {
        errors.push(
          `nodes[${index}].visualToken: palette, sigil, motionVariant, and variant are required`,
        );
      }
      if (
        typeof blueprint.studyId === "string" &&
        typeof blueprint.courseId === "string" &&
        typeof node.unitId === "string" &&
        finiteNumber(node.unitIndex) &&
        Number.isInteger(node.unitIndex) &&
        node.unitIndex >= 0
      ) {
        try {
          const expected = unitVisualTokenV2(
            blueprint.studyId,
            blueprint.courseId,
            node.unitId,
            node.unitIndex,
          );
          if (
            token.palette !== expected.palette ||
            token.sigil !== expected.sigil ||
            token.motionVariant !== expected.motionVariant ||
            token.variant !== expected.variant
          ) {
            errors.push(`nodes[${index}].visualToken: token is not derived from unit identity`);
          }
        } catch {
          errors.push(`nodes[${index}].visualToken: unit identity is invalid`);
        }
      }
      if (typeof node.unitId === "string" && finiteNumber(node.unitIndex)) {
        const previousUnit = unitTokens.get(node.unitId);
        if (previousUnit) {
          if (
            previousUnit.unitIndex !== node.unitIndex ||
            previousUnit.visualToken.palette !== token.palette ||
            previousUnit.visualToken.sigil !== token.sigil ||
            previousUnit.visualToken.motionVariant !== token.motionVariant ||
            previousUnit.visualToken.variant !== token.variant
          ) {
            errors.push(`nodes[${index}].visualToken: same unit must keep one stable token`);
          }
        } else {
          unitTokens.set(node.unitId, {
            unitIndex: node.unitIndex,
            visualToken: token as unknown as IslandUnitVisualTokenV2,
          });
        }
      }
    }
    if (!finiteNumber(node.t) || node.t <= previousNodeT || node.t < 0 || node.t > 1) {
      errors.push(`nodes[${index}].t: must be strictly increasing in [0, 1]`);
    }
    if (finiteNumber(node.t)) previousNodeT = node.t;
    if (addPointIssues(node, `nodes[${index}]`, errors, outline)) {
      if (
        previousNode &&
        routeHasWidths &&
        distanceBetween(previousNode, node) < requiredNodeSeparation(route!)
      ) {
        errors.push(`nodes[${index}]: consecutive nodes violate node radius/clearance`);
      }
      previousNode = node as unknown as IslandRouteNodeV2;
    }
  });

  const unitEntries = [...unitTokens.values()];
  for (let first = 0; first < unitEntries.length; first += 1) {
    for (let second = first + 1; second < unitEntries.length; second += 1) {
      const left = unitEntries[first]!.visualToken;
      const right = unitEntries[second]!.visualToken;
      if (
        left.sigil === right.sigil &&
        left.motionVariant === right.motionVariant &&
        left.variant === right.variant
      ) {
        errors.push("nodes.visualToken: different units need a non-colour distinction");
      }
    }
  }

  const centerlinePoints = centerline.filter(finitePoint);
  if (
    centerlinePoints.length === centerline.length &&
    centerlinePoints.length > 1 &&
    routeHasWidths
  ) {
    if (centerlinePoints.length <= 1024) {
      const requiredGap = requiredRouteSeparation(route!);
      const centerlineCumulative: number[] = [0];
      for (let index = 1; index < centerlinePoints.length; index += 1) {
        centerlineCumulative.push(
          centerlineCumulative[index - 1]! +
            distanceBetween(centerlinePoints[index - 1]!, centerlinePoints[index]!),
        );
      }
      const centerlineLength = centerlineCumulative.at(-1) ?? 0;
      if (requiredGap > centerlineLength * 0.35) {
        errors.push("route: required clearance is too large for the route scale");
      }
      const lessonSectionCount = Math.max(1, Number(lessonCount) - 1);
      const minimumSegmentIndexGap = Math.max(
        6,
        Math.ceil((centerlinePoints.length - 1) / lessonSectionCount) * 2,
      );
      for (let first = 0; first + 1 < centerlinePoints.length; first += 1) {
        for (let second = first + 2; second + 1 < centerlinePoints.length; second += 1) {
          const firstStart = centerlinePoints[first]!;
          const firstEnd = centerlinePoints[first + 1]!;
          const secondStart = centerlinePoints[second]!;
          const secondEnd = centerlinePoints[second + 1]!;
          const distance = segmentToSegmentDistance(firstStart, firstEnd, secondStart, secondEnd);
          if (distance <= 1e-7) {
            errors.push(`route: centerline self-intersects at segments ${first}/${second}`);
          } else if (
            second - first >= minimumSegmentIndexGap &&
            centerlineCumulative[second]! - centerlineCumulative[first]! > requiredGap * 1.5 &&
            distance < requiredGap
          ) {
            errors.push(
              `route: non-adjacent segments ${first}/${second} need ${requiredGap.toFixed(3)} clearance`,
            );
          }
        }
      }
    }
  }

  if (centerlinePoints.length > 1) {
    for (const node of nodeValues) {
      const nodeRouteTolerance = routeHasWidths ? route!.roadWidth * 0.25 : 0.1;
      if (
        finitePoint(node) &&
        pointToPolylineDistance(node, centerlinePoints) > nodeRouteTolerance
      ) {
        errors.push(`nodes[${node.index}]: must lie on the route centerline`);
      }
    }
  }

  const patches = Array.isArray(blueprint.terrainPatches) ? blueprint.terrainPatches : [];
  if (patches.length < 2 || patches.length > 4) {
    errors.push("terrainPatches: expected 2 to 4 patches");
  }
  const patchIds = new Set<string>();
  patches.forEach((patch, index) => {
    if (!isRecord(patch)) {
      errors.push(`terrainPatches[${index}]: must be an object`);
      return;
    }
    addStableIdIssues(patch.id, `terrainPatches[${index}].id`, errors, patchIds);
    addPointIssues(patch, `terrainPatches[${index}]`, errors, outline);
    if (!finiteNumber(patch.radius) || patch.radius <= 0) {
      errors.push(`terrainPatches[${index}].radius: must be positive`);
    }
    if (!finiteNumber(patch.amplitude) || Math.abs(patch.amplitude) < 0.1) {
      errors.push(`terrainPatches[${index}].amplitude: must provide visible relief`);
    }
    if (!finiteNumber(patch.frequency) || patch.frequency <= 0 || patch.frequency > 0.5) {
      errors.push(`terrainPatches[${index}].frequency: must remain low-frequency (0, 0.5]`);
    }
    if (!finiteNumber(patch.phase)) errors.push(`terrainPatches[${index}].phase: must be finite`);
  });

  const zones = Array.isArray(blueprint.zones) ? blueprint.zones : [];
  if (zones.length < 3) errors.push("zones: arrival, journey, and summit are required");
  const zoneIds = new Set<string>();
  zones.forEach((zone, index) => {
    if (!isRecord(zone)) {
      errors.push(`zones[${index}]: must be an object`);
      return;
    }
    addStableIdIssues(zone.id, `zones[${index}].id`, errors, zoneIds);
    addPointIssues(zone, `zones[${index}]`, errors, outline);
    if (!finiteNumber(zone.radius) || zone.radius <= 0) {
      errors.push(`zones[${index}].radius: must be positive`);
    }
    if (!finiteNumber(zone.importance) || zone.importance < 0 || zone.importance > 1) {
      errors.push(`zones[${index}].importance: must be in [0, 1]`);
    }
  });

  const hero = blueprint.hero;
  const heroRecord = isRecord(hero) ? hero : undefined;
  const heroIsPoint =
    heroRecord !== undefined && addPointIssues(heroRecord, "hero", errors, outline);
  if (!heroIsPoint) {
    errors.push("hero: missing position");
  } else {
    for (const key of ["y", "heading", "radius", "importance"] as const) {
      if (!finiteNumber(heroRecord[key])) errors.push(`hero.${key}: must be finite`);
    }
    if (finiteNumber(heroRecord.radius) && heroRecord.radius <= 0) {
      errors.push("hero.radius: must be positive");
    }
    if (
      finiteNumber(heroRecord.importance) &&
      (heroRecord.importance < 0 || heroRecord.importance > 1)
    ) {
      errors.push("hero.importance: must be in [0, 1]");
    }
    if (routeHasWidths && centerlinePoints.length > 1 && finiteNumber(heroRecord.radius)) {
      const routeGap =
        route!.roadWidth / 2 +
        route!.shoulderWidth +
        route!.nodeRadius +
        route!.clearance +
        heroRecord.radius;
      if (pointToPolylineDistance(heroRecord, centerlinePoints) < routeGap) {
        errors.push(`hero: must stay at least ${routeGap.toFixed(3)} from the route centerline`);
      }
      const nodeGap = route!.nodeRadius + heroRecord.radius + route!.clearance;
      for (const node of nodeValues) {
        if (finitePoint(node) && distanceBetween(heroRecord, node) < nodeGap) {
          errors.push(`hero: must stay at least ${nodeGap.toFixed(3)} from lesson nodes`);
          break;
        }
      }
    }
  }

  if (!isRecord(blueprint.underside)) {
    errors.push("underside: missing low-detail underside data");
  } else {
    if (!finiteNumber(blueprint.underside.depth) || blueprint.underside.depth <= 0) {
      errors.push("underside.depth: must be positive");
    }
    if (
      !finiteNumber(blueprint.underside.taper) ||
      blueprint.underside.taper <= 0 ||
      blueprint.underside.taper > 1
    ) {
      errors.push("underside.taper: must be in (0, 1]");
    }
    if (!finiteNumber(blueprint.underside.ringCount) || blueprint.underside.ringCount < 1) {
      errors.push("underside.ringCount: must be positive");
    }
    if (
      !finiteNumber(blueprint.underside.importance) ||
      blueprint.underside.importance < 0 ||
      blueprint.underside.importance > 1
    ) {
      errors.push("underside.importance: must be in [0, 1]");
    }
  }

  validateThemeSelection(blueprint.themeSelection, errors);
  if (!isRecord(blueprint.visibilityImportance)) {
    errors.push("visibilityImportance: course/world importance is required");
  } else {
    for (const key of ["course", "world"] as const) {
      const value = blueprint.visibilityImportance[key];
      if (!finiteNumber(value) || value < 0 || value > 1) {
        errors.push(`visibilityImportance.${key}: must be in [0, 1]`);
      }
    }
  }

  if (
    typeof blueprint.studyId === "string" &&
    typeof blueprint.courseId === "string" &&
    typeof blueprint.seed === "string" &&
    typeof blueprint.layoutRevision === "string" &&
    hasLessonCount &&
    route !== undefined &&
    isRouteArchetype(route.archetype) &&
    isRecord(blueprint.themeSelection)
  ) {
    try {
      const regenerated = islandBlueprintV2({
        studyId: blueprint.studyId,
        courseId: blueprint.courseId,
        lessonCount: lessonCount as number,
        lessonIds:
          nodes.length === lessonCount &&
          nodes.every((node) => isRecord(node) && typeof node.id === "string")
            ? nodes.map((node) => (node as Record<string, unknown>).id as string)
            : undefined,
        unitIds:
          nodes.length === lessonCount &&
          nodes.every((node) => isRecord(node) && typeof node.unitId === "string")
            ? nodes.map((node) => (node as Record<string, unknown>).unitId as string)
            : undefined,
        seed: blueprint.seed,
        layoutRevision: blueprint.layoutRevision,
        routeArchetype: route.archetype as IslandRouteArchetypeV2,
        themeSelection: blueprint.themeSelection as unknown as IslandThemeSelectionV2,
      });
      if (JSON.stringify(regenerated) !== JSON.stringify(blueprint)) {
        errors.push("determinism: blueprint does not reproduce from its stable inputs");
      }
    } catch {
      errors.push("determinism: stable inputs could not regenerate blueprint");
    }
  }

  return errors;
}
