/** Game-art rocks: the one rock of the course island, from Kenney's Nature Kit.
 *
 * R59-06 (owner, 2026-09-23): the procedural hexagonal boulders of R58-02 read
 * as fake and all alike — the Kenney mini-forest column style, one silhouette
 * repeated across the island. Every rock is now one of fifteen CC0 Nature Kit
 * rocks, baked to CPU mesh data (kenney-stone-shapes.json, written by
 * apps/university/scripts/bake-kenney-stones.mjs): five chunky boulders, five
 * spires, five small stones, each with the kit's own irregular facets. They are
 * turned and scaled uniformly — never squashed; a flattened Kenney slab is what
 * the owner called thin and cheap in R58 — and coloured by the island's warm
 * grey ramp, their grass caps in meadow green where a rock wears turf.
 *
 * The outcrop, the roadside rocks, the ground stones and the lock stones are
 * all built from this one primitive. Downstream nothing changes: a rock is
 * still a list of points (with its own mass and colour band) and faces, which
 * the outcrop's grounding and the plants rooted on its top read exactly.
 */
import * as THREE from "three";
import stoneShapes from "./kenney-stone-shapes.json" with { type: "json" };
import { hash } from "./random.js";

interface StoneShape {
  readonly id: string;
  readonly set: "boulder" | "spire" | "small";
  readonly size: readonly [number, number, number];
  readonly positions: readonly number[];
  readonly indices: readonly number[];
  /** Per triangle: 0 rock, 1 grass cap, 2 underside. */
  readonly roles: readonly number[];
}
const SHAPES = new Map(
  (stoneShapes.assets as unknown as readonly StoneShape[]).map((shape) => [shape.id, shape]),
);
export type KenneyStoneSet = StoneShape["set"];
/** The baked rocks of one set, in their baked order. */
export function kenneyStones(set: KenneyStoneSet): readonly string[] {
  return [...SHAPES.values()].filter((shape) => shape.set === set).map((shape) => shape.id);
}

export interface BoulderSetting {
  /** A baked Nature Kit rock id, e.g. `rock_tallA`. */
  readonly shape: string;
  readonly x: number;
  readonly z: number;
  /** Uniform: a rock is never squashed. */
  readonly scale: number;
  readonly turn: number;
  /** Whether the rock's grass cap shows as grass; otherwise it is rock too. */
  readonly turf: boolean;
}

export interface BoulderPoint {
  readonly x: number;
  readonly z: number;
  readonly lift: number;
  readonly turf: number;
  readonly mass: number;
  /** 0 at the foot, 1 at the top: what the colour ramp reads. */
  readonly band: number;
}
/** Per face: 0 rock, 1 grass (only where the rock wears turf), 2 underside. */
export type BoulderFaceRole = 0 | 1 | 2;

/** Share of each rock's height set below the ground, so no slope shows a gap. */
const SINK = 0.07;

/** Append one rock's points and faces; faces keep the donor's outward winding. */
function appendBoulder(
  points: BoulderPoint[],
  faces: [number, number, number][],
  roles: BoulderFaceRole[],
  setting: BoulderSetting,
  mass: number,
): void {
  const shape = SHAPES.get(setting.shape);
  if (!shape) throw new Error(`Unknown baked Kenney rock: ${setting.shape}`);
  const start = points.length;
  const cos = Math.cos(setting.turn),
    sin = Math.sin(setting.turn);
  const height = shape.size[1] * setting.scale;
  const grass = new Set<number>();
  shape.roles.forEach((role, t) => {
    if (role === 1) for (let k = 0; k < 3; k += 1) grass.add(shape.indices[t * 3 + k]!);
  });
  for (let i = 0; i < shape.positions.length / 3; i += 1) {
    const lx = shape.positions[i * 3]! * setting.scale;
    const ly = shape.positions[i * 3 + 1]! * setting.scale;
    const lz = shape.positions[i * 3 + 2]! * setting.scale;
    points.push({
      x: setting.x + lx * cos - lz * sin,
      z: setting.z + lx * sin + lz * cos,
      lift: ly - height * SINK,
      mass,
      turf: setting.turf && grass.has(i) ? 1 : 0,
      band: height > 0 ? ly / height : 0,
    });
  }
  for (let t = 0; t < shape.roles.length; t += 1) {
    faces.push([
      start + shape.indices[t * 3]!,
      start + shape.indices[t * 3 + 1]!,
      start + shape.indices[t * 3 + 2]!,
    ]);
    const role = shape.roles[t]!;
    roles.push(role === 1 ? (setting.turf ? 1 : 0) : role === 2 ? 2 : 0);
  }
}

