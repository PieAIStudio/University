/**
 * The grass lip of the course island's coast.
 *
 * The owner's reference rolls the meadow over the edge as a thick, rounded
 * sod roll that overhangs the rock below it. The terrain's own collar is a
 * single flat strip 0.42 deep that tucks inward, so from the course camera the
 * top reads as a thin sheet laid on a grey wall (the owner's screenshot,
 * 2026-09-23). This adds the roll without changing the terrain: it reads the
 * rendered top outer ring through `cliffTopology` — exactly the edge the
 * meadow ends on, with the colour the meadow has there — and grows a rounded
 * profile outward and down from it. Nothing is placed or cleared; it is
 * geometry on the existing coast only.
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { createBoulderGeometry } from "./course-rock-profile.js";
import { hash } from "./random.js";

/** Profile of the roll at thickness 1: [outward, down] from the edge, and how much it darkens. */
const LIP_PROFILE = [
  { out: -0.32, down: 0.02, shade: 1 },
  { out: 0.08, down: 0.03, shade: 1 },
  { out: 0.22, down: 0.3, shade: 0.93 },
  { out: 0.16, down: 0.62, shade: 0.8 },
  { out: -0.1, down: 0.86, shade: 0.62 },
] as const;
/** World units at the thickest; bays keep more sod than exposed headlands. */
export const COAST_LIP_THICKNESS = 2.4;
const SOIL = new THREE.Color(0x5e4b39);
/** Rock columns stand under the lip (the second step of R58-03). */
const COAST_COLUMNS = true;
/**
 * The lip is 8 triangles per coast sample (96 samples at course detail) and
 * each column one 44-triangle boulder; islands of 4 to 60 lessons measure
 * 1,692 to 2,000 together.
 */
export const COAST_LIP_TRIANGLE_CEILING = 2400;

export interface CoastLipTopology {
  readonly ringIndices: readonly (readonly number[])[];
}

/**
 * Rock columns under the lip, the reference's cliff: the same boulder as every
 * other rock, stood on end and half sunk into the cliff face so its light top
 * rim shows below the overhanging sod. Every few coast samples, never evenly.
 */
function coastColumns(
  edge: readonly THREE.Vector3[],
  outward: readonly THREE.Vector3[],
  thickness: readonly number[],
  seed: string,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  // Clusters of two to four columns with long bays of bare cliff between them:
  // one column every few samples all round read as a row of teeth (R58-03).
  let i = Math.floor(hash(`${seed}/coast-column/start`) * 6);
  while (i < edge.length) {
    const cluster = 2 + Math.floor(hash(`${seed}/coast-column/${i}/cluster`) * 3);
    for (let member = 0; member < cluster && i < edge.length; member += 1) {
      const key = `${seed}/coast-column/${i}`;
      const height = 2.8 + hash(`${key}/h`) * 3.2;
      const radius = 0.8 + hash(`${key}/r`) * 0.7;
      const top = edge[i]!.y - thickness[i]! * (0.35 + hash(`${key}/drop`) * 0.4);
      const column = createBoulderGeometry(
        [
          {
            x: 0,
            z: 0,
            rx: radius,
            rz: radius * 0.86,
            height,
            turn: hash(`${key}/turn`) * 6,
            turf: false,
          },
        ],
        key,
      );
      // A shade darker than free-standing boulders: they belong to the cliff.
      const colour = column.getAttribute("color") as THREE.BufferAttribute;
      for (let v = 0; v < colour.count; v += 1)
        colour.setXYZ(v, colour.getX(v) * 0.86, colour.getY(v) * 0.86, colour.getZ(v) * 0.88);
      column.translate(
        edge[i]!.x + outward[i]!.x * radius * 0.3,
        top - height,
        edge[i]!.z + outward[i]!.z * radius * 0.3,
      );
      parts.push(column);
      i += 1 + Math.floor(hash(`${key}/step`) * 2);
    }
    i += 5 + Math.floor(hash(`${seed}/coast-column/${i}/gap`) * 7);
  }
  return parts;
}

export function buildCoastLip(
  terrain: THREE.BufferGeometry,
  seed: string,
): THREE.BufferGeometry | null {
  const topology = terrain.userData.cliffTopology as CoastLipTopology | undefined;
  const ring = topology?.ringIndices[0];
  if (!ring || ring.length < 3 || ring.some((index) => index < 0)) return null;
  const position = terrain.getAttribute("position") as THREE.BufferAttribute;
  const colour = terrain.getAttribute("color") as THREE.BufferAttribute;
  const count = ring.length;
  const edge = ring.map((index) => new THREE.Vector3().fromBufferAttribute(position, index));
  const centre = edge.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(count);
  const positions: number[] = [];
  const colours: number[] = [];
  const shade = new THREE.Color();
  const outwards: THREE.Vector3[] = [];
  const thicknesses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = edge[i]!;
    const tangent = edge[(i + 1) % count]!.clone()
      .sub(edge[(i - 1 + count) % count]!)
      .setY(0);
    const out = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    if (out.dot(p.clone().sub(centre).setY(0)) < 0) out.negate();
    // Slow variation around the coast, so the roll swells and thins like sod.
    const swell =
      0.78 +
      0.22 * Math.sin((i / count) * Math.PI * 2 * 5 + hash(`${seed}/coast-lip`) * 6) +
      hash(`${seed}/coast-lip/${Math.floor(i / 3)}`) * 0.12;
    const thickness = COAST_LIP_THICKNESS * swell;
    outwards.push(out);
    thicknesses.push(thickness);
    const ground = new THREE.Color().fromBufferAttribute(colour, ring[i]!);
    for (const step of LIP_PROFILE) {
      positions.push(
        p.x + out.x * step.out * thickness,
        p.y - step.down * thickness,
        p.z + out.z * step.out * thickness,
      );
      shade
        .copy(ground)
        .multiplyScalar(step.shade)
        .lerp(SOIL, step === LIP_PROFILE.at(-1) ? 0.45 : 0);
      colours.push(shade.r, shade.g, shade.b);
    }
  }
  const rows = LIP_PROFILE.length;
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = i * rows,
      b = ((i + 1) % count) * rows;
    for (let k = 0; k < rows - 1; k += 1)
      indices.push(a + k, a + k + 1, b + k, b + k, a + k + 1, b + k + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Faces must point outward/up; flip the whole strip if the winding came out inward.
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const probe = new THREE.Vector3().fromBufferAttribute(normal, 2);
  const probeOut = edge[0]!.clone().sub(centre).setY(0).normalize();
  if (probe.dot(probeOut) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1]!;
      indices[i + 1] = indices[i + 2]!;
      indices[i + 2] = t;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  const columns = COAST_COLUMNS ? coastColumns(edge, outwards, thicknesses, seed) : [];
  if (columns.length === 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  const parts = [geometry, ...columns];
  try {
    const merged = mergeBufferGeometries(parts, false);
    if (!merged) throw new Error("Coast lip and columns must share one attribute contract");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  } finally {
    for (const part of parts) part.dispose();
  }
}
