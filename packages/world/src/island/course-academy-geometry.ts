/** A complete timber-and-plaster learning pavilion inside the existing
 * one-module academy envelope. +Z owns its real entrance. Wall apertures are
 * cut in the shell, not painted rectangles; roof, reveal, sill and beams share
 * explicit datums. Beams embed slightly into plaster as structural joints.
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { miniatureBevelBox } from "./miniature-bevel.js";
import { CRAFT_SURFACE, prepareCraftSurface, type CraftSurfaceRole } from "./craft-surface.js";
export const COURSE_ACADEMY_TRIANGLE_CEILING = 3400;
export const COURSE_ACADEMY_SIZE = { x: 1.1, y: 1.5707, z: 1.0707 } as const;
type Hole = readonly [number, number, number, number];
const PIGMENT = {
  plaster: 0x90b4bc,
  wood: 0xa7764f,
  edge: 0xc5925f,
  roof: 0x409b98,
  roofEdge: 0x377e7c,
  stone: 0xb7b7a5,
  glass: 0xb8dfde,
  inner: 0xb9b793,
} as const;

// These are builder-owned named swatches, not colour classification in the
// renderer. Changing a pigment does not change the material it describes.
const ROLES = new Map<number, CraftSurfaceRole>([
  [PIGMENT.plaster, CRAFT_SURFACE.plaster],
  [PIGMENT.wood, CRAFT_SURFACE.timber],
  [PIGMENT.edge, CRAFT_SURFACE.timber],
  [PIGMENT.roof, CRAFT_SURFACE.roof],
  [PIGMENT.roofEdge, CRAFT_SURFACE.roof],
  [PIGMENT.glass, CRAFT_SURFACE.glazing],
]);

export function createCourseAcademyGeometry(foundationY = -0.04): THREE.BufferGeometry {
  if (!Number.isFinite(foundationY) || foundationY > 0.02 || foundationY < -0.16)
    throw new RangeError("Academy foundation must stay in its fitted ground allowance");
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, colour: number) => {
    const c = new THREE.Color(colour),
      a = new Float32Array(g.attributes.position!.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    g.deleteAttribute("uv");
    g.clearGroups();
    prepareCraftSurface(g, ROLES.get(colour) ?? CRAFT_SURFACE.natural);
    parts.push(g);
    return g;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    colour: number,
    roll = 0,
  ) =>
    paint(
      miniatureBevelBox([w, h, d], Math.min(w, h, d) * 0.15)
        .rotateZ(roll)
        .translate(x, y, z),
      colour,
    );
  const shell = (holes: readonly Hole[], x: number, z: number, yaw: number) => {
    const xs = [...new Set([-0.46, 0.46, ...holes.flatMap((h) => [h[0], h[1]])])].sort(
      (a, b) => a - b,
    );
    const ys = [...new Set([0.035, 1, ...holes.flatMap((h) => [h[2], h[3]])])].sort(
      (a, b) => a - b,
    );
    const p: number[] = [],
      indices: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[]) => {
      const s = p.length / 3;
      p.push(...a, ...b, ...c, ...d);
      indices.push(s, s + 1, s + 2, s, s + 2, s + 3);
    };
    const present = (i: number, j: number) =>
      i >= 0 &&
      j >= 0 &&
      i < xs.length - 1 &&
      j < ys.length - 1 &&
      !holes.some(
        (h) =>
          (xs[i]! + xs[i + 1]!) / 2 > h[0] &&
          (xs[i]! + xs[i + 1]!) / 2 < h[1] &&
          (ys[j]! + ys[j + 1]!) / 2 > h[2] &&
          (ys[j]! + ys[j + 1]!) / 2 < h[3],
      );
    const t = 0.031;
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        if (!present(i, j)) continue;
        const l = xs[i]!,
          r = xs[i + 1]!,
          b = ys[j]!,
          u = ys[j + 1]!;
        quad([l, b, t], [r, b, t], [r, u, t], [l, u, t]);
        quad([r, b, -t], [l, b, -t], [l, u, -t], [r, u, -t]);
        if (!present(i - 1, j)) quad([l, b, -t], [l, b, t], [l, u, t], [l, u, -t]);
        if (!present(i + 1, j)) quad([r, b, t], [r, b, -t], [r, u, -t], [r, u, t]);
        if (!present(i, j - 1)) quad([l, b, -t], [r, b, -t], [r, b, t], [l, b, t]);
        if (!present(i, j + 1)) quad([l, u, t], [r, u, t], [r, u, -t], [l, u, -t]);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    paint(g.rotateY(yaw).translate(x, 0, z), PIGMENT.plaster);
  };
  try {
    const door: Hole = [-0.16, 0.16, 0.035, 0.72],
      window: Hole = [-0.2, 0.2, 0.43, 0.76];
    shell([door], 0, 0.455, 0);
    shell([window], 0, -0.455, Math.PI);
    shell([window], 0.455, 0, Math.PI / 2);
    shell([window], -0.455, 0, -Math.PI / 2);
    box(0.98, 0.055 - foundationY, 0.98, 0, (foundationY + 0.055) / 2, 0, PIGMENT.stone);
    // Four corner posts, top beams and a deliberately open entrance.
    for (const x of [-0.459, 0.459])
      for (const z of [-0.459, 0.459]) box(0.068, 1.01, 0.068, x, 0.505, z, PIGMENT.wood);
    for (const z of [-0.47, 0.47]) box(0.98, 0.064, 0.062, 0, 0.967, z, PIGMENT.edge);
    for (const x of [-0.47, 0.47]) box(0.062, 0.064, 0.98, x, 0.967, 0, PIGMENT.edge);
    for (const x of [-0.185, 0.185]) box(0.045, 0.736, 0.073, x, 0.388, 0.463, PIGMENT.edge);
    box(0.415, 0.048, 0.073, 0, 0.742, 0.463, PIGMENT.edge);
    // Three real glazed windows. Their proud frames and recessed panes have
    // different depths; no coplanar overlay and no imaginary hole in a solid.
    for (const yaw of [Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const start = parts.length;
      for (const x of [-0.221, 0.221]) box(0.042, 0.386, 0.073, x, 0.595, 0.458, PIGMENT.edge);
      for (const y of [0.41, 0.783]) box(0.49, 0.04, 0.073, 0, y, 0.458, PIGMENT.edge);
      box(0.026, 0.326, 0.034, 0, 0.596, 0.466, PIGMENT.wood);
      box(0.388, 0.025, 0.034, 0, 0.597, 0.466, PIGMENT.wood);
      box(0.394, 0.324, 0.008, 0, 0.596, 0.446, PIGMENT.glass);
      box(0.5, 0.042, 0.112, 0, 0.397, 0.46, PIGMENT.wood);
      for (const g of parts.slice(start)) g.rotateY(yaw);
    }
    // Solid gable ends support both roof slopes; outer datum is the same as
    // the registered roof-gable, never a free-floating ornamental roof.
    for (const z of [-0.45, 0.45]) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.46, 1);
      shape.lineTo(0.46, 1);
      shape.lineTo(0, 1.5);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
        steps: 1,
      });
      if (!g.index) g.setIndex(Array.from({ length: g.attributes.position!.count }, (_, i) => i));
      paint(g.translate(0, 0, z - 0.0225), PIGMENT.plaster);
    }
    const rise = 0.54,
      span = 0.535,
      angle = Math.atan2(rise, span),
      run = Math.hypot(rise, span);
    for (const side of [-1, 1]) {
      box(run, 0.028, 1.052, (side * span) / 2, 1.005 + rise / 2, 0, PIGMENT.roof, -side * angle);
      for (const z of [-0.504, 0.504])
        box(
          run,
          0.035,
          0.042,
          (side * span) / 2,
          1.005 + rise / 2 - 0.019,
          z,
          PIGMENT.roofEdge,
          -side * angle,
        );
      // Keep the broad roof and its real eaves. Six subpixel standing-seam
      // strips added dotted shadow/silhouette chatter at the normal distance;
      // spending 264 triangles on them did not improve the little pavilion.
    }
    box(0.065, 0.035, 1.058, 0, 1.545, 0, PIGMENT.roofEdge);
    const g = mergeBufferGeometries(parts, false);
    if (!g) throw new Error("Academy material attributes disagree");
    g.computeBoundingBox();
    g.computeBoundingSphere();
    if (g.index!.count / 3 > COURSE_ACADEMY_TRIANGLE_CEILING) {
      g.dispose();
      throw new Error("Academy geometry exceeds its budget");
    }
    return g;
  } finally {
    parts.forEach((g) => g.dispose());
  }
}
