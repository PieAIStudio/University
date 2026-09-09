/** Bounded grounding recovery. Reads the drawn mesh; never invents a height field. */
import * as THREE from "three";

import type { IslandUnitSigil } from "../island/island-blueprint.js";
import type { IslandHeightSample } from "../island/island-geometry.js";
import {
  clipPolygonToTriangleXZ,
  doubleSignedAreaXZ,
  heightOnTriangle,
  type PlanPoint,
  type SurfaceTriangle,
  type SurfaceTriangleIndex,
} from "../island/surface-clip.js";
import { unitRingGeometry, unitSigilArcCount } from "../island/unit-sigil.js";
import {
  FOOTING_MAX_EXPOSED,
  MARKER_PLINTH_OFFSET,
  MEDALLION_BODY_ALBEDO,
  MEDALLION_ENGRAVING_COLOURS,
  MEDALLION_TOP_RADIUS,
  medallionBottomRing,
  medallionEdgeSplits,
  medallionPoseLocals,
} from "./lesson-medallion.js";

export interface MedallionGrounding {
  readonly mode: "plane" | "refit" | "inlay";
  readonly normal: THREE.Vector3;
  readonly lift: number;
  readonly attempts: number;
  readonly initialExposed: number;
  readonly exposed: number;
}

interface GroundingInput {
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly normal: THREE.Vector3;
  readonly lift: number;
  readonly heightAt: (x: number, z: number) => IslandHeightSample;
  readonly surface: SurfaceTriangleIndex;
}

interface Contact {
  readonly exposed: number;
  readonly deficit: number;
  readonly inside: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const LOCALS = medallionPoseLocals();
const RING = medallionBottomRing();
const SLOPE_DELTAS = [-0.16, -0.08, 0, 0.08, 0.16] as const;
const MIN_NORMAL_Y = Math.cos((38 * Math.PI) / 180);

/**
 * Most markers need no recovery. For an unsafe least-squares fit, search 25
 * nearby support planes with at most three bounded raises each. Every result
 * is checked at the actual terrain-edge crossings, not just 14 rim vertices.
 * When no rigid stance fits, a shallow terrain-clipped inlay keeps the same
 * lesson footprint, sigil and click target. No swallowed exception, oversized
 * pedestal, relocated lesson, or unbounded retry.
 */
export function groundMedallion(input: GroundingInput): MedallionGrounding {
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const scale = new THREE.Vector3().setScalar(input.radius);
  const measure = (normal: THREE.Vector3, lift: number): Contact => {
    quaternion.setFromUnitVectors(UP, normal);
    origin.copy(input.position).addScaledVector(normal, input.radius * MARKER_PLINTH_OFFSET + lift);
    matrix.compose(origin, quaternion, scale);
    let deficit = 0;
    let exposed = 0;
    let inside = true;
    for (const point of LOCALS) {
      vertex.set(point.x, point.y, point.z).applyMatrix4(matrix);
      const ground = input.heightAt(vertex.x, vertex.z);
      if (!ground.inside || !Number.isFinite(ground.y)) {
        inside = false;
        continue;
      }
      if (point.role === "foot") continue;
      const required = point.role === "top" ? 0.02 : 0;
      deficit = Math.max(deficit, ground.y + required - vertex.y);
    }
    const ring = RING.map((point) =>
      new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(matrix),
    );
    const sampleFoot = (x: number, y: number, z: number) => {
      const ground = input.heightAt(x, z);
      if (!ground.inside || !Number.isFinite(ground.y)) inside = false;
      else exposed = Math.max(exposed, y - ground.y);
    };
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index]!;
      const b = ring[(index + 1) % ring.length]!;
      for (const t of medallionEdgeSplits(a.x, a.z, b.x, b.z, input.surface)) {
        sampleFoot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
      }
    }
    vertex.set(0, RING[0]!.y, 0).applyMatrix4(matrix);
    sampleFoot(vertex.x, vertex.y, vertex.z);
    return { exposed, deficit, inside };
  };
  const acceptable = (contact: Contact) =>
    contact.inside && contact.deficit < 0.001 && contact.exposed <= FOOTING_MAX_EXPOSED - 0.001;
  const first = measure(input.normal, input.lift);
  if (acceptable(first))
    return {
      mode: "plane",
      normal: input.normal,
      lift: input.lift,
      attempts: 1,
      initialExposed: first.exposed,
      exposed: first.exposed,
    };

  let best: { normal: THREE.Vector3; lift: number; contact: Contact } | null = null;
  const slopeX = -input.normal.x / input.normal.y;
  const slopeZ = -input.normal.z / input.normal.y;
  let attempts = 1;
  for (const dx of SLOPE_DELTAS) {
    for (const dz of SLOPE_DELTAS) {
      const normal = new THREE.Vector3(-slopeX - dx, 1, -slopeZ - dz).normalize();
      if (normal.y < MIN_NORMAL_Y) continue;
      let lift = 0;
      let contact = measure(normal, lift);
      attempts += 1;
      for (let raise = 0; raise < 3 && contact.deficit > 0.0002; raise += 1) {
        lift = Math.min(input.radius * 0.16, lift + (contact.deficit + 0.0005) / normal.y);
        contact = measure(normal, lift);
      }
      if (acceptable(contact) && (!best || contact.exposed < best.contact.exposed))
        best = { normal, lift, contact };
    }
  }
  if (best)
    return {
      mode: "refit",
      normal: best.normal,
      lift: best.lift,
      attempts,
      initialExposed: first.exposed,
      exposed: best.contact.exposed,
    };
  return {
    mode: "inlay",
    normal: input.normal,
    lift: input.lift,
    attempts,
    initialExposed: first.exposed,
    exposed: 0.04,
  };
}