/** Four rocks, tallest first, inside the outcrop's unit reserve. */
const OUTCROP: readonly BoulderSetting[] = [
  { shape: "rock_tallA", x: -0.14, z: 0.06, scale: 1, turn: 0.2, turf: true },
  { shape: "rock_tallH", x: 0.43, z: -0.2, scale: 0.95, turn: -0.35, turf: true },
  { shape: "rock_smallH", x: -0.36, z: -0.46, scale: 1.1, turn: 0.7, turf: false },
  { shape: "rock_smallE", x: 0.3, z: 0.44, scale: 1.1, turn: -0.9, turf: true },
];

const points: BoulderPoint[] = [];
const faces: [number, number, number][] = [];
const faceRoles: BoulderFaceRole[] = [];
for (const [mass, setting] of OUTCROP.entries())
  appendBoulder(points, faces, faceRoles, setting, mass);
export const COURSE_ROCK_BANK_POINTS = points;
export const COURSE_ROCK_BANK_FACES = faces;
export const COURSE_ROCK_BANK_FACE_ROLES = faceRoles;
export const COURSE_ROCK_BANK_TRIANGLES = faces.length;

/**
 * Colour of one rock face corner: a warm grey that darkens into the foot and
 * brightens toward the top, the underside in the foot's shade, a grass cap in
 * meadow green. Per face, so a cap ends at the rock's own edge rather than
 * bleeding down its sides.
 */
const FOOT = new THREE.Color(0x7c7b82);
const FLANK = new THREE.Color(0xa9a39a);
const RIM = new THREE.Color(0xd3ccbe);
const TURF = new THREE.Color(0x86b94a);
const TURF_LIGHT = new THREE.Color(0xa6cc62);
export function boulderColour(
  point: Pick<BoulderPoint, "band">,
  role: BoulderFaceRole,
  meadow = 0,
): THREE.Color {
  if (role === 1) return TURF.clone().lerp(TURF_LIGHT, 0.25 + meadow * 0.3);
  if (role === 2) return FOOT.clone();
  return point.band < 0.5
    ? FOOT.clone().lerp(FLANK, THREE.MathUtils.smoothstep(point.band, 0, 0.5))
    : FLANK.clone().lerp(RIM, THREE.MathUtils.smoothstep(point.band, 0.55, 1));
}

/**
 * The roadside rocks, drawn in place of Kenney `rock_largeA` / `rock_smallA`
 * at the same placements: unit height, centred, base at y = 0 — the same
 * normalisation `kit.tsx` applies to a GLB — and inside the source's own
 * footprint (1.51 × 1.95 and 0.94 × 0.94 half-widths per unit height), so no
 * clearance changes; the ground stones inside the miniature stone's 0.46.
 * Each kind has a few compositions so neighbouring rocks are not twins.
 */
export type DressingBoulderVariant = "large" | "small" | "stone";

const DRESSING: Readonly<Record<DressingBoulderVariant, readonly (readonly BoulderSetting[])[]>> = {
  large: [
    [
      { shape: "rock_tallA", x: -0.2, z: 0.1, scale: 1.8, turn: 0.3, turf: true },
      { shape: "rock_smallH", x: 0.7, z: -0.55, scale: 1.6, turn: -0.4, turf: false },
      { shape: "rock_smallE", x: -0.75, z: -0.7, scale: 1.8, turn: 1.1, turf: true },
    ],
    [
      { shape: "rock_tallB", x: 0, z: 0.05, scale: 2, turn: -0.5, turf: true },
      { shape: "rock_tallC", x: 0.8, z: -0.5, scale: 1.4, turn: 0.8, turf: false },
      { shape: "rock_smallF", x: -0.7, z: 0.75, scale: 1.6, turn: 0.2, turf: true },
    ],
    [
      { shape: "rock_largeD", x: 0, z: 0, scale: 1.85, turn: 0.9, turf: true },
      { shape: "rock_tallI", x: 0.75, z: -0.6, scale: 1.3, turn: -0.2, turf: false },
    ],
  ],
  small: [
    [
      { shape: "rock_tallH", x: -0.05, z: 0.05, scale: 1.85, turn: 0.5, turf: true },
      { shape: "rock_smallI", x: 0.45, z: -0.35, scale: 1.2, turn: -0.8, turf: false },
    ],
    [
      { shape: "rock_largeF", x: 0, z: 0, scale: 1.25, turn: -0.3, turf: true },
      { shape: "rock_smallE", x: 0.4, z: 0.35, scale: 1.3, turn: 1.3, turf: false },
    ],
  ],
  stone: [
    [{ shape: "rock_smallTopB", x: 0, z: 0, scale: 0.95, turn: 0.4, turf: true }],
    [
      { shape: "rock_smallH", x: -0.04, z: 0.02, scale: 1.05, turn: -0.6, turf: true },
      { shape: "rock_smallF", x: 0.26, z: -0.12, scale: 0.55, turn: 0.9, turf: false },
    ],
  ],
};

