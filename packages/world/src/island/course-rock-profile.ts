/** Three closed donor-derived stones form one reserved outcrop. This is not
 * navigable terrain; feet and plants read the exact rendered support below.
 */
import shapes from "./kenney-rock-shapes.json" with { type: "json" };
import { hash } from "./random.js";

const settings = [
  { id: "rock_largeA", x: -0.14, z: 0.12, radius: 0.61, height: 1, turn: 0.1 },
  { id: "rock_largeD", x: 0.44, z: -0.18, radius: 0.34, height: 0.7, turn: -0.22 },
  { id: "rock_largeF", x: -0.36, z: -0.42, radius: 0.29, height: 0.49, turn: 0.28 },
];
const points: { x: number; z: number; lift: number; turf: number; mass: number }[] = [];
const faces: [number, number, number][] = [];
for (const [mass, setting] of settings.entries()) {
  const model = shapes.assets.find((a) => a.id === setting.id)!;
  const start = points.length;
  for (const v of model.vertices) {
    const x =
      setting.x +
      (v[0]! * Math.cos(setting.turn) - v[2]! * Math.sin(setting.turn)) * setting.radius;
    const z =
      setting.z +
      (v[0]! * Math.sin(setting.turn) + v[2]! * Math.cos(setting.turn)) * setting.radius;
    points.push({
      x,
      z,
      lift: v[1]! * setting.height,
      mass,
      turf: v[1]! > 0.84 && z > 0.08 ? 0.18 : 0,
    });
  }
  for (const f of model.faces) faces.push([f[0]! + start, f[1]! + start, f[2]! + start]);
}
export const COURSE_ROCK_BANK_POINTS = points;
export const COURSE_ROCK_BANK_FACES = faces;
export const COURSE_ROCK_BANK_TRIANGLES = faces.length;

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
  const bases = settings.map((_, mass) =>
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
