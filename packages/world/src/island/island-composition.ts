/**
 * Semantic landscape assemblies: one definition, one fitted pad, all-or-none.
 *
 * Reads the shared IslandField (ADR-0009). Does not import island-dressing;
 * route distance lives in island-route-geometry.ts so the two planners
 * cannot form a runtime cycle.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { sampleIslandSurface } from "./island-blueprint.js";
import type { IslandAssetPackId } from "./island-asset-registry.js";
import type { IslandField } from "./island-field.js";
import { sampleIslandField } from "./island-field.js";
import { seeded } from "./random.js";
import {
  distanceToIslandRoute,
  islandRouteAnchorFromFrame,
  islandRouteClearance,
  islandRouteFrameAtFraction,
  islandRouteFrameAtIndex,
  islandRouteIndexNear,
  yawAligningLocalX,
  yawAligningLocalZ,
  yawToWorld,
  type IslandRouteAnchor,
} from "./island-route-geometry.js";

/**
 * World-space AABB of registered models after node transforms, before kit
 * unit-height normalisation. Kit then centres XZ, sits the base on y=0, and
 * scales by `placement.height / size.y`.
 *
 * Measured 2026-09-06 from the checked-in R01 / elemental-serenity GLBs.
 */
export const COMPOSITION_SOURCE_EXTENTS = {
  wall: { x: 0.1, y: 1, z: 1 },
  "wall-doorway-square": { x: 0.1, y: 1, z: 1 },
  "wall-corner": { x: 1, y: 1, z: 1 },
  roof: { x: 1.0671, y: 0.6483, z: 1 },
  "roof-gable": { x: 1.1, y: 0.5707, z: 1.0707 },
  camp: { x: 2.696, y: 0.7302, z: 2.5027 },
  tent: { x: 4.9921, y: 4.8199, z: 7.213 },
  bridge: { x: 11.0779, y: 3.5854, z: 5.0736 },
  "fountain-round": { x: 2, y: 0.28, z: 2 },
  stall: { x: 0.65, y: 0.3655, z: 1 },
  "stall-bench": { x: 0.26, y: 0.2255014, z: 0.94 },
  cart: { x: 0.8930242, y: 0.5355014, z: 1.34 },
  lantern: { x: 0.2164, y: 1.556, z: 0.2243 },
  rock_largeA: { x: 0.7849, y: 0.2598, z: 1.0155 },
  rock_smallA: { x: 0.3608, y: 0.1912, z: 0.3608 },
} as const;

export type CompositionAssetId = keyof typeof COMPOSITION_SOURCE_EXTENTS;

const ACADEMY_WALL_HEIGHT = 2.3;
const ACADEMY_SCALE = ACADEMY_WALL_HEIGHT / COMPOSITION_SOURCE_EXTENTS.wall.y;
const ELEMENTAL_SERENITY_PACK = "elemental-serenity" as const;

export const COMPOSITION_SCALES = {
  camp: { height: 0.32, state: "lit" as const },
  tent: { height: 1.95 },
  academyWall: { height: ACADEMY_WALL_HEIGHT },
  academyRoof: {
    height: COMPOSITION_SOURCE_EXTENTS.roof.y * ACADEMY_SCALE,
    lift: ACADEMY_WALL_HEIGHT,
  },
  academyRoofGable: {
    height: COMPOSITION_SOURCE_EXTENTS["roof-gable"].y * ACADEMY_SCALE,
    lift: ACADEMY_WALL_HEIGHT,
  },
  bridge: { height: 1.14 },
} as const;

/** Rigid Kenney walls cannot follow a hillside; this is a foundation pad, not a wall-height cliff. */
const RIGID_PAD_SPAN = 0.22;
const RIGID_PAD_SLOPE = 0.12;
const CAMP_PAD_SPAN = 0.38;
const CAMP_PAD_SLOPE = 0.22;
const BRIDGE_BANK_SPAN = 0.22;
const BRIDGE_MIN_DEPRESSION = 0.32;
const BRIDGE_MIN_DECK_CLEARANCE = 0.18;
const TENT_FIRE_GAP = 0.45;
const CAMP_MAX_ROUTE_DISTANCE = 9.2;

export type AssemblyKind = "building" | "camp" | "bridge";
export type AssemblySegment = "arrival" | "journey" | "summit";

