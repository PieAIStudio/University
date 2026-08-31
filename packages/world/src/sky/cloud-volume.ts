import * as THREE from "three";

/**
 * A small closed cloud body shared by the course frame and the world cloud
 * sea. The course bank is a low-poly extruded three-crown shape: the silhouette
 * keeps the illustrated lobe rhythm, while the closed side wall gives the key
 * and rim lights a real front/side/top break. The world puffs use the lobe
 * branch below so their existing spherical language stays unchanged.
 *
 * The geometry and its colour ramp are compiled once in the caller's
 * `useMemo`. There are no textures, shader samplers, or per-frame updates in
 * this helper.
 */
export const CLOUD_VOLUME_CONTRACT = {
  courseSegments: { width: 8, height: 5 },
  courseForm: "bank",
  /** Vertex colour is a value ramp, not an opacity/texture workaround. */
  usesVertexValueRamp: true,
  closedSurface: true,
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function crownInfluence(x: number, y: number, z: number): number {
  // The centres are directions on the unit sphere. A small amount of overlap
  // makes one body read as a soft cloud rather than three disconnected rocks.
  const crowns = [
    [-0.48, 0.2, 0.02],
    [0, 0.48, 0.02],
    [0.5, 0.24, 0.01],
  ] as const;
  let strongest = 0;
  for (const [cx, cy, cz] of crowns) {
    const distance = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
    strongest = Math.max(strongest, Math.exp(-distance * 8.5));
  }
  return strongest;
}

function appendLowPolyCloudLobe(
  positions: number[],
  indices: number[],
  offset: readonly [number, number, number],
  scale: readonly [number, number, number],
): void {
  const base = positions.length / 3;
  const push = (radius: number, y: number, angle: number) => {
    positions.push(
      offset[0] + Math.cos(angle) * radius * scale[0],
      offset[1] + y * scale[1],
      offset[2] + Math.sin(angle) * radius * scale[2],
    );
  };
  // Two three-sided rings plus a crown and foot are 12 closed triangles per
  // lobe. It is deliberately the same aggregate budget as the old flat bank
  // while giving the key light actual top, side and underside normals.
  push(0, 0.84, 0);
  for (let index = 0; index < 3; index += 1) {
    push(0.84, 0.28, index * ((Math.PI * 2) / 3) + Math.PI / 6);
  }
  for (let index = 0; index < 3; index += 1) {
    push(0.9, -0.34, index * ((Math.PI * 2) / 3) + Math.PI / 6);
  }
  push(0, -0.72, 0);
  const top = base;
  const upper = base + 1;
  const lower = base + 4;
  const bottom = base + 7;
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3;
    indices.push(top, upper + next, upper + index);
    indices.push(upper + index, upper + next, lower + next);
    indices.push(upper + index, lower + next, lower + index);
    indices.push(lower + index, lower + next, bottom);
  }
}

/**
 * Add a stable light-to-shadow value ramp to a closed cloud body. Instanced
 * colours still supply role/tier identity; this attribute supplies the
 * within-body value break and is multiplied by those instance colours.
 */
export function addCloudVertexValueRamp(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const z = position.getZ(index);
    const lift = clamp((y + 0.9) / 1.8, 0, 1);
    const facing = clamp((z + 1) * 0.5, 0, 1);
    const value = 0.78 + lift * 0.16 + facing * 0.06;
    colours[index * 3] = value * (0.99 + lift * 0.01);
    colours[index * 3 + 1] = value * (0.97 + lift * 0.03);
    colours[index * 3 + 2] = value * (0.98 + (1 - lift) * 0.02);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** Build the shared closed, lightly crowned cloud volume. */
export function createCloudVolumeGeometry(
  widthSegments: number,
  heightSegments: number,
  form: "lobe" | "bank" = "lobe",
): THREE.BufferGeometry {
  if (form === "bank") {
    const positions: number[] = [];
    const indices: number[] = [];
    appendLowPolyCloudLobe(positions, indices, [-0.62, 0.01, 0], [0.86, 0.48, 0.68]);
    appendLowPolyCloudLobe(positions, indices, [0, 0.16, 0.02], [0.82, 0.6, 0.7]);
    appendLowPolyCloudLobe(positions, indices, [0.62, 0.02, 0], [0.88, 0.5, 0.68]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    // The indexed body has one shared value-ramp material, so it remains one
    // draw even though each three-sided lobe is a closed surface.
    geometry.clearGroups();
    geometry.computeVertexNormals();
    addCloudVertexValueRamp(geometry);
    geometry.computeBoundingSphere();
    geometry.userData.cloudVolume = CLOUD_VOLUME_CONTRACT;
    return geometry;
  }
  const geometry = new THREE.SphereGeometry(
    1,
    Math.max(6, Math.floor(widthSegments)),
    Math.max(4, Math.floor(heightSegments)),
  );
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = 0.88 + crownInfluence(x, y, z) * 0.18;
    const underside = y < -0.42 ? 0.96 + (y + 1) * 0.05 : 1;
    position.setXYZ(index, x * radius * underside, y * radius * underside, z * radius * underside);
  }
  geometry.computeVertexNormals();
  addCloudVertexValueRamp(geometry);
  geometry.computeBoundingSphere();
  geometry.userData.cloudVolume = CLOUD_VOLUME_CONTRACT;
  return geometry;
}
