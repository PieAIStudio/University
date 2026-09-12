import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { miniatureBevelBox } from "./miniature-bevel.js";
import { createMiniatureAsset } from "./miniature-assets.js";
import { CRAFT_SURFACE, prepareCraftSurface, type CraftSurfaceRole } from "./craft-surface.js";

/** Same source-space envelope as the registered stall. An existing placement
 * becomes a complete cloth-canopy learning stall, not another facility.
 * Model dimensions are datums shared with its footprint/support planner.
 */
export const COURSE_STALL_SIZE = { x: 0.65, y: 0.3655, z: 1 } as const;
export const COURSE_STALL_FEET = [
  [-0.26, -0.43],
  [-0.26, 0.43],
  [0.26, -0.43],
  [0.26, 0.43],
] as const;
export const COURSE_STALL_TRIANGLE_CEILING = 1200;

export function createCourseStallGeometry(footY: readonly number[] = [0, 0, 0, 0]) {
  if (footY.length !== 4 || !footY.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.14))
    throw new RangeError("The four stall feet must fit their measured ground datums");
  const parts: THREE.BufferGeometry[] = [];
  const colour = (
    geometry: THREE.BufferGeometry,
    hex: number,
    role: CraftSurfaceRole = CRAFT_SURFACE.timber,
  ) => {
    const c = new THREE.Color(hex),
      data = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < data.length; i += 3) {
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(data, 3));
    geometry.deleteAttribute("uv");
    prepareCraftSurface(geometry, role);
    if (!geometry.index) geometry.setIndex(Array.from({ length: data.length / 3 }, (_, i) => i));
    parts.push(geometry);
  };
  const box = (
    size: readonly [number, number, number],
    at: readonly [number, number, number],
    hex: number,
    role: CraftSurfaceRole = CRAFT_SURFACE.timber,
  ) => colour(miniatureBevelBox(size).translate(...at), hex, role);
  try {
    // Each support is cut to the actual sampled ground. Tops keep one rigid
    // canopy datum; this does not bend an entire imported building to a hill.
    COURSE_STALL_FEET.forEach(([x, z], i) => {
      const bottom = footY[i]!,
        top = 0.31;
      box([0.034, top - bottom, 0.034], [x, (top + bottom) / 2, z], 0x9b6945);
    });
    for (const x of [-0.26, 0.26]) box([0.03, 0.026, 0.91], [x, 0.292, 0], 0xb17a50);
    box([0.3, 0.025, 0.86], [-0.065, 0.181, 0], 0xd2a776);
    box([0.026, 0.105, 0.83], [0.065, 0.117, 0], 0xad774c);
    box([0.028, 0.018, 0.86], [0.067, 0.075, 0], 0xd1a576);

    // A single closed, six-gore textile shell. A shallow crown and scalloped
    // long hems keep the silhouette soft; thickness is real, not DoubleSide.
    const xs = [-0.325, -0.28, 0, 0.28, 0.325];
    const ys = [0.282, 0.309, COURSE_STALL_SIZE.y, 0.309, 0.282];
    const rows = 13,
      columns = xs.length;
    const top = Array.from({ length: rows }, (_, row) =>
      xs.map(
        (x, i) =>
          new THREE.Vector3(
            x,
            ys[i]! - (i === 0 || i === 4 ? (row % 2) * 0.009 : 0),
            -0.5 + row / 12,
          ),
      ),
    ).flat();
    const lower = top.map((p) => p.clone().add(new THREE.Vector3(0, -0.006, 0)));
    const p: number[] = [],
      c: number[] = [],
      ids: number[] = [];
    const emit = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, hex: number) => {
      const start = p.length / 3,
        pigment = new THREE.Color(hex);
      for (const v of [a, b, d]) {
        p.push(v.x, v.y, v.z);
        c.push(pigment.r, pigment.g, pigment.b);
      }
      ids.push(start, start + 1, start + 2);
    };
    for (let row = 0; row < rows - 1; row++)
      for (let col = 0; col < columns - 1; col++) {
        const a = row * columns + col,
          b = a + 1,
          d = a + columns,
          e = d + 1;
        const tint = Math.floor(row / 2) % 2 === 0 ? 0xdfa676 : 0xf2dbad;
        emit(top[a]!, top[d]!, top[b]!, tint);
        emit(top[b]!, top[d]!, top[e]!, tint);
        emit(lower[a]!, lower[b]!, lower[d]!, 0xd8bb94);
        emit(lower[b]!, lower[e]!, lower[d]!, 0xd8bb94);
      }
    const boundary = [
      ...Array.from({ length: columns }, (_, i) => i),
      ...Array.from({ length: rows - 1 }, (_, i) => (i + 1) * columns + columns - 1),
      ...Array.from({ length: columns - 1 }, (_, i) => rows * columns - 2 - i),
      ...Array.from({ length: rows - 2 }, (_, i) => (rows - 2 - i) * columns),
    ];
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i]!,
        b = boundary[(i + 1) % boundary.length]!;
      emit(top[a]!, top[b]!, lower[a]!, 0xeacb97);
      emit(top[b]!, lower[b]!, lower[a]!, 0xeacb97);
    }
    const canopy = new THREE.BufferGeometry();
    canopy.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    canopy.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    canopy.setIndex(ids);
    canopy.computeVertexNormals();
    prepareCraftSurface(canopy, CRAFT_SURFACE.cloth);
    parts.push(canopy);

    // A few books and a planted pot belong to the counter, all below its roof.
    box([0.12, 0.022, 0.14], [-0.03, 0.205, -0.22], 0x508c99, CRAFT_SURFACE.natural);
    box([0.105, 0.012, 0.13], [-0.024, 0.222, -0.215], 0xe9dbb4, CRAFT_SURFACE.natural);
    box([0.115, 0.017, 0.13], [-0.04, 0.237, -0.2], 0xa8794d, CRAFT_SURFACE.natural);
    colour(
      new THREE.CylinderGeometry(0.037, 0.026, 0.046, 8, 1).translate(-0.06, 0.217, 0.25),
      0xb77a51,
      CRAFT_SURFACE.natural,
    );
    const plant = createMiniatureAsset("grass")
      .scale(0.19, 0.19, 0.19)
      .translate(-0.06, 0.24, 0.25);
    prepareCraftSurface(plant);
    parts.push(plant);
    const geometry = mergeBufferGeometries(parts, false);
    if (!geometry) throw new Error("Stall parts must share the existing landscape vertex format");
    if ((geometry.index?.count ?? 0) / 3 > COURSE_STALL_TRIANGLE_CEILING) {
      geometry.dispose();
      throw new Error("Stall geometry budget exceeded");
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } finally {
    parts.forEach((p) => p.dispose());
  }
}