export interface OccupiedFootprint {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface AssemblyPartSpec {
  readonly assetId: string;
  readonly packId?: IslandAssetPackId;
  readonly kind: "landmark" | "prop";
  readonly along: number;
  readonly away: number;
  readonly turn: number;
  readonly lift?: number;
  readonly height: number;
  readonly importance: number;
  readonly optional?: boolean;
  /** Aim local +Z at the assembly origin (campfire / clearing). */
  readonly facing?: "origin";
  /** Model axis that should follow the span/route heading. */
  readonly headingAxis?: "x" | "z";
  readonly state?: "lit" | "idle";
}

export interface AssemblySpec {
  readonly id: string;
  readonly kind: AssemblyKind;
  readonly segment: AssemblySegment;
  readonly outpostId?: string;
  readonly outpostKind?: "camp" | "bridge";
  readonly maxGroundSlope: number;
  readonly maxElevationSpan: number;
  readonly maxShore: number;
  readonly minRoutePadding: number;
  readonly nodePadding: number;
  readonly parts: readonly AssemblyPartSpec[];
}

export interface AssemblyPlacement {
  readonly id: string;
  readonly packId: IslandAssetPackId;
  readonly assetId: string;
  readonly kind: "landmark" | "prop";
  readonly segment: AssemblySegment;
  readonly outpostId?: string;
  readonly outpostKind?: "camp" | "bridge";
  readonly assemblyId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lift?: number;
  readonly turn: number;
  readonly height: number;
  readonly importance: number;
  readonly state?: "lit" | "idle";
}

export interface AssemblyContext {
  readonly blueprint: IslandBlueprint;
  readonly field: IslandField;
  readonly heightAt: (x: number, z: number) => number;
  readonly occupied?: readonly OccupiedFootprint[];
  readonly packByAsset?: ReadonlyMap<string, IslandAssetPackId>;
  readonly onSearchResult?: (report: AssemblySearchReport) => void;
}

/** One bounded search, including rejected candidates; consumed by Map Studio. */
export interface AssemblySearchReport {
  readonly assemblyId: string;
  readonly kind: AssemblyKind;
  readonly status: "placed" | "omitted";
  readonly attempts: number;
  readonly rejections: Readonly<Record<string, number>>;
  readonly members: readonly string[];
  readonly baseY?: number;
  readonly span?: number;
  readonly slope?: number;
}

export interface OrientedFootprint {
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly turn: number;
}

export function sourceExtentFor(
  assetId: string,
): { readonly x: number; readonly y: number; readonly z: number } | null {
  if (assetId in COMPOSITION_SOURCE_EXTENTS) {
    return COMPOSITION_SOURCE_EXTENTS[assetId as CompositionAssetId];
  }
  return null;
}

export function worldSizeForAsset(
  assetId: string,
  height: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const source = sourceExtentFor(assetId);
  if (!source) {
    const fallback = Math.max(0.4, height * 0.45);
    return { x: fallback, y: height, z: fallback };
  }
  const scale = height / source.y;
  return { x: source.x * scale, y: height, z: source.z * scale };
}

export function orientedFootprintFor(
  assetId: string,
  height: number,
  x: number,
  z: number,
  turn: number,
): OrientedFootprint {
  const size = worldSizeForAsset(assetId, height);
  return { x, z, halfX: size.x * 0.5, halfZ: size.z * 0.5, turn };
}

export function rotateLocalToWorld(localX: number, localZ: number, turn: number): IslandPoint {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return {
    x: localX * cos + localZ * sin,
    z: -localX * sin + localZ * cos,
  };
}

export function footprintSamplePoints(footprint: OrientedFootprint): readonly IslandPoint[] {
  const locals: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [-footprint.halfX, -footprint.halfZ],
    [footprint.halfX, -footprint.halfZ],
    [footprint.halfX, footprint.halfZ],
    [-footprint.halfX, footprint.halfZ],
    [0, -footprint.halfZ],
    [0, footprint.halfZ],
    [-footprint.halfX, 0],
    [footprint.halfX, 0],
  ];
  return locals.map(([localX, localZ]) => {
    const world = rotateLocalToWorld(localX, localZ, footprint.turn);
    return { x: footprint.x + world.x, z: footprint.z + world.z };
  });
}

export function footprintRadius(footprint: OrientedFootprint): number {
  return Math.hypot(footprint.halfX, footprint.halfZ);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) * 0.5;
}

function offsetPoint(anchor: IslandRouteAnchor, along: number, away: number): IslandPoint {
  return {
    x: anchor.point.x + anchor.tangent.x * along + anchor.normal.x * away,
    z: anchor.point.z + anchor.tangent.z * along + anchor.normal.z * away,
  };
}

function headingForPart(part: AssemblyPartSpec, anchor: IslandRouteAnchor): number {
  const routeYaw =
    part.headingAxis === "x"
      ? yawAligningLocalX(anchor.tangent)
      : yawAligningLocalZ(anchor.tangent);
  return routeYaw + part.turn;
}

