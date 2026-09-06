/**
 * Non-colour unit cue: a notched ring whose arc count is the identity.
 *
 * Extracted from the course renderer so the lesson medallion can engrave the
 * same ring instead of growing a second generator. Colour is a later tint;
 * greyscale still has to tell the units apart (v5 decision D / L).
 */
import * as THREE from "three";

import type { IslandUnitSigil } from "./island-blueprint.js";

export const UNIT_SIGIL_ARCS: Readonly<Record<IslandUnitSigil, number>> = {
  mountain: 2,
  leaf: 3,
  wave: 4,
  star: 5,
  shell: 6,
  sun: 8,
};

/** Inner/outer radii of the engraving, in the unit disc the instance scales. */
export const UNIT_RING_INNER = 0.66;
export const UNIT_RING_OUTER = 0.86;
/** Fraction of each arc's slot left empty, so the arcs read as separate marks. */
export const UNIT_RING_GAP = 0.3;

const unitRingCache = new Map<number, THREE.BufferGeometry>();

/**
 * A flat notched ring in the XZ plane. Shared across every marker of the same
 * sigil; callers instance it rather than building one mesh per lesson.
 */
export function unitRingGeometry(arcs: number): THREE.BufferGeometry {
  const cached = unitRingCache.get(arcs);
  if (cached) return cached;
  const positions: number[] = [];
  const indices: number[] = [];
  const stepsPerArc = Math.max(3, Math.round(24 / arcs));
  const slot = (Math.PI * 2) / arcs;
  const span = slot * (1 - UNIT_RING_GAP);
  for (let arc = 0; arc < arcs; arc += 1) {
    const start = arc * slot + (slot - span) / 2;
    const base = positions.length / 3;
    for (let step = 0; step <= stepsPerArc; step += 1) {
      const angle = start + (step / stepsPerArc) * span;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(cos * UNIT_RING_INNER, 0, sin * UNIT_RING_INNER);
      positions.push(cos * UNIT_RING_OUTER, 0, sin * UNIT_RING_OUTER);
    }
    for (let step = 0; step < stepsPerArc; step += 1) {
      const a = base + step * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  unitRingCache.set(arcs, geometry);
  return geometry;
}

export function unitSigilArcCount(sigil: IslandUnitSigil): number {
  return UNIT_SIGIL_ARCS[sigil];
}