/** How many compositions a kind has; `createDressingBoulderGeometry` takes one of them. */
export function dressingBoulderAlternatives(variant: DressingBoulderVariant): number {
  return DRESSING[variant].length;
}
/** A stable composition for something standing at (x, z). */
export function dressingBoulderAlternative(
  variant: DressingBoulderVariant,
  x: number,
  z: number,
): number {
  return Math.floor(hash(`${variant}/${x.toFixed(2)}/${z.toFixed(2)}`) * DRESSING[variant].length);
}

export function createDressingBoulderGeometry(
  variant: DressingBoulderVariant,
  alternative = 0,
): THREE.BufferGeometry {
  return createBoulderGeometry(DRESSING[variant][alternative % DRESSING[variant].length]!);
}

/** Any cluster of rocks as one indexed, vertex-coloured, flat-shaded geometry. */
export function createBoulderGeometry(settings: readonly BoulderSetting[]): THREE.BufferGeometry {
  const bank: BoulderPoint[] = [];
  const bankFaces: [number, number, number][] = [];
  const roles: BoulderFaceRole[] = [];
  for (const [mass, setting] of settings.entries())
    appendBoulder(bank, bankFaces, roles, setting, mass);
  const positions: number[] = [],
    colours: number[] = [];
  bankFaces.forEach((face, f) => {
    for (const i of face) {
      const p = bank[i]!;
      const colour = boulderColour(p, roles[f]!);
      positions.push(p.x, p.lift, p.z);
      colours.push(colour.r, colour.g, colour.b);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  // Indexed like the outcrop, so a ground stone merges into the same batch.
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

interface RockSurfaceSite {
  readonly id?: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly turn: number;
  readonly groundRange: readonly [number, number];
  readonly groundHeights?: readonly number[];
}

export function courseRockTopPoints(site: RockSurfaceSite) {
  const cosine = Math.cos(site.turn),
    sine = Math.sin(site.turn);
  // Rigid pieces keep their real broad planes. Their lowest sampled support
  // embeds every foot instead of warping every donor vertex to a heightfield.
  const bases = OUTCROP.map((_, mass) =>
    Math.min(
      ...points.flatMap((p, i) =>
        p.mass === mass ? [site.groundHeights?.[i] ?? site.groundRange[0]] : [],
      ),
    ),
  );
  return points.map((p) => ({
    x: site.x + (p.x * cosine - p.z * sine) * site.radius,
    y:
      bases[p.mass]! +
      site.height * p.lift * (0.9 + hash(`${site.id ?? "bank"}/${p.mass}/lift`) * 0.1) -
      0.02,
    z: site.z + (p.x * sine + p.z * cosine) * site.radius,
  }));
}

export function sampleCourseRockTop(
  points: ReturnType<typeof courseRockTopPoints>,
  x: number,
  z: number,
): number | null {
  let highest: number | null = null;
  for (const [i, j, k] of faces) {
    const p = points[i]!,
      q = points[j]!,
      r = points[k]!;
    const det = (q.z - r.z) * (p.x - r.x) + (r.x - q.x) * (p.z - r.z);
    // In XZ coordinates a counterclockwise triangle faces down in Y.
    // Hidden bottom faces must never become a plant support plane.
    if (det >= -1e-12) continue;
    const u = ((q.z - r.z) * (x - r.x) + (r.x - q.x) * (z - r.z)) / det;
    const v = ((r.z - p.z) * (x - r.x) + (p.x - r.x) * (z - r.z)) / det;
    const w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-8) {
      const y = u * p.y + v * q.y + w * r.y;
      highest = highest === null ? y : Math.max(highest, y);
    }
  }
  return highest;
}
