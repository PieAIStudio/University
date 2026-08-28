/**
 * Deterministic, renderer-free data for one island surface.
 *
 * This is the one sampled field shared by ground cover and dressing. It is
 * deliberately a plain-data artifact: no Three.js, materials, scene objects,
 * or runtime randomness. The continuous height rule remains owned by
 * island-blueprint.ts; this module only samples it once onto a reusable grid.
 */
import { routeDistanceAt, sampleIslandSurface, type IslandBlueprint } from "./island-blueprint.js";
import { hash } from "./random.js";

export const DEFAULT_ISLAND_FIELD_RESOLUTION = 192;
const MIN_ISLAND_FIELD_RESOLUTION = 8;
const MAX_ISLAND_FIELD_RESOLUTION = 512;
const MASK_CHANNEL_COUNT = 4;
const AO_DIRECTIONS = 8;
const AO_STEPS = 8;
const TAU = Math.PI * 2;

export const ISLAND_FIELD_MASK_CHANNELS = {
  route: 0,
  grass: 1,
  shore: 2,
  rock: 3,
} as const;

export type IslandFieldMaskChannel = keyof typeof ISLAND_FIELD_MASK_CHANNELS;

export interface IslandField {
  readonly resolution: number;
  /** The square world-space radius covered by the grid. */
  readonly extent: number;
  readonly height: Float32Array;
  /**
   * RGBA per cell:
   *   R = route / shoulder strength
   *   G = terrain-derived meadow density
   *   B = shore / water radial mask
   *   A = slope / exposed-rock strength
   */
  readonly mask: Uint8Array;
  /** Baked sky openness: 0 is occluded, 255 is open. */
  readonly ao: Uint8Array;
}

export interface IslandFieldSample {
  readonly height: number;
  readonly route: number;
  readonly grass: number;
  readonly shore: number;
  readonly rock: number;
  readonly ao: number;
  /** False for water/outside samples. The narrow shoreline is intentionally not playable. */
  readonly inside: boolean;
}

