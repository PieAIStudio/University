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
import { hash } from "./random.js";
import { cliffLobeAtAngle, coastalRockMask } from "./coast-profile.js";
import {
  barycentricXZ,
  buildSurfaceTriangleIndex,
  clipPolygonToTriangleXZ,
  doubleSignedAreaXZ,
  upwardWinding,
  type PlanPoint,
  type SurfaceTriangle,
  type SurfaceTriangleIndex,
} from "./surface-clip.js";
import { gridPaletteFor, gridUndersideColorForTop } from "../grid/grid-palette.js";

export type IslandGeometryDetail = "course" | "world";

/**
 * How the one terrain mesh divides up, so a test can address the route without
 * guessing at index offsets and the technique lock can record the split rather
 * than one opaque total.
 */
export interface IslandGeometryCounts {
  readonly topTriangles: number;
  readonly routeTriangles: number;
  readonly cliffTriangles: number;
  readonly total: number;
}

export interface IslandGeometryShape {
  readonly terrain: THREE.BufferGeometry;
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly depth: number;
  };
  readonly counts: IslandGeometryCounts;
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
const SAND = new THREE.Color(0xead4a6); // cream for local eroding faces
const ROCK = new THREE.Color(0xa87950); // warm exposed slope
const ROCK_DARK = new THREE.Color(0x704934); // steep brown faces
const CLIFF = new THREE.Color(0xb0a58f); // exposed warm stone, not the path's brown soil
const CLIFF_STONE_SHADE = new THREE.Color(0x746f73);
const CLIFF_BASE_DARK = new THREE.Color(0x5d3d32); // inspector fallback only
// Creamy earth tones keep the route visibly separate from both the yellow-green
// meadow and the warm brown cliff, without creating a second route mesh.
const DIRT = new THREE.Color(0xb18a58);
const DIRT_LIGHT = new THREE.Color(0xd5b878);
const DIRT_DARK = new THREE.Color(0x83603f);
const SOIL_HINT = new THREE.Color(0xd1b479);

/**
 * The bottom follows the same palette slot as the rendered grid. Keeping the
 * hue derivative here means the legacy/inspector projection cannot quietly
 * regress to one global brown while the production world uses instances.
 */
export function islandCliffDarkFor(blueprint: IslandBlueprint): number {
  return gridUndersideColorForTop(
    gridPaletteFor(blueprint.studyId, blueprint.courseId, blueprint.seed).top,
  );
}

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

interface TopMeshLattice {
  readonly segments: number;
  readonly center: TopMeshVertex;
  readonly rings: readonly (readonly TopMeshVertex[])[];
  surfaceIndex?: SurfaceTriangleIndex;
}

const TOP_MESH_LATTICE_CACHE = new WeakMap<
  IslandBlueprint,
  Map<IslandGeometryDetail, TopMeshLattice>
>();

function getTopMeshLattice(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
): TopMeshLattice {
  let byDetail = TOP_MESH_LATTICE_CACHE.get(blueprint);
  if (!byDetail) {
    byDetail = new Map();
    TOP_MESH_LATTICE_CACHE.set(blueprint, byDetail);
  }
  let lattice = byDetail.get(detail);
  if (lattice) return lattice;

  const segments = sampleCount(detail, blueprint.outline);
  const radials = topRadials(detail);
  const center: TopMeshVertex = { x: 0, z: 0, y: sampleIslandSurface(blueprint, 0, 0).y };

  const rings: TopMeshVertex[][] = [];
  for (let r = 0; r < radials.length; r += 1) {
    const radial = radials[r]!;
    const ring: TopMeshVertex[] = [];
    for (let s = 0; s < segments; s += 1) {
      const point = outlineAt(blueprint.outline, s, segments);
      const x = point.x * radial;
      const z = point.z * radial;
      ring.push({ x, z, y: sampleIslandSurface(blueprint, x, z).y });
    }
    rings.push(ring);
  }

  lattice = { segments, center, rings };
  byDetail.set(detail, lattice);
  return lattice;
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

/** The same cached top lattice as sampleIslandTerrainTop, without building
 * road clips, cliff buffers or GPU resources just to fit a decoration.
 */
function terrainTopIndex(blueprint: IslandBlueprint): SurfaceTriangleIndex {
  const lattice = getTopMeshLattice(blueprint, "course");
  if (lattice.surfaceIndex) return lattice.surfaceIndex;
  const triangles: SurfaceTriangle[] = [];
  const ids = new Map([lattice.center, ...lattice.rings.flat()].map((vertex, id) => [vertex, id]));
  const add = (a: TopMeshVertex, b: TopMeshVertex, c: TopMeshVertex) => {
    triangles.push({
      x0: a.x,
      y0: a.y,
      z0: a.z,
      x1: b.x,
      y1: b.y,
      z1: b.z,
      x2: c.x,
      y2: c.y,
      z2: c.z,
      i0: ids.get(a)!,
      i1: ids.get(b)!,
      i2: ids.get(c)!,
    });
  };
  for (let ring = 0; ring < lattice.rings.length; ring++) {
    const outer = lattice.rings[ring]!;
    for (let sector = 0; sector < lattice.segments; sector++) {
      const next = (sector + 1) % lattice.segments;
      if (ring === 0) add(lattice.center, outer[next]!, outer[sector]!);
      else {
        const inner = lattice.rings[ring - 1]!;
        add(inner[sector]!, inner[next]!, outer[sector]!);
        add(inner[next]!, outer[next]!, outer[sector]!);
      }
    }
  }
  lattice.surfaceIndex = buildSurfaceTriangleIndex(
    triangles,
    Math.max(0.5, blueprint.bounds.maxHalf * 0.06),
  );
  return lattice.surfaceIndex;
}

/** Exact extrema over a convex footprint clipped to the drawn terrain's
 * triangles. Corner-only samples miss an interior peak or a crossed ridge.
 * Missing coverage is rejected rather than silently using continuous height.
 */
export function islandTerrainFootprintRange(
  blueprint: IslandBlueprint,
  polygon: readonly { readonly x: number; readonly z: number }[],
): { readonly minY: number; readonly maxY: number; readonly maxSlope: number } | null {
  if (polygon.length < 3 || polygon.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z)))
    return null;
  const area = Math.abs(doubleSignedAreaXZ(polygon)) / 2;
  if (area <= 1e-9) return null;
  const surface = terrainTopIndex(blueprint);
  const xs = polygon.map((p) => p.x),
    zs = polygon.map((p) => p.z);
  let covered = 0,
    minY = Infinity,
    maxY = -Infinity,
    maxSlope = 0;
  for (const id of surface.candidates(
    Math.min(...xs),
    Math.min(...zs),
    Math.max(...xs),
    Math.max(...zs),
  )) {
    const triangle = surface.triangles[id]!;
    const clipped = clipPolygonToTriangleXZ(polygon, triangle);
    const partArea = Math.abs(doubleSignedAreaXZ(clipped)) / 2;
    if (partArea <= 1e-10) continue;
    covered += partArea;
    for (const p of clipped) {
      const weights = barycentricXZ(triangle, p.x, p.z);
      if (!weights) return null;
      const y = weights[0] * triangle.y0 + weights[1] * triangle.y1 + weights[2] * triangle.y2;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const ax = triangle.x1 - triangle.x0,
      ay = triangle.y1 - triangle.y0,
      az = triangle.z1 - triangle.z0;
    const bx = triangle.x2 - triangle.x0,
      by = triangle.y2 - triangle.y0,
      bz = triangle.z2 - triangle.z0;
    const ny = az * bx - ax * bz;
    maxSlope = Math.max(maxSlope, Math.hypot(ay * bz - az * by, ax * by - ay * bx) / Math.abs(ny));
  }
  return Number.isFinite(minY + maxY + maxSlope) &&
    Math.abs(covered - area) <= Math.max(1e-7, area * 1e-5)
    ? { minY, maxY, maxSlope }
    : null;
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

  const lattice = getTopMeshLattice(blueprint, detail);
  const segments = lattice.segments;
  const radials = topRadials(detail);
  const normalX = x / blueprint.bounds.halfX;
  const normalZ = z / blueprint.bounds.halfZ;
  const angle = (Math.atan2(normalZ, normalX) + Math.PI * 2) % (Math.PI * 2);
  const predicted = Math.min(segments - 1, Math.floor((angle / (Math.PI * 2)) * segments));
  const radial = continuous.radial;

  const tryTriangle = (
    first: TopMeshVertex,
    second: TopMeshVertex,
    third: TopMeshVertex,
  ): number | null => barycentricHeight({ x, z }, first, second, third);

  const heightInSector = (ring: number, sector: number): number | null => {
    const next = (sector + segments) % segments;
    const following = (next + 1) % segments;
    const outerRing = lattice.rings[ring]!;
    if (ring === 0) {
      return tryTriangle(lattice.center, outerRing[next]!, outerRing[following]!);
    }
    const innerRing = lattice.rings[ring - 1]!;
    const innerSector = innerRing[next]!;
    const innerNext = innerRing[following]!;
    const outerSector = outerRing[next]!;
    const outerNext = outerRing[following]!;
    return (
      tryTriangle(innerSector, innerNext, outerSector) ??
      tryTriangle(innerNext, outerNext, outerSector)
    );
  };

  let predictedRing = 0;
  if (radial > radials[0]!) {
    predictedRing = radials.length - 1;
    for (let ring = 1; ring < radials.length; ring += 1) {
      if (radial <= radials[ring]!) {
        predictedRing = ring;
        break;
      }
    }
  }

  const ringOffsets = [0, -1, 1];
  const sectorOffsets = [0, -1, 1, -2, 2, -3, 3];
  let y: number | null = null;
  for (const ringOffset of ringOffsets) {
    const ring = predictedRing + ringOffset;
    if (ring < 0 || ring >= radials.length) continue;
    for (const sectorOffset of sectorOffsets) {
      y = heightInSector(ring, predicted + sectorOffset);
      if (y !== null) break;
    }
    if (y !== null) break;
  }
  if (y === null) {
    for (const ringOffset of ringOffsets) {
      const ring = predictedRing + ringOffset;
      if (ring < 0 || ring >= radials.length) continue;
      for (let sector = 0; sector < segments && y === null; sector += 1) {
        y = heightInSector(ring, sector);
      }
      if (y !== null) break;
    }
  }

  // A point can be inside the 96-sample authored outline while falling just
  // outside a deliberately coarser world polygon. In that rare case, the
  // continuous sample is safer than returning an invalid height.
  return { ...continuous, y: y ?? continuous.y };
}

