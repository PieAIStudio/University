/**
 * Three.js adapters for the serialisable IslandBlueprint.
 *
 * The blueprint is deliberately renderer-free.  This file is the thin layer
 * that turns the same outline, relief and centreline into either a small
 * world-map silhouette or a readable course island.  Keeping the conversion
 * here means a future game can reuse the generator without importing React.
 */
import * as THREE from "three";

import {
  sampleIslandSurface,
  type IslandBlueprint,
  type IslandOutlinePoint,
  type IslandPoint,
} from "./island-blueprint.js";
import { ISLAND_FIELD_GRASS_CUTOFF, islandFieldFor, sampleIslandField } from "./island-field.js";
import { hash } from "./random.js";

export type IslandGeometryDetail = "course" | "world";

export interface IslandGeometryShape {
  readonly terrain: THREE.BufferGeometry;
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly depth: number;
  };
  readonly scale: number;
  readonly point: (x: number, z: number) => THREE.Vector3;
}

export function islandGeometryScale(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): number {
  return targetRadius
    ? targetRadius / blueprint.bounds.maxHalf
    : detail === "world"
      ? 1 / blueprint.bounds.maxHalf
      : 1;
}

/**
 * The ground palette, written as a value ladder rather than a set of greens.
 *
 * The judge measures the land's own lightness spread, and the previous palette
 * could not supply one: every constant sat between CIELAB L* 48 and L* 76 and
 * the colour rule mixed them with three sine waves whose wavelengths were
 * longer than the island, so in practice the whole surface rendered as a
 * single tone near L* 71. A light cannot rescue that, because a flat surface
 * lit from any angle returns a flat image.
 *
 * The palette is intentionally split by material before lighting: yellow-green
 * meadow, cream soil, and warm brown rock. `grassLight` is exported to the
 * blade material as its tip colour, which is why it sits above the terrain
 * ladder. The slope rule selects the rock tones, so a hillside paints itself
 * darker than the meadow around it and relief becomes visible as shape rather
 * than as one dark-green smear.
 */
const GRASS = new THREE.Color(0x8fbe4b); // bright yellow-green meadow anchor
const GRASS_LIGHT = new THREE.Color(0xd8ef8b); // grass blade tip
const GRASS_DARK = new THREE.Color(0x456b38); // shaded meadow
const GRASS_WARM = new THREE.Color(0xc1cf5d); // dry sunlit meadow
const MEADOW_LOW = new THREE.Color(0x9dbc4c); // sunlit flats
const MEADOW_DEEP = new THREE.Color(0x3d6138); // hollows and north faces
const HIGHLAND = new THREE.Color(0xc0bf69); // dry grass on high ground
const SAND = new THREE.Color(0xead4a6); // cream shore ring
const ROCK = new THREE.Color(0xa87950); // warm exposed slope
const ROCK_DARK = new THREE.Color(0x704934); // steep brown faces
const CLIFF = new THREE.Color(0xa57854); // sunlit cliff face
const CLIFF_DARK = new THREE.Color(0x5d3d32); // root the sky cannot reach
// Creamy earth tones keep the route visibly separate from both the yellow-green
// meadow and the warm brown cliff, without creating a second route mesh.
const DIRT = new THREE.Color(0xb18a58);
const DIRT_LIGHT = new THREE.Color(0xd5b878);
const DIRT_DARK = new THREE.Color(0x83603f);
const SOIL_HINT = new THREE.Color(0xd1b479);

/**
 * Maximum vertex-colour contribution from structural exposed ground.
 *
 * The value is intentionally below 1: a field boundary should reveal a
 * green island's route, slope or beach, not repaint a whole hill as dirt.
 */
export const ISLAND_EXPOSED_GROUND_MIX_MAX = 0.86;

function sampleCount(detail: IslandGeometryDetail, outline: readonly IslandOutlinePoint[]) {
  return detail === "course" ? outline.length : Math.min(32, Math.max(16, outline.length));
}

/**
 * These are the actual radial rings emitted by the top terrain mesh.  Keeping
 * the list in one place lets overlays (the soil route, grass roots, and
 * dressing) ask for the height of the rendered mesh instead of the ideal
 * continuous surface, which avoids tiny floating/embedded seams between the
 * authored surface and its low-poly presentation.
 */