export function resolveAssemblyParts(
  spec: AssemblySpec,
  packByAsset?: ReadonlyMap<string, IslandAssetPackId>,
): readonly (AssemblyPartSpec & { readonly packId: IslandAssetPackId })[] | null {
  const resolved: (AssemblyPartSpec & { readonly packId: IslandAssetPackId })[] = [];
  for (const part of spec.parts) {
    const packId = part.packId ?? packByAsset?.get(part.assetId);
    if (!packId) {
      if (part.optional) continue;
      return null;
    }
    resolved.push({ ...part, packId });
  }
  const required = spec.parts.filter((part) => !part.optional);
  if (required.length === 0 || resolved.length < required.length) return null;
  return resolved;
}

const WALL = COMPOSITION_SCALES.academyWall.height;
// A closed, one-module room. Local +Z is the wall's long axis, not its front.
// Corners overlap by the measured wall thickness; the single gable overhangs
// all four walls at the same source scale. The previous linear facade left
// the entire back of both roofs unsupported.
const ROOM_WALL_OFFSET =
  (worldSizeForAsset("wall", WALL).z - worldSizeForAsset("wall", WALL).x) * 0.5;

const CAMP_SIZE = worldSizeForAsset("camp", COMPOSITION_SCALES.camp.height);
const TENT_SIZE = worldSizeForAsset("tent", COMPOSITION_SCALES.tent.height);
const TENT_SEPARATION = CAMP_SIZE.z * 0.5 + TENT_SIZE.z * 0.5 + TENT_FIRE_GAP;

export const SUMMIT_ACADEMY_ASSEMBLY: AssemblySpec = {
  id: "summit-academy-building",
  kind: "building",
  segment: "summit",
  maxGroundSlope: RIGID_PAD_SLOPE,
  maxElevationSpan: RIGID_PAD_SPAN,
  maxShore: 0.86,
  minRoutePadding: 0.55,
  nodePadding: 0.7,
  parts: [
    {
      assetId: "wall-doorway-square",
      kind: "landmark",
      along: 0,
      away: -ROOM_WALL_OFFSET,
      turn: 0,
      height: WALL,
      importance: 0.96,
    },
    {
      assetId: "roof-gable",
      kind: "landmark",
      along: 0,
      away: 0,
      turn: 0,
      lift: COMPOSITION_SCALES.academyRoofGable.lift,
      height: COMPOSITION_SCALES.academyRoofGable.height,
      importance: 0.98,
    },
    {
      assetId: "wall",
      kind: "prop",
      along: 0,
      away: ROOM_WALL_OFFSET,
      turn: 0,
      height: WALL,
      importance: 0.68,
    },
    {
      assetId: "wall",
      kind: "prop",
      along: ROOM_WALL_OFFSET,
      away: 0,
      turn: Math.PI / 2,
      height: WALL,
      importance: 0.68,
    },
    {
      assetId: "wall",
      kind: "prop",
      along: -ROOM_WALL_OFFSET,
      away: 0,
      turn: Math.PI / 2,
      height: WALL,
      importance: 0.7,
    },
  ],
};

export const ROADSIDE_CAMP_ASSEMBLY: AssemblySpec = {
  id: "roadside-camp",
  kind: "camp",
  segment: "arrival",
  outpostId: "trail-camp",
  outpostKind: "camp",
  maxGroundSlope: CAMP_PAD_SLOPE,
  maxElevationSpan: CAMP_PAD_SPAN,
  maxShore: 0.9,
  minRoutePadding: 0.4,
  nodePadding: 0.58,
  parts: [
    {
      assetId: "camp",
      packId: ELEMENTAL_SERENITY_PACK,
      kind: "landmark",
      along: 0,
      away: 0,
      turn: 0,
      height: COMPOSITION_SCALES.camp.height,
      importance: 0.97,
      state: COMPOSITION_SCALES.camp.state,
    },
    {
      assetId: "tent",
      packId: ELEMENTAL_SERENITY_PACK,
      kind: "landmark",
      along: -TENT_SEPARATION,
      away: 0.2,
      turn: 0,
      height: COMPOSITION_SCALES.tent.height,
      importance: 0.88,
      facing: "origin",
    },
  ],
};

export const ROUTE_BRIDGE_ASSEMBLY: AssemblySpec = {
  id: "route-bridge",
  kind: "bridge",
  segment: "journey",
  outpostId: "route-bridge",
  outpostKind: "bridge",
  maxGroundSlope: 0.55,
  maxElevationSpan: 1.05,
  maxShore: 0.9,
  minRoutePadding: 0.45,
  nodePadding: 0.7,
  parts: [
    {
      assetId: "bridge",
      packId: ELEMENTAL_SERENITY_PACK,
      kind: "landmark",
      along: 0,
      away: 0,
      turn: 0,
      height: COMPOSITION_SCALES.bridge.height,
      importance: 0.96,
      headingAxis: "x",
    },
  ],
};