export interface MedallionInlayInput {
  readonly markerIndex: number;
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly sigil?: IslandUnitSigil;
  readonly state: keyof typeof MEDALLION_ENGRAVING_COLOURS;
}

export interface MedallionInlays {
  readonly geometry: THREE.BufferGeometry | null;
  readonly triangleCount: number;
  readonly ranges: readonly {
    readonly markerIndex: number;
    readonly start: number;
    readonly end: number;
  }[];
}

/** Rare fallback, merged into one mesh with explicit face-to-lesson picking. */
export function buildMedallionInlays(
  inputs: readonly MedallionInlayInput[],
  surface: SurfaceTriangleIndex,
): MedallionInlays {
  const positions: number[] = [];
  const colors: number[] = [];
  const ranges: { markerIndex: number; start: number; end: number }[] = [];
  const pale = new THREE.Color(MEDALLION_BODY_ALBEDO);
  const rimColor = pale.clone().multiplyScalar(0.86);
  const append = (points: readonly PlanPoint[], offsets: readonly number[], color: THREE.Color) => {
    if (Math.abs(doubleSignedAreaXZ(points)) < 1e-10) return;
    const offsetTriangle: SurfaceTriangle = {
      x0: points[0]!.x,
      z0: points[0]!.z,
      y0: offsets[0]!,
      i0: -1,
      x1: points[1]!.x,
      z1: points[1]!.z,
      y1: offsets[1]!,
      i1: -1,
      x2: points[2]!.x,
      z2: points[2]!.z,
      y2: offsets[2]!,
      i2: -1,
    };
    for (const candidate of surface.candidates(
      Math.min(...points.map((p) => p.x)),
      Math.min(...points.map((p) => p.z)),
      Math.max(...points.map((p) => p.x)),
      Math.max(...points.map((p) => p.z)),
    )) {
      const triangle = surface.triangles[candidate]!;
      const clipped = clipPolygonToTriangleXZ(points, triangle);
      for (let index = 1; index + 1 < clipped.length; index += 1) {
        const fan = [clipped[0]!, clipped[index]!, clipped[index + 1]!];
        if (Math.abs(doubleSignedAreaXZ(fan)) < 1e-10) continue;
        for (const point of fan) {
          const ground = heightOnTriangle(triangle, point.x, point.z);
          const offset = heightOnTriangle(offsetTriangle, point.x, point.z);
          // Both planes were checked for degeneracy before emitting the fan.
          if (ground === null || offset === null)
            throw new Error("Degenerate medallion inlay plane");
          positions.push(point.x, ground + offset, point.z);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
  };
  for (const input of inputs) {
    const start = positions.length / 9;
    const center = { x: input.position.x, z: input.position.z };
    const ring = RING.map((point) => ({
      x: center.x + point.x * input.radius,
      z: center.z + point.z * input.radius,
    }));
    const inner = RING.map((point) => ({
      x: center.x + point.x * input.radius * 0.86,
      z: center.z + point.z * input.radius * 0.86,
    }));
    for (let index = 0; index < ring.length; index += 1) {
      const next = (index + 1) % ring.length;
      append([center, inner[index]!, inner[next]!], [0.035, 0.035, 0.035], pale);
      append([inner[index]!, ring[index]!, ring[next]!], [0.035, 0.005, 0.005], rimColor);
      append([inner[index]!, ring[next]!, inner[next]!], [0.035, 0.005, 0.035], rimColor);
    }
    if (input.sigil) {
      const geometry = unitRingGeometry(unitSigilArcCount(input.sigil));
      const position = geometry.getAttribute("position");
      const indices = geometry.getIndex()!;
      const tint = new THREE.Color(MEDALLION_ENGRAVING_COLOURS[input.state]);
      for (let face = 0; face < indices.count; face += 3) {
        const points = [0, 1, 2].map((offset) => {
          const vertex = indices.getX(face + offset);
          return {
            x: center.x + position.getX(vertex) * input.radius * MEDALLION_TOP_RADIUS,
            z: center.z + position.getZ(vertex) * input.radius * MEDALLION_TOP_RADIUS,
          };
        });
        append(points, [0.04, 0.04, 0.04], tint);
      }
    }
    ranges.push({ markerIndex: input.markerIndex, start, end: positions.length / 9 });
  }
  if (!positions.length) return { geometry: null, triangleCount: 0, ranges };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return { geometry, triangleCount: positions.length / 9, ranges };
}
