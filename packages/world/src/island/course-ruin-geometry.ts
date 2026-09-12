/** Decorative masonry inside an ALREADY reserved rock envelope. The arch is
 * assembled from closed piers and one continuous arch; it never creates a route,
 * portal or collider.
 * Original procedural geometry, using the existing opaque vertex-colour draw.
 */
import * as THREE from "three";
import { COURSE_LANDSCAPE_LIMITS, type CourseOutcrop } from "./course-outcrop-plan.js";

type Point = readonly [number, number, number];
export const COURSE_RUIN_TRIANGLES = COURSE_LANDSCAPE_LIMITS.ruinTriangles;

export function createCourseRuinGeometry(site: CourseOutcrop): THREE.BufferGeometry {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const stone = new THREE.Color(0xaab7be);
  const warm = new THREE.Color(0xc9c6b7);
  const moss = new THREE.Color(0x91b65a);
  const radius = site.radius;
  const height = site.groundRange[1] + site.height - site.baseY;
  const cos = Math.cos(site.turn),
    sin = Math.sin(site.turn);
  const triangle = (a: Point, b: Point, c: Point, color: THREE.Color) => {
    const first = positions.length / 3;
    for (const [x, y, z] of [a, b, c]) {
      positions.push(
        site.x + (x * cos - z * sin) * radius,
        site.baseY + y * height,
        site.z + (x * sin + z * cos) * radius,
      );
      colors.push(color.r, color.g, color.b);
    }
    indices.push(first, first + 1, first + 2);
  };
  const block = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tint: number,
    growsMoss = false,
  ) => {
    const color = stone.clone().lerp(warm, tint);
    const outline = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ] as const;
    const rings = [
      { y, inset: 0.86 },
      { y: y + h * 0.09, inset: 1 },
      { y: y + h * 0.91, inset: 1 },
      { y: y + h, inset: 0.86 },
    ].map((ring) =>
      outline.map(
        ([a, b]): Point => [x + (a * w * ring.inset) / 2, ring.y, z + (b * d * ring.inset) / 2],
      ),
    );
    for (let band = 0; band < 3; band++)
      for (let i = 0; i < 4; i++) {
        const n = (i + 1) % 4;
        triangle(rings[band]![i]!, rings[band + 1]![i]!, rings[band + 1]![n]!, color);
        triangle(rings[band]![i]!, rings[band + 1]![n]!, rings[band]![n]!, color);
      }
    for (let i = 0; i < 4; i++) {
      const n = (i + 1) % 4;
      triangle([x, y + h, z], rings[3]![n]!, rings[3]![i]!, growsMoss ? moss : color);
      triangle([x, y, z], rings[0]![i]!, rings[0]![n]!, color);
    }
  };
  // Three interlocking courses; the ground-facing blocks all start below the
  // actual minimum terrain sample, not at the model's arbitrary centre.
  for (const side of [-1, 1])
    for (let row = 0; row < 3; row++) {
      block(
        side * (0.492 + (row % 2) * 0.008),
        row * 0.17,
        0,
        0.245 - row * 0.012,
        0.174,
        0.27 - row * 0.012,
        0.22 + row * 0.13 + (side + 1) * 0.08,
        row === 0,
      );
    }
  // Elliptical voussoirs, not one stretched rectangular lintel. Internal joint
  // faces are omitted: the coloured segments form ONE closed arch, rather
  // than coincident internal caps with four faces sharing an edge.
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI) / 7,
      b = ((i + 1) * Math.PI) / 7;
    const p: Point[] = [
      [Math.cos(a) * 0.615, 0.51 + Math.sin(a) * 0.45, 0.124],
      [Math.cos(b) * 0.615, 0.51 + Math.sin(b) * 0.45, 0.124],
      [Math.cos(b) * 0.37, 0.51 + Math.sin(b) * 0.27, 0.124],
      [Math.cos(a) * 0.37, 0.51 + Math.sin(a) * 0.27, 0.124],
    ];
    p.push(...p.map(([x, y]): Point => [x, y, -0.124]));
    const color = stone.clone().lerp(warm, 0.22 + (i % 3) * 0.16);
    for (const [a, b, c] of [
      [0, 1, 2],
      [0, 2, 3],
      [4, 6, 5],
      [4, 7, 6],
    ])
      triangle(p[a!]!, p[b!]!, p[c!]!, color);
    for (let e = 0; e < 4; e++) {
      if ((e === 1 && i < 6) || (e === 3 && i > 0)) continue;
      const n = (e + 1) % 4;
      triangle(p[e]!, p[e + 4]!, p[n + 4]!, color);
      triangle(p[e]!, p[n + 4]!, p[n]!, e === 0 && i % 3 === 0 ? moss : color);
    }
  }
  // A small fallen fragment explains that this is scenery, not an entry
  // waiting to be unlocked. All rubble stays inside the same reservation.
  block(-0.72, 0, 0.28, 0.2, 0.17, 0.24, 0.35, true);
  block(0.66, 0, -0.34, 0.27, 0.12, 0.24, 0.55);
  block(-0.04, 0, 0.47, 0.44, 0.1, 0.21, 0.48, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
