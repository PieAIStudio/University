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
/**
 * The lip is 8 triangles per coast sample (96 samples at course detail). R58-03
 * also stood rock columns under it; the owner rejected them on 2026-09-23
 * (「悬在边缘，莫名其妙」), so the roll is the whole of it.
 */
export const COAST_LIP_TRIANGLE_CEILING = 800;

export interface CoastLipTopology {
  readonly ringIndices: readonly (readonly number[])[];
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
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
