/**
 * Shared lesson-medallion body: a pale bevelled disc, not a hex paver.
 *
 * Unit space: footprint radius 1, origin at the solid's centre. The instance
 * scale is the authored node radius (~0.62). A short collar at the rim is the
 * only part allowed to bite the ground; the chamfer and top stay visible.
 */
import * as THREE from "three";

import type { IslandHeightSample, IslandSurfacePoseLocal } from "../island/island-geometry.js";
import { type SurfaceTriangleIndex } from "../island/surface-clip.js";
import { GRID_LESSON_PLINTH_ALBEDO, GRID_STOP_RING } from "./grid-palette.js";

export const MEDALLION_SEGMENTS = 14;
export const MEDALLION_HEIGHT = 0.18;
export const MEDALLION_FOOT_RADIUS = 1;
export const MEDALLION_COLLAR_RADIUS = 0.94;
export const MEDALLION_BODY_RADIUS = 0.88;
export const MEDALLION_CHAMFER_RADIUS = 0.82;
export const MEDALLION_TOP_RADIUS = 0.74;
/** Collar thickness in unit Y, the discreet footing that may embed. */
export const MEDALLION_COLLAR_DEPTH = 0.04;

export const MEDALLION_Y_BOTTOM = -MEDALLION_HEIGHT / 2;
export const MEDALLION_Y_COLLAR = MEDALLION_Y_BOTTOM + MEDALLION_COLLAR_DEPTH;
export const MEDALLION_Y_CHAMFER = MEDALLION_HEIGHT / 2 - 0.055;
export const MEDALLION_Y_TOP = MEDALLION_HEIGHT / 2;

/** Origin offset along the normal, as a multiple of the instance radius. */
export const MARKER_PLINTH_OFFSET = 0.11;
/** Engraving sits on the top face, a hair above to avoid z-fight. */
export const MARKER_ENGRAVING_OFFSET = MARKER_PLINTH_OFFSET + MEDALLION_Y_TOP + 0.004;

export const MEDALLION_BODY_ALBEDO = GRID_LESSON_PLINTH_ALBEDO;
const FOOTING_ALBEDO = new THREE.Color(MEDALLION_BODY_ALBEDO);

/** Engraving tint by learner state. The body stays pale sandstone. */
export const MEDALLION_ENGRAVING_COLOURS = GRID_STOP_RING;

export const MEDALLION_ENGRAVING_OPACITY = {
  live: 0.96,
  idle: 0.82,
  done: 0.62,
  locked: 0.4,
} as const;

function medallionProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0, MEDALLION_Y_BOTTOM),
    new THREE.Vector2(MEDALLION_FOOT_RADIUS, MEDALLION_Y_BOTTOM),
    new THREE.Vector2(MEDALLION_COLLAR_RADIUS, MEDALLION_Y_COLLAR),
    new THREE.Vector2(MEDALLION_BODY_RADIUS, 0),
    new THREE.Vector2(MEDALLION_CHAMFER_RADIUS, MEDALLION_Y_CHAMFER),
    new THREE.Vector2(MEDALLION_TOP_RADIUS, MEDALLION_Y_TOP),
    new THREE.Vector2(0, MEDALLION_Y_TOP),
  ];
}

/** One shared lathe; 14 segments keep the silhouette round without a sphere. */
export function createMedallionGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(medallionProfile(), MEDALLION_SEGMENTS);
  const normal = geometry.getAttribute("normal");
  const colours = new Float32Array(normal.count * 3);
  for (let index = 0; index < normal.count; index += 1) {
    const ny = normal.getY(index);
    const value = ny > 0.85 ? 0.96 : ny > 0.25 ? 1 : 0.9;
    colours[index * 3] = value;
    colours[index * 3 + 1] = value;
    colours[index * 3 + 2] = value;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function medallionTriangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  return index ? index.count / 3 : geometry.getAttribute("position").count / 3;
}

/**
 * Contact samples in the same unit space the lathe occupies, so the pose and
 * the instance matrix walk the same rim.
 */