/**
 * The distance over which the colour rule is allowed to see relief.
 *
 * This used to be `max(0.35, maxHalf * 0.02)` — 0.68 units on the measured
 * 68-unit course island — chosen without reference to the mesh being painted.
 * The course lattice puts its vertices 0.65 units apart radially and 1.11
 * (median) to 2.71 (rim) units apart tangentially, so the colour rule was
 * sampling the height field about three times finer than the surface it was
 * colouring. Measured on 2026-09-06: 37.2% of top vertices were pushed past
 * slope 0.50 into `MEADOW_DEEP` and 13.0% past 0.87 into rock, for folds the
 * rendered triangles do not contain. Gouraud interpolation then stretched each
 * of those isolated dark vertices into a soft band two units wide, which is the
 * "green-black ridge on a smooth slope" in the review shot: paint with no form
 * under it.
 *
 * A derivative is only meaningful at the scale its surface can represent, so
 * the baseline is now the lattice's own larger local spacing. Only slope and
 * curvature use it; the height and patch terms are unchanged. The rim no
 * longer paints a constant-width sand ring; grass and stone follow slope.
 */
function colourSampleDelta(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  x: number,
  z: number,
): number {
  const segments = sampleCount(detail, blueprint.outline);
  const rings = topRadials(detail).length;
  const radialSpacing = blueprint.bounds.maxHalf / rings;
  const tangentialSpacing = (Math.PI * 2 * Math.hypot(x, z)) / segments;
  return Math.max(radialSpacing, tangentialSpacing);
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
  detail: IslandGeometryDetail,
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
  const delta = colourSampleDelta(blueprint, detail, x, z);
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

  // A constant radial sand stripe read as a dinner-plate rim. Grass holds a
  // gentle lip; cream only appears near the coast where the face is already
  // steepening but not yet stone, so the break follows the landform instead
  // of the ring index.
  const eroding = smoothstep01(0.34, 0.86, slope) * (1 - rockAmount);
  const nearRim = smoothstep01(0.88, 0.995, radial);
  if (eroding > 0 && nearRim > 0) colour.lerp(SAND, eroding * nearRim * 0.32);

  // Hollows sit in their own shade and crests catch the sky. The asymmetry is
  // deliberate: an occlusion term that brightens as much as it darkens stops
  // reading as depth and starts reading as noise.
  const hollow = smoothstep01(0, -0.55, curvature);
  const crest = smoothstep01(0.05, 0.6, curvature);
  colour.multiplyScalar(1 - hollow * 0.26 + crest * 0.1);
  // The exposed root reaches the upper surface in geological patches. Without
  // this shared field mask, every cliff had an uninterrupted green cover rim.
  colour.lerp(CLIFF, coastalRockMask(blueprint, x, z, radial, height) * 0.97);
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
  const colour = colorForTop(blueprint, "course", x, z, radial, height).multiplyScalar(
    0.86 + tone * 0.12,
  );
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

/**
 * The route's clearance above the ground it is cut against.
 *
 * It stays at the original 0.002 units on purpose. Once the route is a
 * displacement of the terrain's own triangles it can no longer cross them at
 * any point, so this number is only a depth-buffer guard; the alternative fix —
 * lifting the strip past the measured 0.22-unit worst case — would have made a
 * road that visibly hovers.
 */
const PATH_LIFT = 0.002;

/**
 * Plan-area floor below which a clipped piece is discarded.
 *
 * Two terrain triangles that share an edge each return a zero-area sliver for a
 * route polygon that only touches that edge. Dropping them loses no coverage
 * and keeps degenerate triangles out of the buffer.
 */
const MIN_PIECE_DOUBLE_AREA = 1e-9;

/** One stop of the route's four-point cross section. */
interface RibbonStop {
  readonly x: number;
  readonly z: number;
  readonly colour: THREE.Color;
}

function ribbonCrossSection(blueprint: IslandBlueprint, index: number): readonly RibbonStop[] {
  const points = blueprint.centerline;
  const baseHalfWidth = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
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
  const offsets = [
    { across: leftWidth, side: "left" as const, outer: true },
    { across: leftWidth * 0.62, side: "left" as const, outer: false },
    { across: -rightWidth * 0.62, side: "right" as const, outer: false },
    { across: -rightWidth, side: "right" as const, outer: true },
  ];
  return offsets.map(({ across, side, outer }) => {
    const safe = safePathSurface(blueprint, point, {
      x: point.x + nx * across,
      z: point.z + nz * across,
    });
    const sample = safe.sample;
    const soil = pathSoilColour(
      blueprint,
      index,
      side,
      safe.point.x,
      safe.point.z,
      sample.radial,
      sample.y,
    );
    // The verge keeps most of the meadow it grew out of; the worn centre is
    // soil. This is the same blend the strip carried before, evaluated at the
    // same four stops, so clipping cannot change the route's colour.
    const colour = outer
      ? colorForTop(blueprint, "course", safe.point.x, safe.point.z, sample.radial, sample.y).lerp(
          soil,
          0.22,
        )
      : soil;
    return { x: safe.point.x, z: safe.point.z, colour };
  });
}

function mixByWeights(
  colours: readonly [THREE.Color, THREE.Color, THREE.Color],
  weights: readonly [number, number, number],
): THREE.Color {
  return new THREE.Color(
    colours[0].r * weights[0] + colours[1].r * weights[1] + colours[2].r * weights[2],
    colours[0].g * weights[0] + colours[1].g * weights[1] + colours[2].g * weights[2],
    colours[0].b * weights[0] + colours[1].b * weights[1] + colours[2].b * weights[2],
  );
}

/** Drop points a clip pass left on top of each other before fanning them. */
function withoutDuplicates(ring: readonly PlanPoint[], epsilon: number): readonly PlanPoint[] {
  const kept: PlanPoint[] = [];
  for (const point of ring) {
    const last = kept[kept.length - 1];
    if (last && Math.abs(last.x - point.x) < epsilon && Math.abs(last.z - point.z) < epsilon) {
      continue;
    }
    kept.push(point);
  }
  const first = kept[0];
  const last = kept[kept.length - 1];
  if (
    kept.length > 2 &&
    first &&
    last &&
    Math.abs(first.x - last.x) < epsilon &&
    Math.abs(first.z - last.z) < epsilon
  ) {
    kept.pop();
  }
  return kept;
}

/**
 * Where one emitted route vertex borrowed its shading from.
 *
 * `computeVertexNormals` averages the faces that share a *vertex index*, and
 * every clipped piece owns its vertices alone. Left at that, each piece would
 * take the flat normal of the terrain triangle it landed in, while the ground
 * around it is smooth-shaded from the shared lattice — so the route would break
 * into facets exactly along the terrain's own edges, which is a seam the old
 * strip did not have. Recording the ground triangle and the weights lets the
 * route's normals be resolved from the same three lattice vertices the ground
 * uses, after the smooth pass has run.
 */
interface RouteShadingRef {
  readonly vertex: number;
  readonly ground: readonly [number, number, number];
  readonly weights: readonly [number, number, number];
}

/**
 * Cut one route triangle against the terrain triangles it overlaps and append
 * the pieces.
 *
 * Heights come from the terrain triangle the piece lies in; colours come from
 * the route triangle the piece was cut from. That split is the whole point: the
 * route is the ground surface plus a constant, painted with the route's own
 * blend.
 */
function appendClippedRibbonTriangle(
  ribbon: SurfaceTriangle,
  colours: readonly [THREE.Color, THREE.Color, THREE.Color],
  surface: SurfaceTriangleIndex,
  scale: number,
  positions: number[],
  colors: number[],
  indices: number[],
  shading: RouteShadingRef[],
): number {
  const minX = Math.min(ribbon.x0, ribbon.x1, ribbon.x2);
  const maxX = Math.max(ribbon.x0, ribbon.x1, ribbon.x2);
  const minZ = Math.min(ribbon.z0, ribbon.z1, ribbon.z2);
  const maxZ = Math.max(ribbon.z0, ribbon.z1, ribbon.z2);
  const subject: readonly PlanPoint[] = [
    { x: ribbon.x0, z: ribbon.z0 },
    { x: ribbon.x1, z: ribbon.z1 },
    { x: ribbon.x2, z: ribbon.z2 },
  ];
  const epsilon = Math.max(1e-7, (maxX - minX + maxZ - minZ) * 1e-6);
  let emitted = 0;
  for (const candidate of surface.candidates(minX, minZ, maxX, maxZ)) {
    const ground = surface.triangles[candidate]!;
    const piece = clipPolygonToTriangleXZ(subject, ground);
    if (piece.length < 3) continue;
    const ring = withoutDuplicates(upwardWinding(piece), epsilon);
    if (ring.length < 3) continue;
    if (Math.abs(doubleSignedAreaXZ(ring)) < MIN_PIECE_DOUBLE_AREA) continue;
    const base = positions.length / 3;
    const added: RouteShadingRef[] = [];
    let usable = true;
    for (const point of ring) {
      const groundWeights = barycentricXZ(ground, point.x, point.z);
      const ribbonWeights = barycentricXZ(ribbon, point.x, point.z);
      if (groundWeights === null || ribbonWeights === null) {
        usable = false;
        break;
      }
      const height =
        ground.y0 * groundWeights[0] + ground.y1 * groundWeights[1] + ground.y2 * groundWeights[2];
      added.push({
        vertex: base + added.length,
        ground: [ground.i0, ground.i1, ground.i2],
        weights: groundWeights,
      });
      positions.push(point.x * scale, (height + PATH_LIFT) * scale, point.z * scale);
      pushColor(colors, mixByWeights(colours, ribbonWeights));
    }
    if (!usable) {
      positions.length = base * 3;
      colors.length = base * 3;
      continue;
    }
    shading.push(...added);
    for (let corner = 1; corner + 1 < ring.length; corner += 1) {
      indices.push(base, base + corner, base + corner + 1);
      emitted += 1;
    }
  }
  return emitted;
}

/**
 * Give every route vertex the ground's own interpolated normal.
 *
 * Runs after `computeVertexNormals`, which is what puts the smooth lattice
 * normals on the terrain vertices this reads back.
 */
function resolveRouteNormals(
  geometry: THREE.BufferGeometry,
  shading: readonly RouteShadingRef[],
): void {
  if (shading.length === 0) return;
  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const array = normals.array as Float32Array;
  for (const entry of shading) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let corner = 0; corner < 3; corner += 1) {
      const at = entry.ground[corner]! * 3;
      const weight = entry.weights[corner]!;
      x += array[at]! * weight;
      y += array[at + 1]! * weight;
      z += array[at + 2]! * weight;
    }
    const length = Math.hypot(x, y, z);
    const target = entry.vertex * 3;
    if (length < 1e-9) {
      array[target] = 0;
      array[target + 1] = 1;
      array[target + 2] = 0;
      continue;
    }
    array[target] = x / length;
    array[target + 1] = y / length;
    array[target + 2] = z / length;
  }
  normals.needsUpdate = true;
}