export interface IslandFieldOptions {
  readonly resolution?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(from: number, to: number, value: number): number {
  if (from === to) return value < from ? 0 : 1;
  const amount = clamp01((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
}

function lerp(first: number, second: number, amount: number): number {
  return first + (second - first) * amount;
}

function normalizeResolution(value: number | undefined): number {
  const resolution = value ?? DEFAULT_ISLAND_FIELD_RESOLUTION;
  if (
    !Number.isInteger(resolution) ||
    resolution < MIN_ISLAND_FIELD_RESOLUTION ||
    resolution > MAX_ISLAND_FIELD_RESOLUTION
  ) {
    throw new RangeError(
      `IslandField resolution must be an integer from ${MIN_ISLAND_FIELD_RESOLUTION} to ${MAX_ISLAND_FIELD_RESOLUTION}`,
    );
  }
  return resolution;
}

function encode(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function gridCoordinate(value: number, extent: number, resolution: number): number {
  return clamp(((value + extent) / (extent * 2)) * (resolution - 1), 0, resolution - 1);
}

function valueNoise2d(seed: string, x: number, z: number, wavelength: number): number {
  const gridX = x / wavelength;
  const gridZ = z / wavelength;
  const left = Math.floor(gridX);
  const top = Math.floor(gridZ);
  const xAmount = smoothstep(0, 1, gridX - left);
  const zAmount = smoothstep(0, 1, gridZ - top);
  const lattice = (offsetX: number, offsetZ: number): number =>
    hash(`${seed}/${left + offsetX}/${top + offsetZ}`);
  const near = lerp(lattice(0, 0), lattice(1, 0), xAmount);
  const far = lerp(lattice(0, 1), lattice(1, 1), xAmount);
  return lerp(near, far, zAmount);
}

function heightAtGrid(
  height: Float32Array,
  resolution: number,
  gridX: number,
  gridZ: number,
): number {
  const x = clamp(gridX, 0, resolution - 1);
  const z = clamp(gridZ, 0, resolution - 1);
  const left = Math.floor(x);
  const top = Math.floor(z);
  const right = Math.min(resolution - 1, left + 1);
  const bottom = Math.min(resolution - 1, top + 1);
  const xAmount = x - left;
  const zAmount = z - top;
  const near = lerp(height[top * resolution + left]!, height[top * resolution + right]!, xAmount);
  const far = lerp(
    height[bottom * resolution + left]!,
    height[bottom * resolution + right]!,
    xAmount,
  );
  return lerp(near, far, zAmount);
}

function maskAt(
  mask: Uint8Array,
  resolution: number,
  channel: number,
  gridX: number,
  gridZ: number,
): number {
  const x = clamp(gridX, 0, resolution - 1);
  const z = clamp(gridZ, 0, resolution - 1);
  const left = Math.floor(x);
  const top = Math.floor(z);
  const right = Math.min(resolution - 1, left + 1);
  const bottom = Math.min(resolution - 1, top + 1);
  const xAmount = x - left;
  const zAmount = z - top;
  const at = (column: number, row: number): number =>
    mask[(row * resolution + column) * MASK_CHANNEL_COUNT + channel]! / 255;
  const near = lerp(at(left, top), at(right, top), xAmount);
  const far = lerp(at(left, bottom), at(right, bottom), xAmount);
  return lerp(near, far, zAmount);
}

function writeMask(mask: Uint8Array, index: number, channel: number, value: number): void {
  mask[index * MASK_CHANNEL_COUNT + channel] = encode(value);
}

/**
 * Compile a shared field from the blueprint's existing continuous surface.
 *
 * Height sampling is intentionally the first pass. Slope, grass and AO then
 * consume that raster instead of asking the expensive surface function the
 * same question again for every rejected decoration candidate.
 */
export function compileIslandField(
  blueprint: IslandBlueprint,
  options: IslandFieldOptions = {},
): IslandField {
  const resolution = normalizeResolution(options.resolution);
  const extent = Math.max(1, blueprint.bounds.maxHalf);
  const cell = (extent * 2) / (resolution - 1);
  const sampleCount = resolution * resolution;
  const height = new Float32Array(sampleCount);
  const radial = new Float32Array(sampleCount);
  const inside = new Uint8Array(sampleCount);
  const slope = new Float32Array(sampleCount);
  const aoValues = new Float32Array(sampleCount);
  const mask = new Uint8Array(sampleCount * MASK_CHANNEL_COUNT);
  const ao = new Uint8Array(sampleCount);

  let landMinimum = Number.POSITIVE_INFINITY;
  let landMaximum = Number.NEGATIVE_INFINITY;
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    const z = -extent + zIndex * cell;
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const x = -extent + xIndex * cell;
      const index = zIndex * resolution + xIndex;
      const surface = sampleIslandSurface(blueprint, x, z);
      if (!surface.inside) continue;
      height[index] = surface.y;
      radial[index] = clamp01(surface.radial);
      inside[index] = 1;
      // The inner land range describes meadow variation, not the zero-height
      // shoreline. It keeps low hollows and high ridges meaningful together.
      if (surface.radial <= 0.9) {
        landMinimum = Math.min(landMinimum, surface.y);
        landMaximum = Math.max(landMaximum, surface.y);
      }
    }
  }

  if (!Number.isFinite(landMinimum) || !Number.isFinite(landMaximum)) {
    landMinimum = 0;
    landMaximum = 1;
  }
  const landRange = Math.max(landMaximum - landMinimum, Number.EPSILON);

  // Height-grid gradients are the sole slope source for every downstream
  // planner. Encoding the actual slope angle as 0..1 makes A useful both as a
  // visual rock exposure and as a replacement for the old radian threshold.
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const index = zIndex * resolution + xIndex;
      if (inside[index] === 0) continue;
      const gradientX =
        (heightAtGrid(height, resolution, xIndex + 1, zIndex) -
          heightAtGrid(height, resolution, xIndex - 1, zIndex)) /
        (2 * cell);
      const gradientZ =
        (heightAtGrid(height, resolution, xIndex, zIndex + 1) -
          heightAtGrid(height, resolution, xIndex, zIndex - 1)) /
        (2 * cell);
      slope[index] = clamp01(Math.atan(Math.hypot(gradientX, gradientZ)) / (Math.PI / 2));
    }
  }