export interface BridgeSpanSample {
  readonly ok: boolean;
  readonly reason?: string;
  readonly deckY?: number;
  /** Kit origin (bottom of the beams), not the raised walking surface. */
  readonly baseY?: number;
  readonly supportSpan?: number;
  readonly minClearance?: number;
  readonly depression?: number;
}

/**
 * Physical anchors of elemental-serenity/bridge, in Kit unit-height space.
 * Measured from decoded GLB 0bcea5872b72836a51913a8974d840891aa3e78e1717053d420a5cc0d664e769
 * on 2026-09-06, including node rotations/scales. Planks arch upwards; they
 * are NOT at the AABB base. Lower-envelope samples deliberately subtract
 * 0.025 from the lower of both halves/three lateral probes for plank roughness.
 * The end beam feet occupy the two outer strips at z ~ +/-0.53..0.707.
 */
export const BRIDGE_CONTACT_PROFILE = {
  halfLength: COMPOSITION_SOURCE_EXTENTS.bridge.x / COMPOSITION_SOURCE_EXTENTS.bridge.y / 2,
  supportAlong: [1.18, 1.25, 1.32],
  supportAcross: [0.53, 0.615, 0.7],
  deckHalfWidth: 0.52,
  centerDeckTop: 0.569,
  lowerDeck: [
    [0, 0.507],
    [0.1815, 0.482],
    [0.363, 0.456],
    [0.5446, 0.426],
    [0.7261, 0.376],
    [0.9076, 0.301],
    [1.0891, 0.229],
    [1.2707, 0.155],
    [1.4522, 0.077],
    [1.545, 0.04],
  ],
} as const;

function bridgeDeckBottomAt(x: number): number {
  const absolute = Math.abs(x);
  const profile = BRIDGE_CONTACT_PROFILE.lowerDeck;
  for (let index = 1; index < profile.length; index += 1) {
    const before = profile[index - 1]!;
    const after = profile[index]!;
    if (absolute <= after[0]) {
      const fraction = (absolute - before[0]) / (after[0] - before[0]);
      return before[1] + (after[1] - before[1]) * fraction;
    }
  }
  return profile[profile.length - 1]![1];
}

export function evaluateBridgeSpan(
  context: AssemblyContext,
  center: IslandPoint,
  spanDirection: IslandPoint,
  spanLength: number,
): BridgeSpanSample {
  const length = Math.hypot(spanDirection.x, spanDirection.z);
  if (
    ![center.x, center.z, length, spanLength].every(Number.isFinite) ||
    length < 1e-6 ||
    spanLength <= 0
  ) {
    return { ok: false, reason: "invalid-span" };
  }
  const dir = { x: spanDirection.x / length, z: spanDirection.z / length };
  const height = spanLength / (BRIDGE_CONTACT_PROFILE.halfLength * 2);
  const worldPoint = (along: number, across: number): IslandPoint => ({
    x: center.x + (dir.x * along - dir.z * across) * height,
    z: center.z + (dir.z * along + dir.x * across) * height,
  });
  const groundAt = (point: IslandPoint): number | null => {
    const field = sampleIslandField(context.field, point.x, point.z);
    if (
      !field.inside ||
      field.shore > 0.9 ||
      !sampleIslandSurface(context.blueprint, point.x, point.z).inside
    )
      return null;
    const y = context.heightAt(point.x, point.z);
    return Number.isFinite(y) ? y : null;
  };
  const centerY = groundAt(center);
  if (centerY === null) return { ok: false, reason: "ground" };
  const banks: number[] = [];
  for (const sign of [-1, 1]) {
    for (const along of BRIDGE_CONTACT_PROFILE.supportAlong) {
      for (const across of BRIDGE_CONTACT_PROFILE.supportAcross) {
        for (const side of [-1, 1]) {
          const y = groundAt(worldPoint(sign * along, side * across));
          if (y === null) return { ok: false, reason: "banks-outside" };
          banks.push(y);
        }
      }
    }
  }
  const supportSpan = Math.max(...banks) - Math.min(...banks);
  const baseY = median(banks);
  if (supportSpan > BRIDGE_BANK_SPAN || banks.some((y) => Math.abs(y - baseY) > 0.08)) {
    return { ok: false, reason: "bank-height-mismatch" };
  }
  const depression = baseY - centerY;
  if (depression < BRIDGE_MIN_DEPRESSION) {
    return { ok: false, reason: "no-span" };
  }
  let minClearance = Infinity;
  // Check the whole deck width and span, not the lowest of two quarters.
  // 32 bounded intervals are at most ~0.11 world units for the registered kit.
  for (let step = 0; step <= 32; step += 1) {
    const fraction = step / 16 - 1;
    const along = fraction * BRIDGE_CONTACT_PROFILE.halfLength;
    const bottomY = baseY + bridgeDeckBottomAt(along) * height;
    for (const lateral of [-1, -0.5, 0, 0.5, 1]) {
      const y = groundAt(worldPoint(along, lateral * BRIDGE_CONTACT_PROFILE.deckHalfWidth));
      if (y === null) return { ok: false, reason: "banks-outside" };
      const clearance = bottomY - y;
      minClearance = Math.min(minClearance, clearance);
      const required = Math.abs(fraction) <= 0.6 ? BRIDGE_MIN_DECK_CLEARANCE : 0.01;
      if (clearance < required) return { ok: false, reason: "deck-buried" };
    }
  }
  return {
    ok: true,
    baseY,
    deckY: baseY + height * BRIDGE_CONTACT_PROFILE.centerDeckTop,
    supportSpan,
    minClearance,
    depression,
  };
}