/** Body-bottom rim in unit space; the footing's top edge must match these. */
export function medallionBottomRing(): readonly {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}[] {
  const ring: { x: number; y: number; z: number }[] = [];
  for (let step = 0; step < MEDALLION_SEGMENTS; step += 1) {
    const theta = (step / MEDALLION_SEGMENTS) * Math.PI * 2;
    ring.push({
      x: MEDALLION_FOOT_RADIUS * Math.sin(theta),
      y: MEDALLION_Y_BOTTOM,
      z: MEDALLION_FOOT_RADIUS * Math.cos(theta),
    });
  }
  return ring;
}

export const FOOTING_MAX_EXPOSED = 0.25;
export const FOOTING_EMBED = 0.01;
export const FOOTING_FLAT_EPS = 0.008;

export class MedallionFootingTooTallError extends Error {
  readonly exposed: number;
  readonly x: number;
  readonly z: number;
  constructor(exposed: number, x: number, z: number) {
    super(
      `Medallion footing exposed height ${exposed.toFixed(3)} at (${x.toFixed(2)}, ${z.toFixed(2)}) exceeds ${FOOTING_MAX_EXPOSED}`,
    );
    this.name = "MedallionFootingTooTallError";
    this.exposed = exposed;
    this.x = x;
    this.z = z;
  }
}

export interface MedallionFooting {
  readonly geometry: THREE.BufferGeometry | null;
  readonly triangleCount: number;
  readonly maxExposed: number;
  readonly markersWithFooting: number;
}

function segmentT(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): number | null {
  const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
  if (t > 1e-4 && t < 1 - 1e-4 && u >= -1e-4 && u <= 1 + 1e-4) return t;
  return null;
}

export function medallionEdgeSplits(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  surface: SurfaceTriangleIndex,
): number[] {
  // Each interval is linear on the actual terrain triangle. Quarter points
  // added no contact information but cost 56 triangles per lesson. Keep the
  // midpoint as a stable inspection probe and all real triangle crossings.
  const ts = [0, 0.5, 1];
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minZ = Math.min(az, bz);
  const maxZ = Math.max(az, bz);
  for (const candidate of surface.candidates(minX, minZ, maxX, maxZ)) {
    const triangle = surface.triangles[candidate]!;
    const edges: readonly [number, number, number, number][] = [
      [triangle.x0, triangle.z0, triangle.x1, triangle.z1],
      [triangle.x1, triangle.z1, triangle.x2, triangle.z2],
      [triangle.x2, triangle.z2, triangle.x0, triangle.z0],
    ];
    for (const [cx, cz, dx, dz] of edges) {
      const t = segmentT(ax, az, bx, bz, cx, cz, dx, dz);
      if (t !== null) ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const t of ts) {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(last - t) > 1e-4) unique.push(t);
  }
  return unique;
}