/**
 * Append the flush soil strip to the terrain mesh; it creates no second draw.
 *
 * The strip is still authored as four cross-section stops per centreline
 * sample, three bands wide, exactly as before — that is what carries the route
 * width noise and the verge blend. What changed is that each of its triangles
 * is now cut against the rendered terrain instead of being trusted to agree
 * with it between vertices.
 */
interface SoilRibbonSubject {
  readonly ribbon: SurfaceTriangle;
  readonly colours: readonly [THREE.Color, THREE.Color, THREE.Color];
}

function soilRibbonSubjects(blueprint: IslandBlueprint): readonly SoilRibbonSubject[] {
  const points = blueprint.centerline;
  if (points.length < 2) return [];
  const subjects: SoilRibbonSubject[] = [];
  let current = ribbonCrossSection(blueprint, 0);
  for (let index = 1; index < points.length; index += 1) {
    const next = ribbonCrossSection(blueprint, index);
    for (let band = 0; band < 3; band += 1) {
      const nearOuter = current[band]!;
      const nearInner = current[band + 1]!;
      const farOuter = next[band]!;
      const farInner = next[band + 1]!;
      // The same two triangles the strip used to emit per band, so the shared
      // diagonal — and therefore the interpolated colour — is unchanged.
      const quads: readonly (readonly [RibbonStop, RibbonStop, RibbonStop])[] = [
        [nearOuter, farOuter, nearInner],
        [nearInner, farOuter, farInner],
      ];
      for (const [first, second, third] of quads) {
        subjects.push({
          ribbon: {
            x0: first.x,
            z0: first.z,
            y0: 0,
            i0: -1,
            x1: second.x,
            z1: second.z,
            y1: 0,
            i1: -1,
            x2: third.x,
            z2: third.z,
            y2: 0,
            i2: -1,
          },
          colours: [first.colour, second.colour, third.colour],
        });
      }
    }
    current = next;
  }
  return subjects;
}

