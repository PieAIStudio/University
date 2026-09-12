import * as THREE from "three";

/** One closed cloud bank, shared by every projection (V5 M / R44).
 * Four rounded influences are sampled as ONE exterior, never intersecting draws.
 * Tessellation changes with screen size; the sampled form and value ramp do not.
 */
export const CLOUD_VOLUME_CONTRACT = {
  courseSegments: { width: 9, height: 3 },
  courseForm: "bank",
  form: "continuous-lobed-bank",
  broadCrowns: 4,
  horizontalRadiusMax: 1.04,
  crownHeightMax: 0.64,
  undersideHeight: -0.3,
  verticalAspectMax: 0.52,
  usesVertexValueRamp: true,
  closedSurface: true,
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// Each influence contains the origin, so every outward ray has one positive
// exit and their union is star-shaped. A small smooth maximum joins shoulders
// without internal surfaces, sphere intersections, extra lobes or draw calls.
const BANK_MASSES = [
  { centre: [-0.05, 0.18, -0.04], radii: [0.58, 0.4, 0.56] },
  { centre: [-0.42, 0.04, 0.02], radii: [0.48, 0.33, 0.4] },
  { centre: [0.45, 0.035, -0.03], radii: [0.5, 0.325, 0.4] },
  { centre: [0.05, 0.06, 0.25], radii: [0.53, 0.32, 0.5] },
] as const;

function bankRayExit(x: number, y: number, z: number): number {
  let distance = 0;
  const shoulderBlend = 0.09;
  for (const { centre: c, radii: r } of BANK_MASSES) {
    const a = (x / r[0]) ** 2 + (y / r[1]) ** 2 + (z / r[2]) ** 2;
    const b = (x * c[0]) / r[0] ** 2 + (y * c[1]) / r[1] ** 2 + (z * c[2]) / r[2] ** 2;
    const cc = (c[0] / r[0]) ** 2 + (c[1] / r[1]) ** 2 + (c[2] / r[2]) ** 2 - 1;
    const exit = (b + Math.sqrt(b * b - a * cc)) / a;
    const blend = Math.max(0, shoulderBlend - Math.abs(distance - exit)) / shoulderBlend;
    distance = Math.max(distance, exit) + blend * blend * shoulderBlend * 0.25;
  }
  return distance;
}

/** The carrier aligns its feet to this exact vertex, not a guessed sphere top. */
export const CLOUD_BANK_SUPPORT_HEIGHT = bankRayExit(0, 1, 0);

/** Normals sample the sculpted surface itself, not an average of the coarse
 * triangles. The same source is smooth on a phone without subdividing its mesh.
 */
function resolveBankNormals(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  const direction = new THREE.Vector3(),
    axis = new THREE.Vector3();
  const right = new THREE.Vector3(),
    tangent = new THREE.Vector3();
  const near = new THREE.Vector3(),
    far = new THREE.Vector3();
  const du = new THREE.Vector3(),
    dv = new THREE.Vector3(),
    outward = new THREE.Vector3();
  const sample = (out: THREE.Vector3, along: THREE.Vector3, step: number) => {
    out.copy(direction).addScaledVector(along, step).normalize();
    return out.multiplyScalar(bankRayExit(out.x, out.y, out.z));
  };
  for (let i = 0; i < position.count; i++) {
    direction.fromBufferAttribute(position, i).normalize();
    axis.set(Math.abs(direction.y) > 0.9 ? 1 : 0, Math.abs(direction.y) > 0.9 ? 0 : 1, 0);
    right.crossVectors(axis, direction).normalize();
    tangent.crossVectors(direction, right);
    du.subVectors(sample(near, right, 0.001), sample(far, right, -0.001));
    dv.subVectors(sample(near, tangent, 0.001), sample(far, tangent, -0.001));
    outward.crossVectors(du, dv).normalize();
    if (outward.dot(direction) < 0) outward.negate();
    normal.setXYZ(i, outward.x, outward.y, outward.z);
  }
}

/** The same value range at every LOD, baked before any tangent-space transform. */
export function addCloudVertexValueRamp(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const lift = clamp(
      (position.getY(index) - CLOUD_VOLUME_CONTRACT.undersideHeight) /
        (CLOUD_VOLUME_CONTRACT.crownHeightMax - CLOUD_VOLUME_CONTRACT.undersideHeight),
      0,
      1,
    );
    const facing = clamp((position.getZ(index) + 1) * 0.5, 0, 1);
    const value = 0.72 + lift * 0.22 + facing * 0.08;
    colours[index * 3] = value * (1.03 - lift * 0.03);
    colours[index * 3 + 1] = value * (0.97 + lift * 0.03);
    colours[index * 3 + 2] = value * (0.9 + lift * 0.1);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/**
 * Welded latitude rings plus two poles: one connected manifold with no UV
 * seam, duplicate rim, internal cap or zero-area polar triangles. More rings
 * belong to the crown than the underside. The coarsest 9x3 bank costs 36 tris.
 * The final input remains an alias for old callers, not a second shape.
 */
export function createCloudVolumeGeometry(
  widthSegments: number,
  heightSegments: number,
  _form: "lobe" | "bank" = "bank",
): THREE.BufferGeometry {
  const width = Number.isFinite(widthSegments) ? clamp(Math.floor(widthSegments), 9, 32) : 9;
  const height = Number.isFinite(heightSegments) ? clamp(Math.floor(heightSegments), 3, 9) : 3;
  const upperRings = Math.ceil((height * 2) / 3);
  const lowerRings = height - upperRings;
  const positions = [0, CLOUD_BANK_SUPPORT_HEIGHT, 0];
  const indices: number[] = [];

  const appendRing = (latitude: number) => {
    const radius = Math.sin(latitude);
    const vertical = Math.cos(latitude);
    for (let column = 0; column < width; column += 1) {
      const angle = (column / width) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const distance = bankRayExit(x, vertical, z);
      positions.push(x * distance, vertical * distance, z * distance);
    }
  };
  for (let ring = 1; ring <= upperRings; ring += 1) {
    appendRing((ring / upperRings) * Math.PI * 0.5);
  }
  for (let ring = 1; ring < lowerRings; ring += 1) {
    appendRing(Math.PI * 0.5 + (ring / lowerRings) * Math.PI * 0.5);
  }
  const bottom = positions.length / 3;
  positions.push(0, -bankRayExit(0, -1, 0), 0);

  for (let column = 0; column < width; column += 1) {
    indices.push(0, 1 + ((column + 1) % width), 1 + column);
  }
  let crownIndexCount = indices.length;
  for (let ring = 0; ring < height - 2; ring += 1) {
    const upper = 1 + ring * width;
    const lower = upper + width;
    for (let column = 0; column < width; column += 1) {
      const next = (column + 1) % width;
      indices.push(upper + column, upper + next, lower + next);
      indices.push(upper + column, lower + next, lower + column);
    }
    if (ring < upperRings - 1) crownIndexCount = indices.length;
  }
  const lastRing = bottom - width;
  for (let column = 0; column < width; column += 1) {
    indices.push(lastRing + column, lastRing + ((column + 1) % width), bottom);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  resolveBankNormals(geometry);
  addCloudVertexValueRamp(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.cloudVolume = CLOUD_VOLUME_CONTRACT;
  geometry.userData.cloudCrownIndexCount = crownIndexCount;
  return geometry;
}

/** Two complementary draws of ONE shell. Shared rim normals/colours are copied
 * from the closed source, so there is no seam or overlapped underside slab.
 * Each returned geometry owns its buffers and is disposed by the mounted field.
 */
export function createCloudVolumeParts(
  width: number,
  height: number,
): {
  crown: THREE.BufferGeometry;
  underbelly: THREE.BufferGeometry;
} {
  const crown = createCloudVolumeGeometry(width, height);
  const underbelly = crown.clone();
  const indices = Array.from(crown.index!.array);
  const split = crown.userData.cloudCrownIndexCount as number;
  crown.setIndex(indices.slice(0, split));
  underbelly.setIndex(indices.slice(split));
  return { crown, underbelly };
}