function pushTri(
  positions: number[],
  colors: number[],
  indices: number[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  shade: number,
): void {
  const base = positions.length / 3;
  positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  for (let i = 0; i < 3; i += 1)
    colors.push(FOOTING_ALBEDO.r * shade, FOOTING_ALBEDO.g * shade, FOOTING_ALBEDO.b * shade);
  indices.push(base, base + 1, base + 2);
}

/**
 * One skirt+cap mesh for every lesson on a course. Top of the skirt is the
 * posed medallion bottom rim; the lower edge sits slightly in the drawn
 * ground. Level markers emit nothing.
 */
export function buildMedallionFooting(
  rings: readonly (readonly THREE.Vector3[])[],
  heightAt: (x: number, z: number) => IslandHeightSample,
  surface: SurfaceTriangleIndex,
): MedallionFooting {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let maxExposed = 0;
  let markersWithFooting = 0;
  const shade = 0.9;

  for (const ring of rings) {
    if (ring.length < 3) continue;
    let markerExposed = 0;
    const samples: { x: number; y: number; z: number; ground: number; exposed: number }[][] = [];
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const edge: { x: number; y: number; z: number; ground: number; exposed: number }[] = [];
      for (const t of medallionEdgeSplits(a.x, a.z, b.x, b.z, surface)) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const z = a.z + (b.z - a.z) * t;
        const prev = edge[edge.length - 1];
        if (prev && Math.hypot(x - prev.x, z - prev.z) < 1e-5) continue;
        const sample = heightAt(x, z);
        if (!sample.inside) continue;
        const exposed = y - sample.y;
        if (exposed > FOOTING_MAX_EXPOSED) {
          throw new MedallionFootingTooTallError(exposed, x, z);
        }
        markerExposed = Math.max(markerExposed, exposed);
        edge.push({ x, y, z, ground: sample.y, exposed });
      }
      if (edge.length >= 2) samples.push(edge);
    }
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of ring) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    cx /= ring.length;
    cy /= ring.length;
    cz /= ring.length;
    const centreGround = heightAt(cx, cz);
    if (centreGround.inside) {
      const centreExposed = cy - centreGround.y;
      if (centreExposed > FOOTING_MAX_EXPOSED) {
        throw new MedallionFootingTooTallError(centreExposed, cx, cz);
      }
      markerExposed = Math.max(markerExposed, centreExposed);
    }
    maxExposed = Math.max(maxExposed, markerExposed);
    if (markerExposed <= FOOTING_FLAT_EPS) continue;
    markersWithFooting += 1;

    const closed: { x: number; y: number; z: number; ground: number }[] = [];
    for (const edge of samples) {
      for (let i = 0; i < edge.length - 1; i += 1) {
        const a = edge[i]!;
        const b = edge[i + 1]!;
        if (Math.max(a.exposed, b.exposed) <= 0) continue;
        const aBottom = a.ground - FOOTING_EMBED;
        const bBottom = b.ground - FOOTING_EMBED;
        pushTri(positions, colors, indices, a.x, a.y, a.z, a.x, aBottom, a.z, b.x, b.y, b.z, shade);
        pushTri(
          positions,
          colors,
          indices,
          b.x,
          b.y,
          b.z,
          a.x,
          aBottom,
          a.z,
          b.x,
          bBottom,
          b.z,
          shade,
        );
      }
      const first = edge[0];
      const lastClosed = closed[closed.length - 1];
      if (
        first &&
        (lastClosed === undefined ||
          Math.hypot(lastClosed.x - first.x, lastClosed.z - first.z) > 1e-5)
      ) {
        closed.push(first);
      }
    }

    if (closed.length >= 3) {
      const centreGround = heightAt(cx, cz);
      const centreY = (centreGround.inside ? centreGround.y : cy) - FOOTING_EMBED;
      for (let i = 0; i < closed.length; i += 1) {
        const a = closed[i]!;
        const b = closed[(i + 1) % closed.length]!;
        pushTri(
          positions,
          colors,
          indices,
          cx,
          centreY,
          cz,
          a.x,
          a.ground - FOOTING_EMBED,
          a.z,
          b.x,
          b.ground - FOOTING_EMBED,
          b.z,
          shade,
        );
      }
    }
  }

  if (indices.length === 0) {
    return { geometry: null, triangleCount: 0, maxExposed, markersWithFooting: 0 };
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return {
    geometry,
    triangleCount: indices.length / 3,
    maxExposed,
    markersWithFooting,
  };
}

export function medallionPoseLocals(): readonly IslandSurfacePoseLocal[] {
  const locals: IslandSurfacePoseLocal[] = [
    { x: 0, y: MEDALLION_Y_BOTTOM, z: 0, role: "foot" },
    { x: 0, y: MEDALLION_Y_TOP, z: 0, role: "top" },
  ];
  for (let step = 0; step < MEDALLION_SEGMENTS; step += 1) {
    const theta = (step / MEDALLION_SEGMENTS) * Math.PI * 2;
    const sine = Math.sin(theta);
    const cosine = Math.cos(theta);
    locals.push({
      x: MEDALLION_FOOT_RADIUS * sine,
      y: MEDALLION_Y_BOTTOM,
      z: MEDALLION_FOOT_RADIUS * cosine,
      role: "foot",
    });
    locals.push({
      x: MEDALLION_COLLAR_RADIUS * sine,
      y: MEDALLION_Y_COLLAR,
      z: MEDALLION_COLLAR_RADIUS * cosine,
      role: "foot",
    });
    locals.push({
      x: MEDALLION_CHAMFER_RADIUS * sine,
      y: MEDALLION_Y_CHAMFER,
      z: MEDALLION_CHAMFER_RADIUS * cosine,
      role: "chamfer",
    });
    locals.push({
      x: MEDALLION_TOP_RADIUS * sine,
      y: MEDALLION_Y_TOP,
      z: MEDALLION_TOP_RADIUS * cosine,
      role: "top",
    });
  }
  return locals;
}
