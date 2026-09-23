/** Game-art boulders: the one rock shape of the course island.
 *
 * The owner's reference (docs/reference/岛内-参考-V4/ChatGPT生成B.png) and the
 * Kenney mini-forest kit draw rock the same way: chunky columns with broad flat
 * sides, a chamfered shoulder, a flat top that catches the sky and often wears
 * grass, and a foot in its own shade. Until 2026-09-23 the island used Kenney
 * nature-kit shards instead: the outcrop was three of them and the roadside
 * rocks were `rock_largeA`, a slab 0.26 tall on a 0.8 × 1.0 footprint — both
 * read as thin plates standing on end.
 *
 * Every boulder here is an n-sided prism in three bands — a sunk base, a slight
 * belly, a chamfered shoulder — under a flat top. The reserved outcrop and the
 * roadside rocks are built from this one primitive and coloured by one ramp.
 * An outcrop is not navigable terrain; feet and plants read the exact rendered
 * support below.
 */
import * as THREE from "three";
import { hash } from "./random.js";

export interface BoulderSetting {
  readonly x: number;
  readonly z: number;
  /** Footprint half-widths. */
  readonly rx: number;
  readonly rz: number;
  readonly height: number;
  readonly turn: number;
  /** Whether grass caps the top. */
  readonly turf: boolean;
}

export interface BoulderPoint {
  readonly x: number;
  readonly z: number;
  readonly lift: number;
  readonly turf: number;
  readonly mass: number;
  /** 0 at the sunk base, 1 on the top rim: what the colour ramp reads. */
  readonly band: number;
}

const BOULDER_SIDES = 6;
/** Radius factor and height fraction of each ring, from the sunk base up to the top rim. */
const BOULDER_RINGS = [
  { r: 0.96, y: -0.12 },
  { r: 1.04, y: 0.42 },
  { r: 0.93, y: 0.84 },
  { r: 0.72, y: 1 },
] as const;
/** Three side bands, a top and a hidden bottom: a closed solid. */
export const BOULDER_TRIANGLES =
  (BOULDER_RINGS.length - 1) * BOULDER_SIDES * 2 + (BOULDER_SIDES - 2) * 2;

/** Append one boulder's rings and faces; faces wind outward and the top faces up. */
function appendBoulder(
  points: BoulderPoint[],
  faces: [number, number, number][],
  setting: BoulderSetting,
  mass: number,
  key: string,
): void {
  const start = points.length;
  const cos = Math.cos(setting.turn),
    sin = Math.sin(setting.turn);
  // One jitter per corner column, so the silhouette is irregular but every
  // band of a side stays one broad face instead of a crumpled strip.
  const column = Array.from(
    { length: BOULDER_SIDES },
    (_, i) => 0.88 + hash(`${key}/${mass}/${i}`) * 0.24,
  );
  const tilt = (hash(`${key}/${mass}/tilt`) - 0.5) * 0.1;
  for (const [ring, profile] of BOULDER_RINGS.entries()) {
    for (let i = 0; i < BOULDER_SIDES; i += 1) {
      const a = (i / BOULDER_SIDES) * Math.PI * 2;
      const lx = Math.cos(a) * setting.rx * profile.r * column[i]!;
      const lz = Math.sin(a) * setting.rz * profile.r * column[i]!;
      const top = ring === BOULDER_RINGS.length - 1 ? tilt * Math.cos(a) : 0;
      points.push({
        x: setting.x + lx * cos - lz * sin,
        z: setting.z + lx * sin + lz * cos,
        lift: setting.height * (profile.y + top),
        mass,
        turf: setting.turf && ring >= BOULDER_RINGS.length - 2 ? 1 : 0,
        band: Math.max(0, profile.y),
      });
    }
  }
  const at = (ring: number, i: number) => start + ring * BOULDER_SIDES + (i % BOULDER_SIDES);
  for (let ring = 0; ring < BOULDER_RINGS.length - 1; ring += 1)
    for (let i = 0; i < BOULDER_SIDES; i += 1) {
      faces.push([at(ring, i), at(ring + 1, i), at(ring, i + 1)]);
      faces.push([at(ring, i + 1), at(ring + 1, i), at(ring + 1, i + 1)]);
    }
  const top = BOULDER_RINGS.length - 1;
  for (let i = 1; i < BOULDER_SIDES - 1; i += 1) {
    faces.push([at(top, 0), at(top, i + 1), at(top, i)]);
    // Hidden under the ground, but it closes the solid the grounding reads.
    faces.push([at(0, 0), at(0, i), at(0, i + 1)]);
  }
}