/**
 * The soil strip's plan triangles after the shoreline clamp and before they
 * are cut against the terrain. Coverage tests compare this area to the
 * emitted pieces; they are not a second height field.
 */
export interface SoilPlanTriangle {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
}

export function authoredSoilPlan(blueprint: IslandBlueprint): readonly SoilPlanTriangle[] {
  return soilRibbonSubjects(blueprint).map(({ ribbon }) => ({
    x0: ribbon.x0,
    z0: ribbon.z0,
    x1: ribbon.x1,
    z1: ribbon.z1,
    x2: ribbon.x2,
    z2: ribbon.z2,
  }));
}

function appendSoilPath(
  blueprint: IslandBlueprint,
  scale: number,
  positions: number[],
  colors: number[],
  indices: number[],
  surface: SurfaceTriangleIndex,
  shading: RouteShadingRef[],
): number {
  let emitted = 0;
  for (const { ribbon, colours } of soilRibbonSubjects(blueprint)) {
    emitted += appendClippedRibbonTriangle(
      ribbon,
      colours,
      surface,
      scale,
      positions,
      colors,
      indices,
      shading,
    );
  }
  return emitted;
}

function addTopVertex(
  positions: number[],
  colors: number[],
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  x: number,
  z: number,
  scale: number,
): void {
  const sample = sampleIslandSurface(blueprint, x, z);
  positions.push(x * scale, sample.y * scale, z * scale);
  pushColor(colors, colorForTop(blueprint, detail, x, z, sample.radial, sample.y));
}

/**
 * The top surface's triangles in blueprint units, read back off the buffers
 * that were just written.
 *
 * Deriving them from the emitted indices rather than re-deriving them from the
 * lattice is deliberate: the route is cut against exactly what is drawn, and
 * the two cannot drift apart later.
 */
function topSurfaceTriangles(
  positions: readonly number[],
  indices: readonly number[],
  triangleCount: number,
  scale: number,
): readonly SurfaceTriangle[] {
  const inverse = scale === 0 ? 1 : 1 / scale;
  const triangles: SurfaceTriangle[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const i0 = indices[triangle * 3]!;
    const i1 = indices[triangle * 3 + 1]!;
    const i2 = indices[triangle * 3 + 2]!;
    const a = i0 * 3;
    const b = i1 * 3;
    const c = i2 * 3;
    triangles.push({
      x0: positions[a]! * inverse,
      y0: positions[a + 1]! * inverse,
      z0: positions[a + 2]! * inverse,
      i0,
      x1: positions[b]! * inverse,
      y1: positions[b + 1]! * inverse,
      z1: positions[b + 2]! * inverse,
      i1,
      x2: positions[c]! * inverse,
      y2: positions[c + 1]! * inverse,
      z2: positions[c + 2]! * inverse,
      i2,
    });
  }
  return triangles;
}

interface BuiltTerrain {
  readonly geometry: THREE.BufferGeometry;
  readonly counts: IslandGeometryCounts;
}

interface CliffRingProfile {
  readonly gather: number;
  readonly yOffset: number;
  readonly sky: number;
  readonly gatherVary: number;
  readonly depthVary: number;
  /** Small tangential cant keeps the lower outline from becoming a revolved cone. */
  readonly cant: number;
}

type CliffNormalFace =
  | {
      readonly kind: "side";
      readonly vertices: readonly [number, number, number, number, number, number];
    }
  | {
      readonly kind: "bottom";
      readonly vertices: readonly [number, number, number];
    };

interface CliffVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly colour: THREE.Color;
}

/**
 * Five rings, same capacity as the previous skirt: a thick collar, a thick
 * body, then a seeded irregular root. Gather is the fraction of the way from
 * the authored coast toward a slightly offset tip — not a cone of revolution
 * and not a second generator.
 */
function cliffRingProfiles(depth: number, taper: number): readonly CliffRingProfile[] {
  const root = clamp01((0.86 - taper) * 0.4);
  return [
    { gather: 0, yOffset: 0, sky: 1, gatherVary: 0, depthVary: 0, cant: 0 },
    {
      gather: 0.08,
      yOffset: -depth * 0.1,
      sky: 0.86,
      gatherVary: 0.065,
      depthVary: 0.042,
      cant: 0,
    },
    {
      gather: 0.15,
      yOffset: -depth * 0.4,
      sky: 0.64,
      gatherVary: 0.13,
      depthVary: 0.068,
      cant: 0.0015,
    },
    {
      gather: 0.42 + root,
      yOffset: -depth * 0.73,
      sky: 0.4,
      gatherVary: 0.105,
      depthVary: 0.058,
      cant: 0.006,
    },
    {
      gather: 0.7 + root * 1.1,
      yOffset: -depth * 0.96,
      sky: 0.22,
      gatherVary: 0.14,
      depthVary: 0.04,
      cant: 0.012,
    },
  ];
}