export function hasBridgeTerrainSupport(
  blueprint: IslandBlueprint,
  field: IslandField,
  center: IslandPoint,
  tangent: IslandPoint,
  spanLength = worldSizeForAsset("bridge", COMPOSITION_SCALES.bridge.height).x,
): boolean {
  return evaluateBridgeSpan(
    { blueprint, field, heightAt: (x, z) => sampleIslandSurface(blueprint, x, z).y },
    center,
    tangent,
    spanLength,
  ).ok;
}

interface GroundStats {
  readonly minY: number;
  readonly maxY: number;
  readonly span: number;
  readonly slope: number;
  readonly baseY: number;
}

function groundStats(
  heightAt: (x: number, z: number) => number,
  points: readonly IslandPoint[],
): GroundStats | null {
  if (points.length === 0) return null;
  const ys = points.map((point) => heightAt(point.x, point.z));
  if (ys.some((value) => !Number.isFinite(value))) return null;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let maxDist = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      maxDist = Math.max(
        maxDist,
        Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z),
      );
    }
  }
  return {
    minY,
    maxY,
    span: maxY - minY,
    slope: (maxY - minY) / Math.max(maxDist, 1e-3),
    baseY: median(ys),
  };
}

export interface AssemblyEvaluation {
  readonly ok: boolean;
  readonly reason?: string;
  readonly baseY?: number;
  readonly slope?: number;
  readonly span?: number;
  readonly placements?: readonly AssemblyPlacement[];
}

function partTurnOnAnchor(
  part: AssemblyPartSpec,
  anchor: IslandRouteAnchor,
  spanDirection?: IslandPoint,
): number {
  if (part.facing === "origin") {
    const world = offsetPoint(anchor, part.along, part.away);
    return yawAligningLocalZ({
      x: anchor.point.x - world.x,
      z: anchor.point.z - world.z,
    });
  }
  if (part.headingAxis === "x" && spanDirection) {
    return yawAligningLocalX(spanDirection) + part.turn;
  }
  return headingForPart(part, anchor);
}