  // Horizon AO is a cheap baked approximation: for each cell, scan eight
  // compass directions and retain the highest nearby elevation angle.
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const index = zIndex * resolution + xIndex;
      if (inside[index] === 0) {
        ao[index] = 255;
        aoValues[index] = 1;
        continue;
      }
      let maximumElevation = 0;
      for (let direction = 0; direction < AO_DIRECTIONS; direction += 1) {
        const angle = (direction / AO_DIRECTIONS) * TAU;
        const directionX = Math.cos(angle);
        const directionZ = Math.sin(angle);
        for (let step = 1; step <= AO_STEPS; step += 1) {
          const distance = step * cell;
          const neighbour = heightAtGrid(
            height,
            resolution,
            xIndex + directionX * step,
            zIndex + directionZ * step,
          );
          maximumElevation = Math.max(
            maximumElevation,
            Math.atan2(neighbour - height[index]!, distance),
          );
        }
      }
      const occlusion = smoothstep(0.03, 0.72, maximumElevation);
      const openness = 1 - occlusion * 0.58;
      aoValues[index] = openness;
      ao[index] = encode(openness);
    }
  }

  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    const z = -extent + zIndex * cell;
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const x = -extent + xIndex * cell;
      const index = zIndex * resolution + xIndex;
      const surfaceInside = inside[index] === 1;
      const currentRadial = surfaceInside ? radial[index]! : 1;
      const routeDistance = routeDistanceAt(blueprint, x, z);
      const routeBand = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
      const routeStrength = 1 - smoothstep(routeBand, routeBand + 1.1, routeDistance);
      const rockExposure = slope[index]!;
      const highness = surfaceInside ? clamp01((height[index]! - landMinimum) / landRange) : 1;
      const lowland = 1 - smoothstep(0.2, 0.8, highness);
      const steepness = smoothstep(0.1, 0.46, rockExposure);
      const shoreDryness = smoothstep(0.76, 0.96, currentRadial);
      const variation = surfaceInside
        ? valueNoise2d(
            `${blueprint.seed}/island-field/grass`,
            x,
            z,
            Math.max(14, blueprint.bounds.maxHalf * 0.34),
          )
        : 0;
      // Low ground and modest AO shading drive this value. The independent
      // noise contributes at most five percentage points either way.
      const grassDensity = surfaceInside
        ? 0.46 +
          lowland * 0.42 -
          steepness * 0.55 +
          (variation - 0.5) * 0.1 +
          (1 - aoValues[index]!) * 0.08 -
          shoreDryness * 0.08
        : 0;
      const shoreMask = surfaceInside ? currentRadial : 1;
      writeMask(mask, index, ISLAND_FIELD_MASK_CHANNELS.route, routeStrength);
      writeMask(mask, index, ISLAND_FIELD_MASK_CHANNELS.grass, grassDensity);
      writeMask(mask, index, ISLAND_FIELD_MASK_CHANNELS.shore, shoreMask);
      writeMask(mask, index, ISLAND_FIELD_MASK_CHANNELS.rock, rockExposure);
    }
  }

  return { resolution, extent, height, mask, ao };
}

const cachedFields = new WeakMap<IslandBlueprint, Map<number, IslandField>>();

/** Return the stable field for a blueprint, compiling it once per resolution. */
export function islandFieldFor(
  blueprint: IslandBlueprint,
  options: IslandFieldOptions = {},
): IslandField {
  const resolution = normalizeResolution(options.resolution);
  const byResolution = cachedFields.get(blueprint) ?? new Map<number, IslandField>();
  const existing = byResolution.get(resolution);
  if (existing !== undefined) return existing;
  const field = compileIslandField(blueprint, { resolution });
  byResolution.set(resolution, field);
  cachedFields.set(blueprint, byResolution);
  return field;
}

export function sampleIslandFieldChannel(
  field: IslandField,
  channel: IslandFieldMaskChannel,
  x: number,
  z: number,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  return maskAt(
    field.mask,
    field.resolution,
    ISLAND_FIELD_MASK_CHANNELS[channel],
    gridCoordinate(x, field.extent, field.resolution),
    gridCoordinate(z, field.extent, field.resolution),
  );
}

export function sampleIslandField(field: IslandField, x: number, z: number): IslandFieldSample {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { height: 0, route: 0, grass: 0, shore: 1, rock: 0, ao: 1, inside: false };
  }
  const gx = gridCoordinate(x, field.extent, field.resolution);
  const gz = gridCoordinate(z, field.extent, field.resolution);
  const at = (channel: IslandFieldMaskChannel): number =>
    maskAt(field.mask, field.resolution, ISLAND_FIELD_MASK_CHANNELS[channel], gx, gz);
  const shore = at("shore");
  return {
    height: heightAtGrid(field.height, field.resolution, gx, gz),
    route: at("route"),
    grass: at("grass"),
    shore,
    rock: at("rock"),
    ao: byteGridAt(field.ao, field.resolution, gx, gz),
    inside: shore < 0.995,
  };
}

function byteGridAt(values: Uint8Array, resolution: number, gridX: number, gridZ: number): number {
  const x = clamp(gridX, 0, resolution - 1);
  const z = clamp(gridZ, 0, resolution - 1);
  const left = Math.floor(x);
  const top = Math.floor(z);
  const right = Math.min(resolution - 1, left + 1);
  const bottom = Math.min(resolution - 1, top + 1);
  const xAmount = x - left;
  const zAmount = z - top;
  const at = (column: number, row: number): number => values[row * resolution + column]! / 255;
  const near = lerp(at(left, top), at(right, top), xAmount);
  const far = lerp(at(left, bottom), at(right, bottom), xAmount);
  return lerp(near, far, zAmount);
}