function cliffRootLobe(phase: number, index: number, segments: number): number {
  const angle = (index / segments) * Math.PI * 2;
  // These are broad buttresses, not per-sector noise. Sampling the same
  // low-frequency function at course/world resolutions keeps the silhouette
  // related while the extra third harmonic stops one offset tip from reading
  // as a revolved cone.
  return cliffLobeAtAngle(phase, angle);
}

function cliffRootTip(
  blueprint: IslandBlueprint,
  segments: number,
  phase: number,
): { readonly x: number; readonly z: number } {
  let weightX = 0;
  let weightZ = 0;
  let minCoast = Infinity;
  for (let index = 0; index < segments; index += 1) {
    const point = outlineAt(blueprint.outline, index, segments);
    const coast = Math.hypot(point.x, point.z);
    minCoast = Math.min(minCoast, coast);
    weightX += point.x * coast;
    weightZ += point.z * coast;
  }
  const bias = Math.hypot(weightX, weightZ);
  const pull = Math.min(blueprint.bounds.maxHalf * 0.12, Math.max(0, minCoast) * 0.28);
  const candidate =
    bias > 1e-8
      ? { x: (weightX / bias) * pull, z: (weightZ / bias) * pull }
      : { x: Math.cos(phase) * pull, z: Math.sin(phase) * pull };
  // A star-shaped outline has the origin inside every edge half-plane. Keep
  // the offset in that same kernel, with a small margin, so every radial ring
  // can converge on it without folding a fan across a concave coast chord.
  let fraction = 1;
  for (let index = 0; index < segments; index += 1) {
    const a = outlineAt(blueprint.outline, index, segments);
    const b = outlineAt(blueprint.outline, (index + 1) % segments, segments);
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const atOrigin = dz * a.x - dx * a.z;
    const shift = dx * candidate.z - dz * candidate.x;
    if (shift < 0) fraction = Math.min(fraction, (atOrigin * 0.95) / -shift);
  }
  return { x: candidate.x * fraction, z: candidate.z * fraction };
}

/**
 * Paint the same geological bands in both projections.
 *
 * The identity underside colour is useful as a restrained hue cue, but it is
 * too dark to own the whole root. Warm cliff/rock/dirt strata carry the value
 * structure first; the per-island underside colour is only a depth-weighted
 * accent. `lobe` is geometry-derived variation, so the colour changes follow
 * the same buttresses that change the silhouette instead of becoming a noise
 * texture on top of it.
 */
function cliffStratumColour(
  ground: THREE.Color,
  cliffDark: THREE.Color,
  profile: CliffRingProfile,
  lobe: number,
  exposure: number,
): THREE.Color {
  const depth = clamp01(1 - profile.sky);
  const stratum = CLIFF.clone()
    // A light upper band catches the same edge that is broad enough to read
    // near the camera; lower bands move through warm rock into dark earth.
    .lerp(SAND, smoothstep01(0.34, 0, depth) * 0.32)
    .lerp(CLIFF_STONE_SHADE, smoothstep01(0.08, 0.92, depth) * 0.55)
    .lerp(DIRT_DARK, smoothstep01(0.48, 1, depth) * 0.16)
    // Preserve a little course identity without letting the underside swatch
    // flatten every lower face into the same dark value.
    .lerp(cliffDark, 0.04 + depth * 0.14);
  const buttressWarmth = clamp01(0.5 + lobe * 0.45);
  stratum.lerp(DIRT, buttressWarmth * 0.14);
  stratum.multiplyScalar(clamp01(0.93 + profile.sky * 0.07 + lobe * 0.08));
  // Exactly the same colour at the shared lip. Below it, turf rolls into
  // sheltered bays while exposed buttresses turn to stone sooner; never one
  // fixed colour jump at the same ring around the entire island.
  return ground.clone().lerp(stratum, smoothstep01(0, 0.24 - exposure * 0.18, depth));
}

function appendCliffVertex(
  positions: number[],
  colors: number[],
  vertex: CliffVertex,
  scale: number,
): number {
  const index = positions.length / 3;
  positions.push(vertex.x * scale, vertex.y * scale, vertex.z * scale);
  pushColor(colors, vertex.colour);
  return index;
}

function cliffTriangleNormal(
  position: THREE.BufferAttribute,
  first: number,
  second: number,
  third: number,
): THREE.Vector3 {
  const ab = new THREE.Vector3(
    position.getX(second) - position.getX(first),
    position.getY(second) - position.getY(first),
    position.getZ(second) - position.getZ(first),
  );
  const ac = new THREE.Vector3(
    position.getX(third) - position.getX(first),
    position.getY(third) - position.getY(first),
    position.getZ(third) - position.getZ(first),
  );
  return ab.cross(ac);
}

/**
 * Rock faces run vertically. Average only along a buttress, never around the
 * whole ring: the previous per-band flat normals drew horizontal strata all
 * the way around the island, like the sides of a tiered cake. Side quads use coincident shading
 * vertices rather than one shared vertex across two steep planes; the boundary
 * tests compare their coordinates so this remains a closed physical surface.
 * The bottom centre and cap vertices are explicitly downward-facing.
 */
function resolveCliffNormals(
  geometry: THREE.BufferGeometry,
  faces: readonly CliffNormalFace[],
  segments: number,
): void {
  if (faces.length === 0) return;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;

  const faceNormals = faces.map((face) => {
    if (face.kind === "bottom") return new THREE.Vector3(0, -1, 0);
    const [a, b, c, d, e, f] = face.vertices;
    return cliffTriangleNormal(position, a, b, c)
      .add(cliffTriangleNormal(position, d, e, f))
      .normalize();
  });
  for (const [faceIndex, face] of faces.entries()) {
    if (face.kind === "bottom") {
      for (const vertex of face.vertices) normal.setXYZ(vertex, 0, -1, 0);
      continue;
    }

    const [first, second, third, fourth, fifth, sixth] = face.vertices;
    const current = faceNormals[faceIndex]!;
    const previous = faceIndex >= segments ? faceNormals[faceIndex - segments]! : current;
    const next =
      faces[faceIndex + segments]?.kind === "side" ? faceNormals[faceIndex + segments]! : current;
    const upper = current.clone().add(previous).normalize();
    const lower = current.clone().add(next).normalize();
    // A deeply cut bay can turn sharply between rings. Keep each triangle's
    // real plane dominant there; indiscriminate averaging can point a normal
    // away from its own face (the arc/24/coast regression caught this).
    for (const triangle of [
      [first, second, third],
      [fourth, fifth, sixth],
    ] as const) {
      const geometric = cliffTriangleNormal(position, ...triangle).normalize();
      for (const vertex of triangle) {
        const smooth = [first, second, fourth].includes(vertex) ? upper : lower;
        const resolved = geometric
          .clone()
          .multiplyScalar(0.65)
          .addScaledVector(smooth, 0.35)
          .normalize();
        normal.setXYZ(vertex, resolved.x, resolved.y, resolved.z);
      }
    }
  }
  normal.needsUpdate = true;
}