export function evaluateAssembly(
  spec: AssemblySpec,
  context: AssemblyContext,
  anchor: IslandRouteAnchor,
  spanDirection?: IslandPoint,
): AssemblyEvaluation {
  const parts = resolveAssemblyParts(spec, context.packByAsset);
  if (!parts) return { ok: false, reason: "missing-asset" };

  const routeClearanceDist = islandRouteClearance(context.blueprint) + spec.minRoutePadding;
  const drafted: {
    readonly part: (typeof parts)[number];
    readonly point: IslandPoint;
    readonly turn: number;
    readonly footprint: OrientedFootprint;
    readonly samples: readonly IslandPoint[];
  }[] = [];

  for (const part of parts) {
    const point = offsetPoint(anchor, part.along, part.away);
    const turn = partTurnOnAnchor(part, anchor, spanDirection);
    const footprint = orientedFootprintFor(part.assetId, part.height, point.x, point.z, turn);
    drafted.push({
      part,
      point,
      turn,
      footprint,
      samples: footprintSamplePoints(footprint),
    });
  }

  if (spec.kind === "camp") {
    const fire = drafted.find((entry) => entry.part.assetId === "camp");
    const tent = drafted.find((entry) => entry.part.assetId === "tent");
    if (!fire || !tent) return { ok: false, reason: "missing-asset" };
    const gap = Math.hypot(fire.point.x - tent.point.x, fire.point.z - tent.point.z);
    const needed =
      footprintRadius(fire.footprint) * 0.72 +
      footprintRadius(tent.footprint) * 0.55 +
      TENT_FIRE_GAP * 0.5;
    if (gap < needed) return { ok: false, reason: "fire-overlap" };
    const toFire = { x: fire.point.x - tent.point.x, z: fire.point.z - tent.point.z };
    const forward = yawToWorld(tent.turn);
    const length = Math.hypot(toFire.x, toFire.z) || 1;
    const facing = (forward.x * toFire.x + forward.z * toFire.z) / length;
    if (facing < 0.82) return { ok: false, reason: "tent-not-facing-fire" };
    const fireRoute = distanceToIslandRoute(context.blueprint, fire.point);
    if (fireRoute > CAMP_MAX_ROUTE_DISTANCE) return { ok: false, reason: "no-path-access" };
  }

  let bridgeSpan: BridgeSpanSample | null = null;
  if (spec.kind === "bridge") {
    const spanLength = worldSizeForAsset("bridge", COMPOSITION_SCALES.bridge.height).x;
    const direction = spanDirection ?? anchor.tangent;
    bridgeSpan = evaluateBridgeSpan(context, anchor.point, direction, spanLength);
    if (!bridgeSpan.ok) return { ok: false, reason: bridgeSpan.reason ?? "no-span" };
  }

  const padSamples = drafted.flatMap((entry) =>
    (entry.part.lift ?? 0) > 0.4 ? [] : [...entry.samples],
  );
  const samples = padSamples.length > 0 ? padSamples : drafted.flatMap((entry) => entry.samples);

  // Elevated roofs need route/shore/obstacle clearance too. Only their ground
  // support is excluded from fitting the foundation plane.
  for (const point of drafted.flatMap((entry) => entry.samples)) {
    const field = sampleIslandField(context.field, point.x, point.z);
    const surface = sampleIslandSurface(context.blueprint, point.x, point.z);
    if (!field.inside || !surface.inside) return { ok: false, reason: "outside" };
    if (field.shore > spec.maxShore) return { ok: false, reason: "shore" };
    if (distanceToIslandRoute(context.blueprint, point) < routeClearanceDist) {
      return { ok: false, reason: "route" };
    }
    if (
      Math.hypot(point.x - context.blueprint.hero.x, point.z - context.blueprint.hero.z) <
      context.blueprint.hero.radius + 1.4
    ) {
      return { ok: false, reason: "hero" };
    }
    for (const node of context.blueprint.nodes) {
      if (
        Math.hypot(point.x - node.x, point.z - node.z) <
        context.blueprint.route.nodeRadius + spec.nodePadding
      ) {
        return { ok: false, reason: "lesson" };
      }
    }
    for (const other of context.occupied ?? []) {
      if (Math.hypot(point.x - other.x, point.z - other.z) < other.radius + 0.28) {
        return { ok: false, reason: "occupied" };
      }
    }
  }

  // A bridge spans a depression by definition: fitting a flat pad to its
  // centre rejects precisely the valid span. Only its measured bank feet fit.
  const stats =
    bridgeSpan?.ok && bridgeSpan.baseY !== undefined
      ? {
          baseY: bridgeSpan.baseY,
          minY: bridgeSpan.baseY - (bridgeSpan.supportSpan ?? 0) / 2,
          maxY: bridgeSpan.baseY + (bridgeSpan.supportSpan ?? 0) / 2,
          span: bridgeSpan.supportSpan ?? 0,
          slope: 0,
        }
      : groundStats(context.heightAt, samples);
  if (!stats) return { ok: false, reason: "ground" };
  if (stats.slope > spec.maxGroundSlope)
    return { ok: false, reason: "slope", slope: stats.slope, span: stats.span };
  if (stats.span > spec.maxElevationSpan) {
    return { ok: false, reason: "elevation-span", slope: stats.slope, span: stats.span };
  }
  const bury = stats.baseY - stats.minY;
  const hover = stats.maxY - stats.baseY;
  if (bury > spec.maxElevationSpan * 0.55 || hover > spec.maxElevationSpan * 0.55) {
    return { ok: false, reason: "bury-hover", slope: stats.slope, span: stats.span };
  }

  const baseY = stats.baseY;

  const placements: AssemblyPlacement[] = drafted.map((entry, index) => {
    const lift = entry.part.lift ?? 0;
    return {
      id: `assembly-${spec.id}-${index + 1}`,
      packId: entry.part.packId,
      assetId: entry.part.assetId,
      kind: entry.part.kind,
      segment: spec.segment,
      ...(spec.outpostId ? { outpostId: spec.outpostId } : {}),
      ...(spec.outpostKind ? { outpostKind: spec.outpostKind } : {}),
      assemblyId: spec.id,
      x: entry.point.x,
      y: baseY + lift,
      z: entry.point.z,
      ...(entry.part.lift === undefined ? {} : { lift }),
      turn: entry.turn,
      height: entry.part.height,
      importance: entry.part.importance,
      ...(entry.part.state ? { state: entry.part.state } : {}),
    };
  });

  return { ok: true, baseY, slope: stats.slope, span: stats.span, placements };
}

