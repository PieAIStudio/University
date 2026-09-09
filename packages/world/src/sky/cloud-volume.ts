import * as THREE from "three";

/** One shallow, closed cloud bank, shared by every projection (V5 M / R38).
 * The lobes are broad variations of one surface, never intersecting spheres.
 * Tessellation changes with screen size; the sampled form and value ramp do not.
 */
export const CLOUD_VOLUME_CONTRACT = {
  courseSegments: { width: 9, height: 3 },
  courseForm: "bank",
  form: "continuous-shallow-bank",
  broadCrowns: 4,
  horizontalRadiusMax: 1.04,
  crownHeightMax: 0.42,
  undersideHeight: -0.18,
  usesVertexValueRamp: true,
  closedSurface: true,
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Four soft shoulders around one bank, with no pinched inter-lobe valleys. */
function bankOutline(angle: number): number {
  return (
    0.87 +
    0.08 * Math.cos(3 * angle + 0.35) +
    0.055 * Math.sin(5 * angle - 0.5) +
    0.025 * Math.cos(2 * angle + 0.8)
  );
}

const BANK_CROWNS = [
  [-0.5, -0.08, 0.085],
  [-0.12, 0.25, 0.07],
  [0.3, -0.2, 0.1],
  [0.59, 0.14, 0.065],
] as const;

/** Smooth overlapping height influences, not a max/union of primitive bodies. */
function bankCrown(x: number, z: number): number {
  let height = 0.22;
  for (const [cx, cz, lift] of BANK_CROWNS) {
    height += lift * Math.exp(-((x - cx) ** 2 * 6 + (z - cz) ** 2 * 9));
  }
  return height;
}

/** The carrier aligns its feet to this exact vertex, not a guessed sphere top. */
export const CLOUD_BANK_SUPPORT_HEIGHT = bankCrown(0, 0);

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
      const outline = bankOutline(angle);
      const x = Math.cos(angle) * radius * outline;
      const z = Math.sin(angle) * radius * outline * 0.68;
      // Both halves meet at exactly zero. Cosine rounds into the rim without
      // the vertical wall of an extruded flat plate.
      const y =
        Math.abs(vertical) < 1e-10
          ? 0
          : vertical * (vertical > 0 ? bankCrown(x, z) : -CLOUD_VOLUME_CONTRACT.undersideHeight);
      positions.push(x, y, z);
    }
  };
  for (let ring = 1; ring <= upperRings; ring += 1) {
    appendRing((ring / upperRings) * Math.PI * 0.5);
  }
  for (let ring = 1; ring < lowerRings; ring += 1) {
    appendRing(Math.PI * 0.5 + (ring / lowerRings) * Math.PI * 0.5);
  }
  const bottom = positions.length / 3;
  positions.push(0, CLOUD_VOLUME_CONTRACT.undersideHeight, 0);

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