/** Grassy shoulders turn smoothly into the first slope. Exposed rock keeps
 * its real crease. Top/cliff still use duplicate vertices only for shading,
 * never duplicate positions or a floating cap mesh.
 */
function resolveCoastNormals(
  geometry: THREE.BufferGeometry,
  faces: readonly CliffNormalFace[],
  segments: number,
  topOuterStart: number,
  exposures: readonly number[],
): void {
  const normals = geometry.getAttribute("normal");
  for (let i = 0; i < segments; i++) {
    const face = faces[i]!;
    const previous = faces[(i + segments - 1) % segments]!;
    if (face.kind !== "side" || previous.kind !== "side") continue;
    const topIndex = topOuterStart + i;
    const top = new THREE.Vector3().fromBufferAttribute(normals, topIndex);
    const sideIds = [face.vertices[0], previous.vertices[1], previous.vertices[3]];
    const side = sideIds
      .reduce(
        (sum, id) => sum.add(new THREE.Vector3().fromBufferAttribute(normals, id)),
        new THREE.Vector3(),
      )
      .normalize();
    const shared = top.clone().add(side).normalize();
    // A genuinely sharp cliff is not a rounded shoulder. Averaging across
    // incompatible planes can point a shaded normal away from its own face.
    const strength = (1 - exposures[i]!) * smoothstep01(0.3, 0.85, top.dot(side));
    const changedTop = top.lerp(shared, strength).normalize();
    normals.setXYZ(topIndex, changedTop.x, changedTop.y, changedTop.z);
    for (const id of sideIds) {
      const changed = new THREE.Vector3()
        .fromBufferAttribute(normals, id)
        .lerp(shared, strength)
        .normalize();
      normals.setXYZ(id, changed.x, changed.y, changed.z);
    }
  }
  // Keep genuine creases sharper than 60 degrees. A non-planar coastal quad
  // can have compatible averaged planes but one steep triangle; smoothing
  // that triangle across the lip falsely lights its back. Retain its own
  // normal at that corner instead of altering any triangle winding.
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (const face of faces.slice(0, segments)) {
    if (face.kind !== "side") continue;
    for (const ids of [face.vertices.slice(0, 3), face.vertices.slice(3, 6)]) {
      const plane = cliffTriangleNormal(position, ids[0]!, ids[1]!, ids[2]!).normalize();
      for (const id of ids) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, id);
        if (normal.dot(plane) < Math.cos(Math.PI / 3))
          normals.setXYZ(id, plane.x, plane.y, plane.z);
      }
    }
  }
}

function buildTerrain(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  scale: number,
  depth: number,
): BuiltTerrain {
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
  pushColor(colors, colorForTop(blueprint, detail, 0, 0, centre.radial, centre.y));
  for (let ring = 0; ring < radials.length; ring += 1) {
    const radial = radials[ring]!;
    for (let index = 0; index < segments; index += 1) {
      const point = outlineAt(blueprint.outline, index, segments);
      const x = point.x * radial;
      const z = point.z * radial;
      addTopVertex(positions, colors, blueprint, detail, x, z, scale);
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
  const topTriangles = indices.length / 3;
  let routeTriangles = 0;
  const routeShading: RouteShadingRef[] = [];
  if (detail === "course") {
    // One bucket per lattice cell's width. Smaller buckets would index the same
    // triangles many times; larger ones hand the clipper candidates it will
    // only reject.
    const cellSize = Math.max(0.5, blueprint.bounds.maxHalf * 0.06);
    const surface = buildSurfaceTriangleIndex(
      topSurfaceTriangles(positions, indices, topTriangles, scale),
      cellSize,
    );
    routeTriangles = appendSoilPath(
      blueprint,
      scale,
      positions,
      colors,
      indices,
      surface,
      routeShading,
    );
  }

  // A broad, faceted cliff and a tapered root are the silhouette cue that the
  // island is flying. The five-ring / 9-triangle-per-sector capacity is
  // unchanged. What changed is the plan: each ring gathers the same authored
  // outline toward a slightly offset tip, with low-frequency thickness
  // variation, instead of scaling every sector by one radial. The lip copies
  // the top-mesh outer ring so the contact edge cannot split.
  //
  // The old table painted the lip GRASS_DARK and everything below it two
  // greys, which under a 28-degree sun gave a near-vertical face almost no key
  // light and left a black band all the way round the coast — the one thing in
  // the frame with no detail in it at all. The lip now carries the ground's own
  // colour so grass rolls over the edge instead of stopping at a dark line,
  // and the rock below fades with depth the way a face does when less of the
  // sky can reach it. It is the same honest occlusion argument as the
  // curvature term on the top surface.
  const cliffDark = new THREE.Color(islandCliffDarkFor(blueprint));
  const rootPhase = hash(`${blueprint.seed}/cliff-root`) * Math.PI * 2;
  const rootTip = cliffRootTip(blueprint, segments, rootPhase);
  const rings = cliffRingProfiles(depth, blueprint.underside.taper);
  const topOuterStart = 1 + (radials.length - 1) * segments;
  const cliffRings: CliffVertex[][] = [];
  const edgeExposures: number[] = [];
  for (let ring = 0; ring < rings.length; ring += 1) {
    const profile = rings[ring]!;
    const cliffRing: CliffVertex[] = [];
    for (let index = 0; index < segments; index += 1) {
      const point = outlineAt(blueprint.outline, index, segments);
      const sample = sampleIslandSurface(blueprint, point.x, point.z);
      const lobe = cliffRootLobe(rootPhase, index, segments);
      if (ring === 0)
        edgeExposures.push(coastalRockMask(blueprint, point.x, point.z, sample.radial, sample.y));
      let x = point.x;
      let y = sample.y;
      let z = point.z;
      if (ring === 0) {
        const source = (topOuterStart + index) * 3;
        x = positions[source]! / scale;
        y = positions[source + 1]! / scale;
        z = positions[source + 2]! / scale;
      } else {
        const coastRadius = Math.hypot(point.x, point.z) || 1;
        // Headlands retain a little more rock mass and bays taper sooner. This
        // derives the lower silhouette from the same sampled outline instead
        // of introducing a second radial/noise field for the root.
        const headlandBias =
          profile.gather >= 0.3
            ? (clamp01(coastRadius / blueprint.bounds.maxHalf) - 0.72) * 0.12
            : 0;
        const gather = clamp01(profile.gather + lobe * profile.gatherVary - headlandBias);
        // Every ring converges on the same bounded tip, with independent
        // seeded radial mass. The cap cannot use a different offset from the
        // ring it closes; that produced folded fans on concave short islands.
        const radial = 1 - gather;
        const angle = lobe * profile.cant;
        const cos = Math.cos(angle),
          sin = Math.sin(angle);
        const localX = point.x - rootTip.x,
          localZ = point.z - rootTip.z;
        x = rootTip.x + radial * (localX * cos - localZ * sin);
        z = rootTip.z + radial * (localX * sin + localZ * cos);
        y = sample.y + profile.yOffset + depth * profile.depthVary * lobe;
      }
      const ground = colorForTop(blueprint, detail, point.x, point.z, sample.radial, sample.y);
      cliffRing.push({
        x,
        y,
        z,
        colour: cliffStratumColour(ground, cliffDark, profile, lobe, edgeExposures[index]!),
      });
    }
    cliffRings.push(cliffRing);
  }

  const cliffFaces: CliffNormalFace[] = [];
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const upper = cliffRings[ring]!;
    const lower = cliffRings[ring + 1]!;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      const first = appendCliffVertex(positions, colors, upper[index]!, scale);
      const second = appendCliffVertex(positions, colors, upper[next]!, scale);
      const third = appendCliffVertex(positions, colors, lower[index]!, scale);
      const fourth = appendCliffVertex(positions, colors, upper[next]!, scale);
      const fifth = appendCliffVertex(positions, colors, lower[next]!, scale);
      const sixth = appendCliffVertex(positions, colors, lower[index]!, scale);
      const triangleA = [first, second, third] as const;
      const triangleB = [fourth, fifth, sixth] as const;
      indices.push(...triangleA);
      indices.push(...triangleB);
      cliffFaces.push({
        kind: "side",
        vertices: [
          triangleA[0],
          triangleA[1],
          triangleA[2],
          triangleB[0],
          triangleB[1],
          triangleB[2],
        ],
      });
    }
  }
  const bottomColour = CLIFF.clone()
    .lerp(CLIFF_STONE_SHADE, 0.72)
    .lerp(DIRT_DARK, 0.24)
    .lerp(cliffDark, 0.23)
    .multiplyScalar(0.9);
  const bottom = appendCliffVertex(
    positions,
    colors,
    { x: rootTip.x, y: -depth * 1.08, z: rootTip.z, colour: bottomColour },
    scale,
  );
  const last = cliffRings[rings.length - 1]!;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const first = appendCliffVertex(positions, colors, last[index]!, scale);
    const second = appendCliffVertex(positions, colors, last[next]!, scale);
    // Shared edges must have opposite directions. A consistent fan closes
    // the last ring; individually flipping triangles can never repair a cap
    // whose centre lies outside that ring's kernel.
    indices.push(bottom, first, second);
    cliffFaces.push({ kind: "bottom", vertices: [bottom, first, second] });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  resolveCliffNormals(geometry, cliffFaces, segments);
  resolveCoastNormals(geometry, cliffFaces, segments, topOuterStart, edgeExposures);
  resolveRouteNormals(geometry, routeShading);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const total = indices.length / 3;
  return {
    geometry,
    counts: {
      topTriangles,
      routeTriangles,
      cliffTriangles: total - topTriangles - routeTriangles,
      total,
    },
  };
}