export function isAssemblySafe(
  blueprint: IslandBlueprint,
  field: IslandField,
  assembly: AssemblySpec,
  anchor: IslandRouteAnchor,
  _routeClearanceDist: number,
): boolean {
  return evaluateAssembly(
    assembly,
    {
      blueprint,
      field,
      heightAt: (x, z) => sampleIslandSurface(blueprint, x, z).y,
    },
    anchor,
  ).ok;
}

const SIDE_OFFSETS = [3.7, 4.35, 5.15, 5.9, 6.65] as const;
const FRACTION_DELTAS = [0, -0.03, 0.03, -0.06, 0.06] as const;
export const BRIDGE_FRACTIONS = [0.26, 0.34, 0.42, 0.5, 0.58, 0.66] as const;

function preferredSide(seedKey: string): number {
  return seeded(seedKey)() < 0.5 ? -1 : 1;
}

export function searchAssemblyPlacement(
  spec: AssemblySpec,
  context: AssemblyContext,
  options: {
    readonly seedKey: string;
    readonly fractions: readonly number[];
    readonly spanAlongTangent?: boolean;
  },
): readonly AssemblyPlacement[] | null {
  const parts = resolveAssemblyParts(spec, context.packByAsset);
  if (!parts) {
    context.onSearchResult?.({
      assemblyId: spec.id,
      kind: spec.kind,
      status: "omitted",
      attempts: 0,
      rejections: { "missing-asset": 1 },
      members: [],
    });
    return null;
  }
  let attempts = 0;
  const rejections: Record<string, number> = {};
  const side = preferredSide(options.seedKey);
  const uniqueFractions =
    spec.kind === "bridge"
      ? options.fractions.map((value) => Math.max(0.04, Math.min(0.96, value)))
      : [
          ...new Set(
            options.fractions.flatMap((fraction) =>
              FRACTION_DELTAS.map(
                (delta) =>
                  Math.round(Math.max(0.04, Math.min(0.96, fraction + delta)) * 1000) / 1000,
              ),
            ),
          ),
        ];

  for (const fraction of uniqueFractions) {
    const frame = islandRouteFrameAtFraction(context.blueprint, fraction);
    if (!frame) continue;
    for (const currentSide of [side, -side]) {
      for (const offset of SIDE_OFFSETS) {
        const anchor = islandRouteAnchorFromFrame(frame, currentSide, offset);
        const directions: IslandPoint[] =
          spec.kind === "bridge"
            ? options.spanAlongTangent === false
              ? [anchor.normal, frame.tangent]
              : [frame.tangent, anchor.normal]
            : [frame.tangent];
        for (const direction of directions) {
          attempts += 1;
          const result = evaluateAssembly(
            spec,
            context,
            spec.kind === "bridge" ? { ...anchor, tangent: direction } : anchor,
            spec.kind === "bridge" ? direction : undefined,
          );
          if (result.ok && result.placements) {
            context.onSearchResult?.({
              assemblyId: spec.id,
              kind: spec.kind,
              status: "placed",
              attempts,
              rejections,
              members: result.placements.map((placement) => placement.id),
              baseY: result.baseY,
              span: result.span,
              slope: result.slope,
            });
            return result.placements;
          }
          const reason = result.reason ?? "no-feasible-site";
          rejections[reason] = (rejections[reason] ?? 0) + 1;
        }
      }
    }
  }
  context.onSearchResult?.({
    assemblyId: spec.id,
    kind: spec.kind,
    status: "omitted",
    attempts,
    rejections,
    members: [],
  });
  return null;
}

export function searchAcademyPlacement(
  context: AssemblyContext,
  seedKey: string,
): readonly AssemblyPlacement[] | null {
  const zone = context.blueprint.zones.find((candidate) => candidate.id === "summit");
  const near = zone ? islandRouteIndexNear(context.blueprint, zone) : null;
  const frame = near === null ? null : islandRouteFrameAtIndex(context.blueprint, near);
  const fractions = frame
    ? [near! / Math.max(1, context.blueprint.centerline.length - 1), 0.9, 0.84, 0.96]
    : [0.9, 0.84, 0.96];
  return searchAssemblyPlacement(SUMMIT_ACADEMY_ASSEMBLY, context, { seedKey, fractions });
}

