/** Batched miniature scenery and terrain-following water. Ground contact and
 * caster shadows belong to miniature-surface-atlas, not a second overlay. */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { createMiniatureAsset, type MiniatureAssetKind } from "./miniature-assets.js";
import { createSmoothIcosahedron } from "./foliage-geometry.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import type {
  RemoteCatalogueIslandInput,
  RemotePropPlacement,
  RemotePropsCataloguePlan,
} from "./remote-props.js";

export function mergeMiniatureProps(props: readonly RemotePropPlacement[]): THREE.BufferGeometry {
  const templates = new Map<MiniatureAssetKind, THREE.BufferGeometry>();
  const parts: THREE.BufferGeometry[] = [];
  const ranges: { start: number; end: number; islandId: string }[] = [];
  const sceneryBounds: { islandId: string; min: number[]; max: number[] }[] = [];
  let cursor = 0;
  const matrix = new THREE.Matrix4(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  try {
    for (const prop of props) {
      let template = templates.get(prop.asset);
      if (!template) {
        template = createMiniatureAsset(prop.asset);
        templates.set(prop.asset, template);
      }
      const geometry = template.clone();
      rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, prop.rotationY);
      matrix.compose(prop.position, rotation, scale.setScalar(prop.scale));
      geometry.applyMatrix4(matrix);
      if (prop.kind !== "accent") {
        geometry.computeBoundingBox();
        sceneryBounds.push({
          islandId: prop.islandId,
          min: geometry.boundingBox!.min.toArray(),
          max: geometry.boundingBox!.max.toArray(),
        });
      }
      if (prop.dimmed) {
        const colors = geometry.getAttribute("color");
        for (let i = 0; i < colors.count; i++)
          colors.setXYZ(i, colors.getX(i) * 0.9, colors.getY(i) * 0.9, colors.getZ(i) * 0.9);
      }
      parts.push(geometry);
      const count = (geometry.index?.count ?? 0) / 3;
      ranges.push({ start: cursor, end: cursor + count, islandId: prop.islandId });
      cursor += count;
    }
    const merged = parts.length ? mergeBufferGeometries(parts) : new THREE.BufferGeometry();
    if (!merged)
      throw new Error("Miniature kit must share indexed position/normal/color attributes");
    merged.userData.miniatureRanges = ranges;
    // The existing DOM projector can reserve real scenery without reading
    // every vertex each frame, or per-course hand-authored screen boxes.
    merged.userData.miniatureSceneryBounds = sceneryBounds;
    if (parts.length) {
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
    }
    return merged;
  } finally {
    parts.forEach((p) => p.dispose());
    templates.forEach((p) => p.dispose());
  }
}

interface SurfaceBuffer {
  positions: number[];
  colors: number[];
  indices: number[];
}
function surfaceBuffer(): SurfaceBuffer {
  return { positions: [], colors: [], indices: [] };
}
function vertex(buffer: SurfaceBuffer, p: THREE.Vector3, color: THREE.Color): number {
  const id = buffer.positions.length / 3;
  buffer.positions.push(p.x, p.y, p.z);
  buffer.colors.push(color.r, color.g, color.b);
  return id;
}
function geometryOf(buffer: SurfaceBuffer): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffer.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffer.colors, 3));
  geometry.setIndex(buffer.indices);
  geometry.computeVertexNormals();
  if (buffer.positions.length) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return geometry;
}
function projector(island: RemoteCatalogueIslandInput) {
  const radius = (island.radius ?? island.blueprint.bounds.maxHalf) * (island.scale ?? 1);
  const m = island.blueprint.bounds.maxHalf;
  const point = (x: number, y: number, z: number) =>
    new THREE.Vector3(
      island.position.x + x * radius,
      island.position.y + (island.lift ?? 0) + y * radius,
      island.position.z + z * radius,
    );
  const ground = (x: number, z: number) =>
    sampleIslandTerrainTop(island.blueprint, "world", x * m, z * m);
  return { point, ground, m };
}