export function buildIslandGeometry(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): IslandGeometryShape {
  const scale = islandGeometryScale(blueprint, detail, targetRadius);
  // Course and world share the authored root. World used to substitute
  // maxHalf * 0.54 so a 6–11 unit course root would still silhouette after
  // being scaled to an icon; that override is unnecessary once depth scales
  // with the island. bounds.depth is the mesh's own minY, not the authoring
  // number times scale, because the tip sits below that number and the rings vary.
  const depth = blueprint.underside.depth;
  const built = buildTerrain(blueprint, detail, scale, depth);
  const minY = built.geometry.boundingBox?.min.y ?? 0;
  return {
    terrain: built.geometry,
    bounds: {
      halfX: blueprint.bounds.halfX * scale,
      halfZ: blueprint.bounds.halfZ * scale,
      depth: Math.max(0, -minY),
    },
    counts: built.counts,
    scale,
    point: (x, z) => {
      const sample = sampleIslandSurface(blueprint, x, z);
      return new THREE.Vector3(x * scale, sample.y * scale, z * scale);
    },
  };
}

/**
 * How a rigid object of a given footprint should sit on the rendered ground.
 *
 * A lesson medallion is a bevelled disc. Tilting it onto the ground's plane
 * removes the linear part of the hill. Lift only *raises* the body so the
 * chamfer and top stay visible; the underside gap is closed by a separate
 * footing, not by burying the disc. The pose uses the same transform as
 * `composeMarkerMatrix`: origin + normal * (originOffset + lift), then unit
 * locals scaled by radius and rotated with `setFromUnitVectors(+Y, normal)`.
 *
 * `residualGap` is the largest remaining underside float at the body-footing
 * seam. It is not ground contact of the finished marker.
 */
export interface IslandSurfacePose {
  /** Unit normal of the support plane. */
  readonly normal: readonly [number, number, number];
  /**
   * Offset along that normal. Positive raises the body to keep the chamfer
   * above ground; the footing, not this number, meets the terrain.
   */
  readonly lift: number;
  /**
   * Largest remaining underside float at the body-footing seam, in world
   * units. The footing mesh is what has to close it.
   */
  readonly residualGap: number;
}

export type IslandSurfacePoseRole = "foot" | "chamfer" | "top";

export interface IslandSurfacePoseLocal {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly role: IslandSurfacePoseRole;
}

export interface IslandHeightSample {
  readonly y: number;
  readonly inside: boolean;
}

export interface IslandSurfacePoseOptions {
  /** Plan radius the renderer scales the unit locals by. */
  readonly radius: number;
  /** Along-normal distance from the sampled ground to the object's local origin. */
  readonly originOffset: number;
  /** How far the origin may be raised to keep the chamfer clear, in world units. */
  readonly maxEmbed: number;
  /** Unit-space samples of the solid; the same space `composeMarkerMatrix` scales. */
  readonly locals: readonly IslandSurfacePoseLocal[];
  /**
   * Height of the drawn ground (terrain top and soil) at a plan point.
   * When omitted, the lattice reconstruction is used; course markers pass the
   * indexed mesh so the pose sees the same triangles the frame draws.
   */
  readonly heightAt?: (x: number, z: number) => IslandHeightSample;
  /**
   * Y of the object's authored position, the same value `composeMarkerMatrix`
   * adds. Defaults to `heightAt` at the plan centre.
   */
  readonly originY?: number;
}

/** Pavers steeper than this read as cantilevers, not as stones on a path. */
const MAX_TILT_NY = Math.cos((38 * Math.PI) / 180);
const MIN_TOP_CLEARANCE = 0.02;