export function searchCampPlacement(
  context: AssemblyContext,
  seedKey: string,
): readonly AssemblyPlacement[] | null {
  const zone = context.blueprint.zones.find((candidate) => candidate.id === "arrival");
  const near = zone ? islandRouteIndexNear(context.blueprint, zone) : null;
  const fractions =
    near === null
      ? [0.1, 0.16, 0.06]
      : [near / Math.max(1, context.blueprint.centerline.length - 1), 0.08, 0.14, 0.2];
  return searchAssemblyPlacement(ROADSIDE_CAMP_ASSEMBLY, context, { seedKey, fractions });
}

export function searchBridgePlacement(
  context: AssemblyContext,
  seedKey: string,
): readonly AssemblyPlacement[] | null {
  return searchAssemblyPlacement(ROUTE_BRIDGE_ASSEMBLY, context, {
    seedKey,
    fractions: BRIDGE_FRACTIONS,
    spanAlongTangent: true,
  });
}

export interface RockHierarchyTier {
  readonly role: "rockLarge" | "rockMedium" | "rockSmall";
  readonly count: number;
  readonly minSpacing: number;
  readonly radial: readonly [number, number];
  readonly height: readonly [number, number];
  readonly importance: readonly [number, number];
  readonly maxSlope: number;
  readonly clustered: boolean;
  readonly prefersSlope: number;
  readonly clusterRadius: number;
}

export const BORDER_ROCK_TIERS: readonly RockHierarchyTier[] = [
  {
    role: "rockLarge",
    count: 12,
    minSpacing: 1.5,
    radial: [0.68, 0.9],
    height: [0.65, 0.95],
    importance: [0.72, 0.88],
    maxSlope: 1.9,
    clustered: true,
    prefersSlope: 0.6,
    clusterRadius: 2.2,
  },
  {
    role: "rockMedium",
    count: 28,
    minSpacing: 0.85,
    radial: [0.66, 0.92],
    height: [0.4, 0.62],
    importance: [0.5, 0.72],
    maxSlope: 1.85,
    clustered: true,
    prefersSlope: 0.6,
    clusterRadius: 2.4,
  },
  {
    role: "rockSmall",
    count: 26,
    minSpacing: 0.5,
    radial: [0.64, 0.92],
    height: [0.22, 0.36],
    importance: [0.35, 0.55],
    maxSlope: 1.8,
    clustered: true,
    prefersSlope: 0.5,
    clusterRadius: 2.85,
  },
] as const;

const ROCK_CLUSTER_MAX_SHORE = 0.88;
const ROCK_CLUSTER_MIN_INSIDE = 4;

export function borderRockClusterCentres(
  blueprint: IslandBlueprint,
  field: IslandField,
  random: () => number,
): readonly IslandPoint[] {
  const centres: IslandPoint[] = [];
  const candidateAngles = [0.25, 0.85, 1.45, 1.95, 2.55, 3.15, 3.85, 4.55, 5.25, 5.95];
  const minSeparation = blueprint.bounds.maxHalf * 0.3;

  const tryPush = (x: number, z: number, minGap: number): boolean => {
    const fieldSample = sampleIslandField(field, x, z);
    const surface = sampleIslandSurface(blueprint, x, z);
    if (!fieldSample.inside || !surface.inside) return false;
    if (fieldSample.shore > ROCK_CLUSTER_MAX_SHORE) return false;
    if (centres.every((centre) => Math.hypot(x - centre.x, z - centre.z) >= minGap)) {
      centres.push({ x, z });
      return true;
    }
    return false;
  };

  for (const angle of candidateAngles) {
    if (centres.length >= 5) break;
    const radial = 0.78 + random() * 0.1;
    const x = Math.cos(angle) * blueprint.bounds.halfX * radial;
    const z = Math.sin(angle) * blueprint.bounds.halfZ * radial;
    const sample = sampleIslandField(field, x, z);
    if (sample.rock <= 0.28 && sample.shore < 0.7) continue;
    tryPush(x, z, minSeparation);
  }

  let step = 0;
  while (centres.length < ROCK_CLUSTER_MIN_INSIDE && step < 16) {
    const angle = (step / 16) * Math.PI * 2 + random() * 0.12;
    const radial = 0.76 + (step % 4) * 0.035;
    const x = Math.cos(angle) * blueprint.bounds.halfX * radial;
    const z = Math.sin(angle) * blueprint.bounds.halfZ * radial;
    tryPush(x, z, Math.max(5, minSeparation * 0.72));
    step += 1;
  }

  return centres;
}

export function occupiedFromPlacements(
  placements: readonly {
    readonly x: number;
    readonly z: number;
    readonly assetId: string;
    readonly height: number;
  }[],
): OccupiedFootprint[] {
  return placements.map((placement) => {
    const size = worldSizeForAsset(placement.assetId, placement.height);
    return {
      x: placement.x,
      z: placement.z,
      radius: Math.max(size.x, size.z) * 0.5 + 0.12,
    };
  });
}
