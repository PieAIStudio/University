/** Shallow supported bank, blue spring and a folded cliff ribbon. The bank
 * joins the existing stone batch; all water is one opaque two-sided draw. */
import * as THREE from "three";
import { createSmoothIcosahedron } from "./foliage-geometry.js";
import { COURSE_SPRING_TRIANGLE_CEILING, type CourseSpring } from "./course-spring-plan.js";

interface Buffer {
  positions: number[];
  colors: number[];
  indices: number[];
  flow: number[];
}
const buffer = (): Buffer => ({ positions: [], colors: [], indices: [], flow: [] });
function vertex(
  b: Buffer,
  x: number,
  y: number,
  z: number,
  c: THREE.Color,
  across = 0,
  fall = -1,
): number {
  const id = b.positions.length / 3;
  b.positions.push(x, y, z);
  b.colors.push(c.r, c.g, c.b);
  b.flow.push(across, fall);
  return id;
}
function geometry(b: Buffer, water = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
  g.setIndex(b.indices);
  if (water) g.setAttribute("springFlow", new THREE.Float32BufferAttribute(b.flow, 2));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
export function buildCourseSpringGeometry(spring: CourseSpring) {
  const water = buffer(),
    bank = buffer();
  const deep = new THREE.Color(0x279bb8),
    edge = new THREE.Color(0x77d6d7);
  const foam = new THREE.Color(0xe9faf3),
    stone = new THREE.Color(0xb7c0b2);
  const { basin, direction, channel, lip, drop } = spring;
  const centre = vertex(water, basin.x, basin.y, basin.z, deep);
  const segments = 24;
  const inner: number[] = [],
    rim: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i * Math.PI * 2) / segments;
    const r = basin.radius * (0.93 + 0.03 * Math.cos(a * 3) + 0.025 * Math.sin(a * 5));
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    inner.push(vertex(water, basin.x + x * 0.66, basin.y, basin.z + z * 0.66, deep));
    rim.push(vertex(water, basin.x + x, basin.y, basin.z + z, edge));
    vertex(bank, basin.x + x, basin.y + 0.015, basin.z + z, stone);
    vertex(bank, basin.x + x * 1.12, basin.y + 0.06, basin.z + z * 1.12, stone);
    vertex(bank, basin.x + x * 1.12, basin.groundRange[0] - 0.02, basin.z + z * 1.12, stone);
    if (i) {
      water.indices.push(
        centre,
        inner[i]!,
        inner[i - 1]!,
        inner[i - 1]!,
        inner[i]!,
        rim[i - 1]!,
        rim[i - 1]!,
        inner[i]!,
        rim[i]!,
      );
      const p = (i - 1) * 3,
        n = i * 3;
      bank.indices.push(p, n, p + 1, p + 1, n, n + 1, p + 1, n + 1, p + 2, p + 2, n + 1, n + 2);
    }
  }
  let previous: readonly number[] | null = null;
  const lanes = [-1, -0.72, -0.4, 0, 0.34, 0.69, 1];
  const row = (x: number, y: number, z: number, width: number, whiten: number, fall = -1) => {
    const ids = lanes.map((side, lane) =>
      vertex(
        water,
        x - direction.z * width * side,
        y,
        z + direction.x * width * side,
        (Math.abs(side) < 0.5 ? edge : deep)
          .clone()
          .lerp(
            foam,
            fall < 0 ? whiten : Math.max(whiten, [0.4, 0.85, 0.18, 0.68, 0.15, 0.7, 0.5][lane]!),
          ),
        side,
        fall,
      ),
    );
    if (previous)
      for (let lane = 0; lane < lanes.length - 1; lane++) {
        water.indices.push(
          previous[lane]!,
          previous[lane + 1]!,
          ids[lane]!,
          previous[lane + 1]!,
          ids[lane + 1]!,
          ids[lane]!,
        );
      }
    previous = ids;
  };
  let previousBanks: number[] | null = null;
  for (const s of channel) {
    row(s.x, s.y, s.z, s.halfWidth, 0);
    const ids: number[] = [];
    for (const side of [-1, 1]) {
      ids.push(
        vertex(
          bank,
          s.x - direction.z * s.halfWidth * side,
          s.y + 0.025,
          s.z + direction.x * s.halfWidth * side,
          stone,
        ),
      );
      ids.push(
        vertex(
          bank,
          s.x - direction.z * (s.halfWidth + 0.16) * side,
          s.groundRange[0] - 0.02,
          s.z + direction.x * (s.halfWidth + 0.16) * side,
          stone,
        ),
      );
    }
    if (previousBanks)
      for (const side of [0, 2]) {
        const faces = [
          previousBanks[side]!,
          ids[side]!,
          previousBanks[side + 1]!,
          previousBanks[side + 1]!,
          ids[side]!,
          ids[side + 1]!,
        ];
        for (let i = 0; i < faces.length; i += 3)
          bank.indices.push(
            faces[i]!,
            faces[i + (side === 0 ? 1 : 2)]!,
            faces[i + (side === 0 ? 2 : 1)]!,
          );
      }
    previousBanks = ids;
  }
  const last = channel.at(-1)!;
  row(lip.x, last.y - 0.04, lip.z, last.halfWidth, 0.38, 0);
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    row(
      lip.x + direction.x * t * 0.7,
      last.y - drop * t,
      lip.z + direction.z * t * 0.7,
      last.halfWidth * (0.92 - Math.sin(t * Math.PI) * 0.14),
      t > 0.8 ? (t - 0.8) * 4 : 0.12,
      t,
    );
  }
  const bead = createSmoothIcosahedron(0);
  try {
    const positions = bead.getAttribute("position"),
      index = bead.index!;
    for (let d = 0; d < 3; d++) {
      const side = (d - 1) * last.halfWidth * 0.7;
      const radius = last.halfWidth * (d === 1 ? 0.52 : 0.33);
      const first = water.positions.length / 3;
      for (let i = 0; i < positions.count; i++)
        vertex(
          water,
          lip.x + direction.x * 0.7 - direction.z * side + positions.getX(i) * radius,
          last.y - drop - radius * (d === 1 ? 1.1 : 0.2) + positions.getY(i) * radius * 1.25,
          lip.z + direction.z * 0.7 + direction.x * side + positions.getZ(i) * radius,
          foam,
        );
      for (const i of index.array) water.indices.push(first + i);
    }
  } finally {
    bead.dispose();
  }
  if ((water.indices.length + bank.indices.length) / 3 > COURSE_SPRING_TRIANGLE_CEILING)
    throw new Error("Spring exceeded its fixed geometric ceiling");
  return { water: geometry(water, true), bank: geometry(bank) };
}