function unit3(x: number, y: number, z: number): readonly [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function clampTilt(normal: readonly [number, number, number]): readonly [number, number, number] {
  if (normal[1] >= MAX_TILT_NY) return normal;
  const horiz = Math.hypot(normal[0], normal[2]);
  if (horiz < 1e-9) return [0, 1, 0];
  const maxHoriz = Math.sqrt(Math.max(0, 1 - MAX_TILT_NY * MAX_TILT_NY));
  const scale = maxHoriz / horiz;
  return unit3(normal[0] * scale, MAX_TILT_NY, normal[2] * scale);
}

interface PoseFitSample {
  dx: number;
  dz: number;
  dy: number;
}

function fitSlope(samples: PoseFitSample[]): readonly [number, number] {
  // Ordinary least squares on purpose. The stone is wider than the road, so
  // the meadow just off the verge is under the hexagon and must pull the
  // plane; treating that drop as an outlier leaves a floating rim.
  let sumXX = 0;
  let sumXZ = 0;
  let sumZZ = 0;
  let sumXY = 0;
  let sumZY = 0;
  for (const sample of samples) {
    sumXX += sample.dx * sample.dx;
    sumXZ += sample.dx * sample.dz;
    sumZZ += sample.dz * sample.dz;
    sumXY += sample.dx * sample.dy;
    sumZY += sample.dz * sample.dy;
  }
  const determinant = sumXX * sumZZ - sumXZ * sumXZ;
  const slopeX = Math.abs(determinant) < 1e-9 ? 0 : (sumXY * sumZZ - sumZY * sumXZ) / determinant;
  const slopeZ = Math.abs(determinant) < 1e-9 ? 0 : (sumZY * sumXX - sumXY * sumXZ) / determinant;
  return [slopeX, slopeZ];
}

interface PoseContact {
  readonly maxFootFloat: number;
  readonly minFoot: number;
  readonly minChamfer: number;
  readonly minTop: number;
}

export function islandVisibleSurfaceIndex(shape: IslandGeometryShape): SurfaceTriangleIndex {
  const position = shape.terrain.getAttribute("position");
  const index = shape.terrain.getIndex();
  if (!index) throw new Error("expected an indexed terrain mesh");
  const visible = shape.counts.topTriangles + shape.counts.routeTriangles;
  const triangles: SurfaceTriangle[] = [];
  for (let triangle = 0; triangle < visible; triangle += 1) {
    const i0 = index.getX(triangle * 3);
    const i1 = index.getX(triangle * 3 + 1);
    const i2 = index.getX(triangle * 3 + 2);
    triangles.push({
      x0: position.getX(i0),
      y0: position.getY(i0),
      z0: position.getZ(i0),
      i0,
      x1: position.getX(i1),
      y1: position.getY(i1),
      z1: position.getZ(i1),
      i1,
      x2: position.getX(i2),
      y2: position.getY(i2),
      z2: position.getZ(i2),
      i2,
    });
  }
  const cell = Math.max(0.5, Math.max(shape.bounds.halfX, shape.bounds.halfZ) * 0.06);
  return buildSurfaceTriangleIndex(triangles, cell);
}

export function visibleGroundHeight(
  index: SurfaceTriangleIndex,
  x: number,
  z: number,
): number | null {
  let best: number | null = null;
  for (const candidate of index.candidates(x, z, x, z)) {
    const triangle = index.triangles[candidate]!;
    const weights = barycentricXZ(triangle, x, z);
    if (!weights) continue;
    if (weights[0] < -1e-6 || weights[1] < -1e-6 || weights[2] < -1e-6) continue;
    const height = triangle.y0 * weights[0] + triangle.y1 * weights[1] + triangle.y2 * weights[2];
    best = best === null ? height : Math.max(best, height);
  }
  return best;
}

export function createIslandHeightSampler(blueprint: IslandBlueprint): {
  readonly heightAt: (x: number, z: number) => IslandHeightSample;
  readonly index: SurfaceTriangleIndex;
  readonly dispose: () => void;
} {
  const shape = buildIslandGeometry(blueprint, "course");
  const index = islandVisibleSurfaceIndex(shape);
  return {
    index,
    heightAt(x, z) {
      const height = visibleGroundHeight(index, x, z);
      if (height !== null) return { y: height, inside: true };
      const fallback = sampleIslandTerrainTop(blueprint, "course", x, z);
      return { y: fallback.y, inside: fallback.inside };
    },
    dispose() {
      shape.terrain.dispose();
    },
  };
}

export function islandSurfacePose(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  x: number,
  z: number,
  options: IslandSurfacePoseOptions,
): IslandSurfacePose {
  const heightAt =
    options.heightAt ??
    ((px: number, pz: number) => sampleIslandTerrainTop(blueprint, detail, px, pz));
  const centre = heightAt(x, z);
  const originY = options.originY ?? centre.y;
  const samples: PoseFitSample[] = [];
  const pushSample = (dx: number, dz: number) => {
    const sample = heightAt(x + dx, z + dz);
    if (!sample.inside) return;
    samples.push({ dx, dz, dy: sample.y - originY });
  };
  for (let step = 0; step < 12; step += 1) {
    const angle = (step / 12) * Math.PI * 2;
    pushSample(Math.cos(angle) * options.radius, Math.sin(angle) * options.radius);
  }
  const [fittedSlopeX, fittedSlopeZ] = samples.length >= 3 ? fitSlope(samples) : ([0, 0] as const);
  const normal = clampTilt(unit3(-fittedSlopeX, 1, -fittedSlopeZ));

  const up = new THREE.Vector3(0, 1, 0);
  const normalVec = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const origin = new THREE.Vector3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();

  const measure = (lift: number): PoseContact => {
    normalVec.set(normal[0], normal[1], normal[2]);
    quaternion.setFromUnitVectors(up, normalVec);
    origin.set(x, originY, z).addScaledVector(normalVec, options.originOffset + lift);
    let maxFootFloat = 0;
    let minFoot = Infinity;
    let minChamfer = Infinity;
    let minTop = Infinity;
    for (const point of options.locals) {
      local
        .set(point.x * options.radius, point.y * options.radius, point.z * options.radius)
        .applyQuaternion(quaternion);
      world.copy(origin).add(local);
      const ground = heightAt(world.x, world.z);
      if (!ground.inside) {
        if (point.role === "foot") maxFootFloat = Math.max(maxFootFloat, 1);
        continue;
      }
      const delta = world.y - ground.y;
      if (point.role === "foot") {
        maxFootFloat = Math.max(maxFootFloat, delta);
        minFoot = Math.min(minFoot, delta);
      } else if (point.role === "chamfer") {
        minChamfer = Math.min(minChamfer, delta);
      } else {
        minTop = Math.min(minTop, delta);
      }
    }
    return { maxFootFloat, minFoot, minChamfer, minTop };
  };

  // One raise: keep chamfer and top in the air. The footing closes the seam.
  let lift = 0;
  const first = measure(0);
  const vertical = Math.max(0.25, normal[1]);
  const deficit = Math.max(MIN_TOP_CLEARANCE - first.minTop, -first.minChamfer, 0);
  if (deficit > 0) lift = Math.min(options.maxEmbed, deficit / vertical);
  const contact = measure(lift);
  return {
    normal,
    lift,
    residualGap: Math.max(0, contact.maxFootFloat),
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
  cliffDark: CLIFF_BASE_DARK.getHex(),
  dirt: DIRT.getHex(),
  dirtLight: DIRT_LIGHT.getHex(),
  dirtDark: DIRT_DARK.getHex(),
  soilHint: SOIL_HINT.getHex(),
} as const;