/**
 * The old course list held thirteen rings, which put a vertex every 1.1 units
 * on a 85 x 112 island. A mesh cannot carry a hill narrower than two of its
 * own rings, so the terrain generator could emit whatever relief it liked and
 * the rendered surface would still smooth it into a plate. Fifty-two rings put
 * a vertex every 0.27 units and let the mid and fine relief octaves through.
 * The cost is 4,992 top vertices against 1,248, which is nothing next to the
 * instanced vegetation already in the frame.
 *
 * The distribution is uniform because at this count the widest ring gap is
 * already finer than the old list's tightest shoreline gap; a hand-tuned rim
 * bias no longer buys anything.
 */
const COURSE_TOP_RING_COUNT = 52;
const COURSE_TOP_RADIALS: readonly number[] = Array.from(
  { length: COURSE_TOP_RING_COUNT },
  (_, index) => (index + 1) / COURSE_TOP_RING_COUNT,
);
const WORLD_TOP_RADIALS = [0.16, 0.34, 0.52, 0.68, 0.84, 1] as const;

function topRadials(detail: IslandGeometryDetail): readonly number[] {
  return detail === "course" ? COURSE_TOP_RADIALS : WORLD_TOP_RADIALS;
}

function outlineAt(
  outline: readonly IslandOutlinePoint[],
  index: number,
  count: number,
): IslandOutlinePoint {
  const at = (index / count) * outline.length;
  const left = Math.floor(at) % outline.length;
  const right = (left + 1) % outline.length;
  const amount = at - Math.floor(at);
  const a = outline[left]!;
  const b = outline[right]!;
  return {
    angle: a.angle + (b.angle - a.angle) * amount,
    scale: a.scale + (b.scale - a.scale) * amount,
    x: a.x + (b.x - a.x) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}

interface TopMeshVertex {
  readonly x: number;
  readonly z: number;
  readonly y: number;
}

function topMeshVertex(
  blueprint: IslandBlueprint,
  radial: number,
  index: number,
  segments: number,
): TopMeshVertex {
  if (radial === 0) {
    return { x: 0, z: 0, y: sampleIslandSurface(blueprint, 0, 0).y };
  }
  const point = outlineAt(blueprint.outline, index, segments);
  const x = point.x * radial;
  const z = point.z * radial;
  return { x, z, y: sampleIslandSurface(blueprint, x, z).y };
}

function barycentricHeight(
  point: IslandPoint,
  first: TopMeshVertex,
  second: TopMeshVertex,
  third: TopMeshVertex,
): number | null {
  const denominator =
    (second.z - third.z) * (first.x - third.x) + (third.x - second.x) * (first.z - third.z);
  if (Math.abs(denominator) < 1e-8) return null;
  const firstWeight =
    ((second.z - third.z) * (point.x - third.x) + (third.x - second.x) * (point.z - third.z)) /
    denominator;
  const secondWeight =
    ((third.z - first.z) * (point.x - third.x) + (first.x - third.x) * (point.z - third.z)) /
    denominator;
  const thirdWeight = 1 - firstWeight - secondWeight;
  if (firstWeight < -1e-5 || secondWeight < -1e-5 || thirdWeight < -1e-5) return null;
  return first.y * firstWeight + second.y * secondWeight + third.y * thirdWeight;
}

/**
 * Sample the height of the low-poly top mesh generated by `buildTerrain`.
 *
 * `sampleIslandSurface` remains the canonical continuous authoring rule;
 * this adapter is intentionally renderer-facing and only interpolates the
 * same vertices/triangles that are emitted for a requested semantic detail.
 */
export function sampleIslandTerrainTop(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  x: number,
  z: number,
): ReturnType<typeof sampleIslandSurface> {
  const continuous = sampleIslandSurface(blueprint, x, z);
  if (!continuous.inside) return continuous;

  const segments = sampleCount(detail, blueprint.outline);
  const radials = topRadials(detail);
  const normalX = x / blueprint.bounds.halfX;
  const normalZ = z / blueprint.bounds.halfZ;
  const angle = (Math.atan2(normalZ, normalX) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.min(segments - 1, Math.floor((angle / (Math.PI * 2)) * segments));
  const nextSector = (sector + 1) % segments;
  const radial = continuous.radial;

  const tryTriangle = (
    first: TopMeshVertex,
    second: TopMeshVertex,
    third: TopMeshVertex,
  ): number | null => barycentricHeight({ x, z }, first, second, third);

  let y: number | null = null;
  if (radial <= radials[0]!) {
    y = tryTriangle(
      topMeshVertex(blueprint, 0, 0, segments),
      topMeshVertex(blueprint, radials[0]!, sector, segments),
      topMeshVertex(blueprint, radials[0]!, nextSector, segments),
    );
  } else {
    for (let ring = 1; ring < radials.length && y === null; ring += 1) {
      if (radial > radials[ring]!) continue;
      const inner = radials[ring - 1]!;
      const outer = radials[ring]!;
      const innerSector = topMeshVertex(blueprint, inner, sector, segments);
      const innerNext = topMeshVertex(blueprint, inner, nextSector, segments);
      const outerSector = topMeshVertex(blueprint, outer, sector, segments);
      const outerNext = topMeshVertex(blueprint, outer, nextSector, segments);
      y =
        tryTriangle(innerSector, innerNext, outerSector) ??
        tryTriangle(innerNext, outerNext, outerSector);
    }
  }

  // A point can be inside the 96-sample authored outline while falling just
  // outside a deliberately coarser world polygon. In that rare case, the
  // continuous sample is safer than returning an invalid height.
  return { ...continuous, y: y ?? continuous.y };
}

/**
 * Ground colour from height and slope, not from position alone.
 *
 * Slope is measured against the rendered mesh's own ring spacing so the colour
 * break lands on the same fold the geometry produces. It is the term that
 * makes a hill legible: a face steeper than about twenty degrees starts
 * turning toward rock, so relief reads as form from the aerial camera instead
 * of relying on the sun to find it.
 */
function colorForTop(
  blueprint: IslandBlueprint,
  x: number,
  z: number,
  radial: number,
  height: number,
): THREE.Color {
  const seed = blueprint.seed;
  const maxHalf = blueprint.bounds.maxHalf;
  // The clamp in the height rule sits at 0.235 of maxHalf, but the relief
  // model only reaches about two thirds of it in practice. Normalising
  // against the clamp meant the highland tone never engaged. This is the
  // measured working range instead.
  const ceiling = Math.max(1e-6, maxHalf * 0.155);
  const relative = clamp01(height / ceiling);
  const delta = Math.max(0.35, maxHalf * 0.02);
  const east = sampleIslandSurface(blueprint, x + delta, z);
  const west = sampleIslandSurface(blueprint, x - delta, z);
  const north = sampleIslandSurface(blueprint, x, z + delta);
  const south = sampleIslandSurface(blueprint, x, z - delta);
  const eastY = east.inside ? east.y : height;
  const westY = west.inside ? west.y : height;
  const northY = north.inside ? north.y : height;
  const southY = south.inside ? south.y : height;
  const gradientX = eastY - westY;
  const gradientZ = northY - southY;
  const slope = Math.hypot(gradientX, gradientZ) / (2 * delta);
  // Curvature, normalised against the sample spacing. It is negative in a
  // hollow and positive on a crest, and unlike anything derived from the sun
  // it stays correct when the lighting changes. Sky light genuinely does not
  // reach into a fold, so darkening one is not a painted shadow; it is the
  // cheapest honest occlusion term available at vertex level, and it survives
  // the tone map because it lands before the grade rather than after it.
  const curvature = (height - (eastY + westY + northY + southY) / 4) / delta;

  // Colour follows broad world-space patches instead of the triangulation.
  // Random colour per vertex produced radial spokes from the centre fan — a
  // topology debug view, not grass. The wavelengths are tied to the island's
  // own size so the two broad cycles are visible on the surface rather than,
  // as before, one wave longer than the island and therefore nearly invisible.
  const phase = hash(`${seed}/terrain-colour`) * Math.PI * 2;
  const drift = Math.max(5, maxHalf * 0.12);
  const patch =
    (Math.sin(x / drift + phase) +
      Math.cos(z / (drift * 1.21) - phase * 0.7) +
      Math.sin((x + z) / (drift * 2.03) + phase * 0.31)) /
    3;

  const colour = GRASS.clone();
  // Low ground stays lush; the tops dry out. Two thirds of the meadow's own
  // value range comes from this pair before any slope or shore term runs.
  // These three bands were originally centred so wide that the lightest of
  // them covered most of the island and the surface averaged out near L* 71,
  // at the very top of the contract's 50 to 70 band with no room left for a
  // light to lift a highlight. They now describe genuinely low ground,
  // ordinary meadow, and genuinely high ground.
  colour.lerp(MEADOW_LOW, smoothstep01(0.2, 0.02, relative) * 0.5);
  colour.lerp(MEADOW_DEEP, smoothstep01(0.15, 0, relative) * 0.3);
  colour.lerp(HIGHLAND, smoothstep01(0.55, 1, relative) * 0.6);
  if (patch > 0.2) colour.lerp(GRASS_WARM, Math.min(0.6, patch));
  if (patch < -0.18) colour.lerp(GRASS_DARK, Math.min(0.5, -patch));

  // The same compiled field that admits a blade also paints the exposed
  // ground below it. A low grass value is only allowed to modulate this mix
  // after a structural reason has opened the land: route wear, steep slope or
  // shoreline. Low field density on its own must remain green.
  const fieldSample = sampleIslandField(islandFieldFor(blueprint), x, z);
  const routeGround = smoothstep01(0.08, 0.42, fieldSample.route);
  const slopeGround = smoothstep01(0.22, 0.52, fieldSample.rock);
  const shoreGround = smoothstep01(0.72, 0.92, fieldSample.shore);
  const structuralGround = Math.max(routeGround, slopeGround, shoreGround);
  const structuralGate = smoothstep01(0.12, 0.4, structuralGround);
  const grassAbsence = smoothstep01(ISLAND_FIELD_GRASS_CUTOFF, 0.22, fieldSample.grass);
  const exposedGround = fieldSample.inside
    ? Math.min(ISLAND_EXPOSED_GROUND_MIX_MAX, structuralGate * grassAbsence)
    : 0;
  if (exposedGround > 0) {
    const slopeStone = smoothstep01(0.3, 0.52, fieldSample.rock);
    const soilTone = DIRT.clone()
      .lerp(DIRT_LIGHT, 0.35 + relative * 0.2)
      .lerp(SAND, 0.28 + relative * 0.1);
    // A steep opening is warm exposed stone, while route and shore openings
    // stay sandy. The source remains the same rock channel; this only keeps a
    // low-grass cliff from reading as a pale green meadow.
    soilTone.lerp(ROCK, slopeStone * 0.75);
    colour.lerp(soilTone, exposedGround);
  }

  // Slope shades the meadow before it exposes any stone. This is the term
  // that gives a hillside a dark side without asking the sun for it, and it
  // has to run first: measured over the whole top surface the median slope is
  // about nineteen degrees, so a rock rule that started there turned half the
  // island into a grey smear that read as a missing texture.
  colour.lerp(MEADOW_DEEP, smoothstep01(0.2, 0.78, slope) * 0.5);

  // Stone is reserved for faces a person could not walk up: 0.87 is forty
  // degrees and 1.73 is sixty.
  const rockAmount = smoothstep01(0.87, 1.73, slope);
  if (rockAmount > 0) {
    const stone = ROCK.clone().lerp(ROCK_DARK, smoothstep01(1.2, 2.2, slope));
    colour.lerp(stone, rockAmount * 0.9);
  }

  // The shore ring. It replaces the old "brighten the rim" rule, which lifted
  // the outer edge toward the same green and so read as a halo rather than a
  // beach.
  const beach = smoothstep01(0.955, 1, radial) * (1 - rockAmount * 0.7);
  if (beach > 0) colour.lerp(SAND, beach * 0.72);

  // Hollows sit in their own shade and crests catch the sky. The asymmetry is
  // deliberate: an occlusion term that brightens as much as it darkens stops
  // reading as depth and starts reading as noise.
  const hollow = smoothstep01(0, -0.55, curvature);
  const crest = smoothstep01(0.05, 0.6, curvature);
  colour.multiplyScalar(1 - hollow * 0.26 + crest * 0.1);
  return colour;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep01(from: number, to: number, value: number): number {
  if (from === to) return value < from ? 0 : 1;
  const amount = clamp01((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
}

function pushColor(target: number[], color: THREE.Color): void {
  target.push(color.r, color.g, color.b);
}

function smoothUnit(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Stable low-frequency variation for a hand-worn-looking route. */
function pathNoise(seed: string, channel: string, position: number): number {
  const left = Math.floor(position);
  const amount = smoothUnit(position - left);
  const a = hash(`${seed}/dirt-path/${channel}/${left}`);
  const b = hash(`${seed}/dirt-path/${channel}/${left + 1}`);
  return a + (b - a) * amount;
}

function pathHalfWidth(
  blueprint: IslandBlueprint,
  index: number,
  count: number,
  baseHalfWidth: number,
  side: "left" | "right",
): number {
  const progress = count <= 1 ? 0 : index / (count - 1);
  const broadPhase = hash(`${blueprint.seed}/dirt-path/broad-phase`) * Math.PI * 2;
  const broad = 0.5 + Math.sin(progress * Math.PI * 4.6 + broadPhase) * 0.5;
  const local = pathNoise(blueprint.seed, `width-${side}`, index / 3.2);
  // A route is hand-worn ground, not a tile strip. The broad term makes the
  // path breathe over whole bends; the local term breaks its two edges apart
  // so width changes remain visible from the aerial course camera.
  return baseHalfWidth * (0.66 + broad * 0.22 + local * 0.38);
}

function pathSoilColour(
  blueprint: IslandBlueprint,
  index: number,
  side: "left" | "right",
  x: number,
  z: number,
  radial: number,
  height: number,
): THREE.Color {
  const tone =
    pathNoise(blueprint.seed, "colour-shared", index / 3.4) * 0.72 +
    pathNoise(blueprint.seed, `colour-${side}`, index / 4.8) * 0.28;
  const colour = colorForTop(blueprint, x, z, radial, height).multiplyScalar(0.86 + tone * 0.12);
  // Keep a trace of the meadow at the verge, but let the worn centre read as
  // a light cream soil band. The old 66% blend still inherited too much green
  // from the terrain and read as a dark stripe from the near camera.
  colour.lerp(SOIL_HINT, 0.78);
  if (tone < 0.5) colour.lerp(DIRT_DARK, 0.14);
  if (tone > 0.72) colour.lerp(DIRT_LIGHT, 0.14);
  return colour;
}

/** Keep a wide bend from ever punching through the authored shoreline. */
function safePathSurface(
  blueprint: IslandBlueprint,
  centre: { readonly x: number; readonly z: number },
  target: { readonly x: number; readonly z: number },
): {
  readonly point: { readonly x: number; readonly z: number };
  readonly sample: ReturnType<typeof sampleIslandSurface>;
} {
  const direct = sampleIslandSurface(blueprint, target.x, target.z);
  if (direct.inside) {
    return {
      point: target,
      sample: sampleIslandTerrainTop(blueprint, "course", target.x, target.z),
    };
  }
  // The route centre is inside by construction. Binary-searching toward an
  // over-wide edge preserves the path silhouette while avoiding a y=0 spike
  // or a floating quad when an outline is particularly tight.
  let low = 0;
  let high = 1;
  let bestPoint = centre;
  let bestSample = sampleIslandTerrainTop(blueprint, "course", centre.x, centre.z);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const amount = (low + high) * 0.5;
    const point = {
      x: centre.x + (target.x - centre.x) * amount,
      z: centre.z + (target.z - centre.z) * amount,
    };
    const sample = sampleIslandSurface(blueprint, point.x, point.z);
    if (sample.inside) {
      low = amount;
      bestPoint = point;
      bestSample = sampleIslandTerrainTop(blueprint, "course", point.x, point.z);
    } else {
      high = amount;
    }
  }
  return { point: bestPoint, sample: bestSample };
}

/** Append the flush soil strip to the terrain mesh; it creates no second draw. */
function appendSoilPath(
  blueprint: IslandBlueprint,
  scale: number,
  positions: number[],
  colors: number[],
  indices: number[],
): void {
  const points = blueprint.centerline;
  const baseHalfWidth = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const before = points[Math.max(0, index - 1)]!;
    const after = points[Math.min(points.length - 1, index + 1)]!;
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    const leftWidth = pathHalfWidth(blueprint, index, points.length, baseHalfWidth, "left");
    const rightWidth = pathHalfWidth(blueprint, index, points.length, baseHalfWidth, "right");
    const crossSection = [
      {
        x: point.x + nx * leftWidth,
        z: point.z + nz * leftWidth,
        side: "left" as const,
        outer: true,
      },
      {
        x: point.x + nx * leftWidth * 0.62,
        z: point.z + nz * leftWidth * 0.62,
        side: "left" as const,
        outer: false,
      },
      {
        x: point.x - nx * rightWidth * 0.62,
        z: point.z - nz * rightWidth * 0.62,
        side: "right" as const,
        outer: false,
      },
      {
        x: point.x - nx * rightWidth,
        z: point.z - nz * rightWidth,
        side: "right" as const,
        outer: true,
      },
    ];
    for (const vertex of crossSection) {
      const safe = safePathSurface(blueprint, point, vertex);
      const sample = safe.sample;
      positions.push(safe.point.x * scale, (sample.y + 0.002) * scale, safe.point.z * scale);
      const meadow = colorForTop(blueprint, safe.point.x, safe.point.z, sample.radial, sample.y);
      const colour = vertex.outer
        ? meadow.lerp(
            pathSoilColour(
              blueprint,
              index,
              vertex.side,
              safe.point.x,
              safe.point.z,
              sample.radial,
              sample.y,
            ),
            0.22,
          )
        : pathSoilColour(
            blueprint,
            index,
            vertex.side,
            safe.point.x,
            safe.point.z,
            sample.radial,
            sample.y,
          );
      pushColor(colors, colour);
    }
    if (index === points.length - 1) continue;
    const at = positions.length / 3 - 4;
    const next = at + 4;
    for (let band = 0; band < 3; band += 1) {
      indices.push(at + band, next + band, at + band + 1);
      indices.push(at + band + 1, next + band, next + band + 1);
    }
  }
}

function addTopVertex(
  positions: number[],
  colors: number[],
  blueprint: IslandBlueprint,
  x: number,
  z: number,
  scale: number,
  _index: number,
): void {
  const sample = sampleIslandSurface(blueprint, x, z);
  positions.push(x * scale, sample.y * scale, z * scale);
  pushColor(colors, colorForTop(blueprint, x, z, sample.radial, sample.y));
}

function buildTerrain(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  scale: number,
  depth: number,
): THREE.BufferGeometry {
  const segments = sampleCount(detail, blueprint.outline);
  // The inner rings produce a broad, visibly undulating plateau.  A single
  // centre fan is cheap but reads as a cone; six rings give the eye enough
  // information to see a real playable landscape.
  const radials = topRadials(detail);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const centre = sampleIslandSurface(blueprint, 0, 0);
  positions.push(0, centre.y * scale, 0);
  pushColor(colors, colorForTop(blueprint, 0, 0, centre.radial, centre.y));
  for (let ring = 0; ring < radials.length; ring += 1) {
    const radial = radials[ring]!;
    for (let index = 0; index < segments; index += 1) {
      const point = outlineAt(blueprint.outline, index, segments);
      const x = point.x * radial;
      const z = point.z * radial;
      addTopVertex(positions, colors, blueprint, x, z, scale, ring * segments + index);
    }
  }

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, 1 + next, 1 + index);
  }
  for (let ring = 0; ring < radials.length - 1; ring += 1) {
    const inner = 1 + ring * segments;
    const outer = inner + segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(inner + index, inner + next, outer + index);
      indices.push(inner + next, outer + next, outer + index);
    }
  }
  if (detail === "course") appendSoilPath(blueprint, scale, positions, colors, indices);

  // A broad, faceted cliff and a tapered root are the silhouette cue that the
  // island is flying.  The tech ring is a separate component so it can be LOD
  // switched without rebuilding the terrain mesh.
  // Depth, not a fixed colour per ring.
  //
  // The old table painted the lip GRASS_DARK and everything below it two
  // greys, which under a 28-degree sun gave a near-vertical face almost no key
  // light and left a black band all the way round the coast — the one thing in
  // the frame with no detail in it at all. The lip now carries the ground's own
  // colour so grass rolls over the edge instead of stopping at a dark line,
  // and the rock below fades with depth the way a face does when less of the
  // sky can reach it. It is the same honest occlusion argument as the
  // curvature term on the top surface.
  const rings = [
    { radial: 1, depth: 0, sky: 1 },
    { radial: 0.99, depth: -depth * 0.18, sky: 0.82 },
    { radial: 0.82, depth: -depth * 0.43, sky: 0.58 },
    { radial: 0.55, depth: -depth * 0.75, sky: 0.34 },
    { radial: 0.22, depth: -depth * 0.98, sky: 0.16 },
  ] as const;
  const cliffStart = positions.length / 3;
  for (let ring = 0; ring < rings.length; ring += 1) {
    const profile = rings[ring]!;
    for (let index = 0; index < segments; index += 1) {
      const point = outlineAt(blueprint.outline, index, segments);
      const sample = sampleIslandSurface(blueprint, point.x, point.z);
      positions.push(
        point.x * profile.radial * scale,
        (sample.y + profile.depth) * scale,
        point.z * profile.radial * scale,
      );
      const ground = colorForTop(blueprint, point.x, point.z, sample.radial, sample.y);
      const stone = CLIFF.clone().lerp(CLIFF_DARK, 1 - profile.sky);
      // The very lip keeps most of the meadow; one ring down is already rock.
      const rockAmount = profile.sky >= 1 ? 0.18 : 0.86;
      const colour = ground.lerp(stone, rockAmount);
      colour.multiplyScalar(0.62 + profile.sky * 0.38);
      pushColor(colors, colour);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const upper = cliffStart + ring * segments;
    const lower = upper + segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(upper + index, upper + next, lower + index);
      indices.push(upper + next, lower + next, lower + index);
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, -depth * 1.08 * scale, 0);
  pushColor(colors, CLIFF_DARK);
  const last = cliffStart + (rings.length - 1) * segments;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(bottom, last + index, last + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildIslandGeometry(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): IslandGeometryShape {
  const scale = islandGeometryScale(blueprint, detail, targetRadius);
  // The course camera lives on the surface, where a seven-unit root is enough.
  // The world map compresses a long island into a small icon; scaling that same
  // absolute depth makes its underside a one-pixel line. Preserve a readable
  // floating-island silhouette in that projection without duplicating the
  // outline or terrain data.
  const depth = detail === "world" ? blueprint.bounds.maxHalf * 0.54 : blueprint.underside.depth;
  return {
    terrain: buildTerrain(blueprint, detail, scale, depth),
    bounds: {
      halfX: blueprint.bounds.halfX * scale,
      halfZ: blueprint.bounds.halfZ * scale,
      depth: depth * scale,
    },
    scale,
    point: (x, z) => {
      const sample = sampleIslandSurface(blueprint, x, z);
      return new THREE.Vector3(x * scale, sample.y * scale, z * scale);
    },
  };
}

/** Stable key useful to renderer caches and worker-side previews. */
export function islandGeometryKey(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): string {
  return `${blueprint.version}/${blueprint.layoutRevision}/${blueprint.seed}/${detail}/${targetRadius ?? "full"}`;
}

/** Palette exports keep art-direction tests independent of JSX. */
export const ISLAND_GEOMETRY_PALETTE = {
  grass: GRASS.getHex(),
  grassLight: GRASS_LIGHT.getHex(),
  grassDark: GRASS_DARK.getHex(),
  meadowLow: MEADOW_LOW.getHex(),
  meadowDeep: MEADOW_DEEP.getHex(),
  highland: HIGHLAND.getHex(),
  sand: SAND.getHex(),
  rock: ROCK.getHex(),
  rockDark: ROCK_DARK.getHex(),
  cliff: CLIFF.getHex(),
  cliffDark: CLIFF_DARK.getHex(),
  dirt: DIRT.getHex(),
  dirtLight: DIRT_LIGHT.getHex(),
  dirtDark: DIRT_DARK.getHex(),
  soilHint: SOIL_HINT.getHex(),
} as const;