/** Four boulders, tallest first, inside the outcrop's unit reserve. */
const OUTCROP: readonly BoulderSetting[] = [
  { x: -0.14, z: 0.06, rx: 0.52, rz: 0.46, height: 1, turn: 0.2, turf: true },
  { x: 0.43, z: -0.2, rx: 0.33, rz: 0.3, height: 0.64, turn: -0.35, turf: true },
  { x: -0.36, z: -0.46, rx: 0.26, rz: 0.23, height: 0.42, turn: 0.7, turf: false },
  { x: 0.3, z: 0.44, rx: 0.2, rz: 0.18, height: 0.3, turn: -0.9, turf: false },
];

const points: BoulderPoint[] = [];
const faces: [number, number, number][] = [];
for (const [mass, setting] of OUTCROP.entries())
  appendBoulder(points, faces, setting, mass, "course-boulder");
export const COURSE_ROCK_BANK_POINTS = points;
export const COURSE_ROCK_BANK_FACES = faces;
export const COURSE_ROCK_BANK_TRIANGLES = faces.length;

/**
 * Colour of one boulder vertex: a warm grey that darkens into the foot and
 * brightens toward the top rim, grass where a capped top faces the sky. The
 * old outcrop was one cold blue-grey (0x8896a5) with no top and no base.
 */
const FOOT = new THREE.Color(0x7c7b82);
const FLANK = new THREE.Color(0xa9a39a);
const RIM = new THREE.Color(0xd3ccbe);
const TURF = new THREE.Color(0x86b94a);
const TURF_LIGHT = new THREE.Color(0xa6cc62);
export function boulderColour(
  point: Pick<BoulderPoint, "band" | "turf">,
  normalY: number,
  meadow = 0,
): THREE.Color {
  const shade =
    point.band < 0.5
      ? FOOT.clone().lerp(FLANK, THREE.MathUtils.smoothstep(point.band, 0, 0.5))
      : FLANK.clone().lerp(RIM, THREE.MathUtils.smoothstep(point.band, 0.6, 1));
  const turf = TURF.clone().lerp(TURF_LIGHT, meadow * 0.3);
  return shade.lerp(turf, THREE.MathUtils.smoothstep(normalY, 0.55, 0.85) * point.turf);
}

/**
 * The roadside rocks, drawn in place of Kenney `rock_largeA` / `rock_smallA`
 * at the same placements: unit height, centred, base at y = 0 — the same
 * normalisation `kit.tsx` applies to a GLB — and inside the source's own
 * footprint (1.51 × 1.95 and 0.94 × 0.94 half-widths per unit height), so no
 * clearance changes. They stand taller than the slabs they replace; height
 * is a look, the footprint is the contract.
 */
export type DressingBoulderVariant = "large" | "small" | "stone";

const DRESSING: Readonly<Record<DressingBoulderVariant, readonly BoulderSetting[]>> = {
  large: [
    { x: -0.18, z: 0.12, rx: 0.72, rz: 0.66, height: 1.75, turn: 0.3, turf: true },
    { x: 0.62, z: -0.42, rx: 0.48, rz: 0.44, height: 1.1, turn: -0.4, turf: false },
    { x: -0.5, z: -0.9, rx: 0.34, rz: 0.3, height: 0.6, turn: 1.1, turf: false },
  ],
  // The landscape's ground stones (course-ground-stone.ts), drawn at the
  // miniature stone's own unit: inside its 0.46 footprint radius.
  stone: [
    { x: -0.05, z: 0.02, rx: 0.35, rz: 0.3, height: 0.62, turn: 0.4, turf: true },
    { x: 0.26, z: -0.12, rx: 0.14, rz: 0.12, height: 0.22, turn: -0.6, turf: false },
  ],
  small: [
    { x: -0.08, z: 0.05, rx: 0.62, rz: 0.56, height: 1.5, turn: 0.5, turf: true },
    { x: 0.45, z: -0.35, rx: 0.26, rz: 0.24, height: 0.5, turn: -0.8, turf: false },
  ],
};

export function createDressingBoulderGeometry(
  variant: DressingBoulderVariant,
): THREE.BufferGeometry {
  const bank: BoulderPoint[] = [];
  const bankFaces: [number, number, number][] = [];
  for (const [mass, setting] of DRESSING[variant].entries())
    appendBoulder(bank, bankFaces, setting, mass, `dressing-boulder/${variant}`);
  const vertices = bank.map((p) => new THREE.Vector3(p.x, p.lift, p.z));
  const normals = vertices.map(() => new THREE.Vector3());
  for (const [a, b, c] of bankFaces) {
    const n = vertices[b]!.clone().sub(vertices[a]!).cross(vertices[c]!.clone().sub(vertices[a]!));
    for (const i of [a, b, c]) normals[i]!.add(n);
  }
  const positions: number[] = [],
    colours: number[] = [];
  for (const face of bankFaces)
    for (const i of face) {
      const colour = boulderColour(bank[i]!, normals[i]!.clone().normalize().y);
      positions.push(vertices[i]!.x, vertices[i]!.y, vertices[i]!.z);
      colours.push(colour.r, colour.g, colour.b);
    }
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