export function buildMiniatureSurfaces(plan: RemotePropsCataloguePlan) {
  const water = surfaceBuffer(),
    bank = surfaceBuffer();
  const waterDeep = new THREE.Color(0x168dac),
    waterEdge = new THREE.Color(0x71d1d3);
  const stone = new THREE.Color(0xd8ddae),
    foam = new THREE.Color(0xe5ffff);
  for (const { island, pool } of plan.water) {
    const { point, ground, m } = projector(island);
    const segments = 24;
    const center = vertex(water, point(pool.x, pool.y, pool.z), waterDeep);
    const inner: number[] = [],
      rim: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Keep the scalloped bank inside the footprint that the plan proved.
      // A broad blue pool centre, not a cyan vertex fading across a white disc.
      const contour = 0.93 + 0.035 * Math.cos(angle * 3) + 0.025 * Math.sin(angle * 5);
      const rx = Math.cos(angle) * pool.radius * contour;
      const rz = Math.sin(angle) * pool.radius * contour;
      const x = pool.x + rx,
        z = pool.z + rz;
      inner.push(vertex(water, point(pool.x + rx * 0.68, pool.y, pool.z + rz * 0.68), waterDeep));
      rim.push(vertex(water, point(x, pool.y, z), waterEdge));
      const outerX = pool.x + rx * 1.12;
      const outerZ = pool.z + rz * 1.12;
      const at = ground(outerX, outerZ);
      vertex(bank, point(x, pool.y + 0.002, z), stone);
      vertex(bank, point(outerX, Math.max(at.y / m + 0.007, pool.y - 0.02), outerZ), stone);
      if (i > 0) {
        water.indices.push(center, inner[i]!, inner[i - 1]!);
        water.indices.push(inner[i - 1]!, inner[i]!, rim[i - 1]!, rim[i - 1]!, inner[i]!, rim[i]!);
        const b = bank.positions.length / 3 - 4;
        bank.indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    if (pool.cascade) {
      // A short spring follows actual terrain to the camera-facing shore.
      const direction = { x: 0.3, z: Math.sqrt(0.91) };
      const samples: { x: number; z: number; y: number }[] = [];
      for (let i = 0; i < 32; i++) {
        const distance = pool.radius * 0.8 + i * 0.035;
        const x = pool.x + direction.x * distance,
          z = pool.z + direction.z * distance;
        const at = ground(x, z);
        if (!at.inside) break;
        samples.push({ x, z, y: i < 2 ? Math.max(pool.y, at.y / m + 0.01) : at.y / m + 0.01 });
      }
      const last = samples.at(-1);
      if (last && samples.length > 2) {
        const width = 0.105;
        let prev: readonly [number, number] | null = null;
        for (const sample of samples) {
          const a = vertex(
            water,
            point(sample.x - direction.z * width, sample.y, sample.z + direction.x * width),
            waterEdge,
          );
          const b = vertex(
            water,
            point(sample.x + direction.z * width, sample.y, sample.z - direction.x * width),
            waterDeep,
          );
          if (prev) water.indices.push(prev[0], a, prev[1], prev[1], a, b);
          prev = [a, b];
        }
        // Fold the same ribbon down the cliff. Opaque, two-sided, one batch.
        for (let i = 1; i <= 10; i++) {
          const t = i / 10;
          const x = last.x + direction.x * (0.035 + t * 0.065);
          const z = last.z + direction.z * (0.035 + t * 0.065);
          const y = last.y - t * 0.95;
          const a = vertex(
            water,
            point(x - direction.z * width * (1 - t * 0.4), y, z + direction.x * width),
            i > 8 ? foam : waterEdge,
          );
          const b = vertex(
            water,
            point(x + direction.z * width * (1 - t * 0.4), y, z - direction.x * width),
            i > 8 ? foam : waterDeep,
          );
          if (prev) water.indices.push(prev[0], a, prev[1], prev[1], a, b);
          prev = [a, b];
        }
        // Three solid beads terminate the fall; part of the same water draw,
        // not particles, a new light or a permanent geometry allocation.
        const bead = createSmoothIcosahedron(0);
        const beadPositions = bead.getAttribute("position"),
          beadIndex = bead.getIndex()!;
        try {
          for (let drop = 0; drop < 3; drop++) {
            const start = water.positions.length / 3;
            const side = (drop - 1) * 0.075;
            const radius = drop === 1 ? 0.068 : 0.041;
            for (let v = 0; v < beadPositions.count; v++) {
              vertex(
                water,
                point(
                  last.x +
                    direction.x * 0.105 +
                    direction.z * side +
                    beadPositions.getX(v) * radius,
                  last.y - 0.99 - (drop === 1 ? 0.055 : 0) + beadPositions.getY(v) * radius * 1.35,
                  last.z +
                    direction.z * 0.105 -
                    direction.x * side +
                    beadPositions.getZ(v) * radius,
                ),
                foam,
              );
            }
            for (let v = 0; v < beadIndex.count; v++) water.indices.push(start + beadIndex.getX(v));
          }
        } finally {
          bead.dispose();
        }
      }
    }
  }
  return { water: geometryOf(water), bank: geometryOf(bank) };
}
