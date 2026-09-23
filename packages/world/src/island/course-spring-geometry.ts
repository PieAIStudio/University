/**
 * The coastal spring as water (R59-07, owner 2026-09-23: 「太假了」).
 *
 * What read as fake, in words: the pond was a flat disc in a grey stone ring —
 * a sink — the stream a straight blue plank between grey boxes, and the fall a
 * flat blue board hanging straight down into nothing, ending in three white
 * balls. The owner's reference pours a wide, bright sheet out of a notch in the
 * rocks at the island's edge, foaming at the lip, streaked as it falls and
 * thinning into the air.
 *
 * So, from the same plan (`course-spring-plan.ts`, unchanged):
 * - pond: an irregular outline, deep in the middle and shallow at the edge
 *   (`springFlow.x` carries the depth to the shader), in a bank of wet soil
 *   that slopes under the meadow, with pebbles, lily pads and reeds;
 * - stream: the same shallow section, depth across and distance along
 *   (`springFlow.y`) so its ripples run downstream, between soil banks;
 * - fall: a separate sheet that leaves the lip in an arc — clear of the sod
 *   lip — and then drops along the cliff, widening, in two layers; the shader
 *   streaks it, foams its lip and thins it to nothing at the bottom, where the
 *   mist (`course-spring-mist`) takes over. Two Kenney rocks flank the notch.
 *
 * Nothing here moves: the flow is all in the material, driven by one time
 * uniform that stops under reduced motion.
 */
import * as THREE from "three";
import { createBoulderGeometry, type BoulderSetting } from "./course-rock-profile.js";
import { COURSE_SPRING_TRIANGLE_CEILING, type CourseSpring } from "./course-spring-plan.js";
import { hash } from "./random.js";

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
  f0 = 0,
  f1 = -1,
): number {
  const id = b.positions.length / 3;
  b.positions.push(x, y, z);
  b.colors.push(c.r, c.g, c.b);
  b.flow.push(f0, f1);
  return id;
}
function geometry(b: Buffer, attribute: string | null): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
  g.setIndex(b.indices);
  if (attribute) g.setAttribute(attribute, new THREE.Float32BufferAttribute(b.flow, 2));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const WATER = new THREE.Color(0x3aa7c4);
const WET = new THREE.Color(0x5a4636);
const SOIL = new THREE.Color(0x7d6147);
const PAD = new THREE.Color(0x5f9f3e);
const PAD_LIGHT = new THREE.Color(0x7cbc4c);
const REED = new THREE.Color(0x4f7f35);
const BLOOM = new THREE.Color(0xf6b7cf);
/** Where the bank meets the meadow it fades to the meadow's own green. */
const MEADOW = new THREE.Color(0x7aa843);

/** Push a triangle of ground cover facing up, whatever order its corners came in. */
function upward(b: Buffer, i: number, j: number, k: number) {
  const p = (n: number) =>
    new THREE.Vector3(b.positions[n * 3], b.positions[n * 3 + 1], b.positions[n * 3 + 2]);
  const normal = p(j)
    .sub(p(i))
    .cross(p(k).sub(p(i)));
  if (normal.y >= 0) b.indices.push(i, j, k);
  else b.indices.push(i, k, j);
}

/**
 * The stream's half width at a section: the planned width narrowed here and
 * there, never widened past it, so the water keeps the plan's clearances but
 * no longer reads as a ruled plank.
 */
function streamHalfWidth(spring: CourseSpring, index: number): number {
  const s = spring.channel[index]!;
  const seed = hash(`${spring.id}/stream`) * 6.28;
  return s.halfWidth * (0.86 + 0.14 * Math.sin(index * 0.9 + seed) * Math.sin(index * 0.37 + seed));
}

/** The pond's outline radius at angle `a`: a lobed, seeded circle. */
function pondRadius(spring: CourseSpring, a: number): number {
  const seed = hash(spring.id) * Math.PI * 2;
  return (
    spring.basin.radius *
    (0.9 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 - seed * 1.7))
  );
}

/** A ring of bank from the water's edge up over a low lip and down under the meadow. */
function addPondBank(bank: Buffer, spring: CourseSpring, segments: number) {
  const { basin } = spring;
  // A low wet lip, then straight down under the meadow: the bank should read
  // as the pond's edge, not as a pot standing on the grass.
  const rows = [
    { r: 1, y: basin.y + 0.004, c: WET },
    { r: 1.04, y: basin.y + 0.03, c: SOIL },
    { r: 1.1, y: basin.groundRange[0] - 0.08, c: MEADOW },
  ];
  const start = bank.positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i * Math.PI * 2) / segments;
    const r = pondRadius(spring, a);
    for (const row of rows)
      vertex(
        bank,
        basin.x + Math.cos(a) * r * row.r,
        row.y,
        basin.z + Math.sin(a) * r * row.r,
        row.c,
      );
  }
  for (let i = 0; i < segments; i += 1)
    for (let k = 0; k < rows.length - 1; k += 1) {
      const a = start + i * rows.length + k;
      const b = a + rows.length;
      upward(bank, a, b, a + 1);
      upward(bank, a + 1, b, b + 1);
    }
}

/** Soil banks either side of the stream, from the water's edge down under the ground. */
function addStreamBanks(bank: Buffer, spring: CourseSpring) {
  const { direction, channel } = spring;
  let previous: number[] | null = null;
  for (const [index, section] of channel.entries()) {
    const s = { ...section, halfWidth: streamHalfWidth(spring, index) };
    const ids: number[] = [];
    for (const side of [-1, 1]) {
      const across = (w: number) => ({
        x: s.x - direction.z * w * side,
        z: s.z + direction.x * w * side,
      });
      const edge = across(s.halfWidth * 0.98);
      const lip = across(s.halfWidth + 0.06);
      const foot = across(s.halfWidth + 0.16);
      ids.push(
        vertex(bank, edge.x, s.y + 0.004, edge.z, WET),
        vertex(bank, lip.x, s.y + 0.03, lip.z, SOIL),
        vertex(bank, foot.x, s.groundRange[0] - 0.08, foot.z, MEADOW),
      );
    }
    if (previous)
      for (const side of [0, 3])
        for (let k = 0; k < 2; k += 1) {
          const a = previous[side + k]!,
            b = ids[side + k]!,
            c = previous[side + k + 1]!,
            d = ids[side + k + 1]!;
          upward(bank, a, c, b);
          upward(bank, c, d, b);
        }
    previous = ids;
  }
}

/** Flat lily pads, each a notched disc, and one pink bloom, floating on the pond. */
function addLilyPads(bank: Buffer, spring: CourseSpring) {
  const { basin } = spring;
  const count = 3 + Math.floor(hash(`${spring.id}/lily`) * 3);
  for (let n = 0; n < count; n += 1) {
    const key = `${spring.id}/lily/${n}`;
    const a = hash(`${key}/a`) * Math.PI * 2;
    const d = basin.radius * (0.35 + hash(`${key}/d`) * 0.4);
    const cx = basin.x + Math.cos(a) * d,
      cz = basin.z + Math.sin(a) * d;
    const r = basin.radius * (0.11 + hash(`${key}/r`) * 0.06);
    const turn = hash(`${key}/t`) * Math.PI * 2;
    const colour = PAD.clone().lerp(PAD_LIGHT, hash(`${key}/c`));
    const centre = vertex(bank, cx, basin.y + 0.012, cz, colour);
    const sides = 8;
    // A notch: the first wedge is left open.
    const rim = Array.from({ length: sides + 1 }, (_, i) => {
      const t = turn + 0.5 + (i / sides) * (Math.PI * 2 - 0.5);
      return vertex(bank, cx + Math.cos(t) * r, basin.y + 0.012, cz + Math.sin(t) * r, colour);
    });
    for (let i = 0; i < sides; i += 1) upward(bank, centre, rim[i + 1]!, rim[i]!);
    if (n === 0) {
      const h = r * 0.45;
      const tip = vertex(bank, cx, basin.y + 0.012 + h, cz, BLOOM);
      const petals = [0, 1, 2].map((i) => {
        const t = turn + (i / 3) * Math.PI * 2;
        return vertex(
          bank,
          cx + Math.cos(t) * h * 0.7,
          basin.y + 0.02,
          cz + Math.sin(t) * h * 0.7,
          BLOOM,
        );
      });
      for (let i = 0; i < 3; i += 1) upward(bank, tip, petals[i]!, petals[(i + 1) % 3]!);
    }
  }
}

/** Tufts of reeds on the far side of the pond from the stream. */
function addReeds(bank: Buffer, spring: CourseSpring) {
  const { basin, direction } = spring;
  const away = Math.atan2(-direction.z, -direction.x);
  for (let tuft = 0; tuft < 3; tuft += 1) {
    const key = `${spring.id}/reed/${tuft}`;
    const a = away + (tuft - 1) * 0.7 + (hash(`${key}/a`) - 0.5) * 0.3;
    const r = pondRadius(spring, a) * 1.02;
    const cx = basin.x + Math.cos(a) * r,
      cz = basin.z + Math.sin(a) * r;
    for (let blade = 0; blade < 4; blade += 1) {
      const t = hash(`${key}/${blade}/t`) * Math.PI * 2;
      const lean = 0.08 + hash(`${key}/${blade}/l`) * 0.1;
      const height = 0.45 + hash(`${key}/${blade}/h`) * 0.35;
      const bx = cx + Math.cos(t) * 0.06,
        bz = cz + Math.sin(t) * 0.06;
      const w = 0.035;
      const l = vertex(bank, bx - Math.sin(t) * w, basin.y, bz + Math.cos(t) * w, REED);
      const rr = vertex(bank, bx + Math.sin(t) * w, basin.y, bz - Math.cos(t) * w, REED);
      const top = vertex(
        bank,
        bx + Math.cos(t) * lean,
        basin.y + height,
        bz + Math.sin(t) * lean,
        REED.clone().multiplyScalar(1.2),
      );
      bank.indices.push(l, rr, top, rr, l, top);
    }
  }
}

/** Kenney stones on the pond's bank and flanking the notch where the water leaves. */
function springStones(spring: CourseSpring): {
  readonly pond: readonly BoulderSetting[];
  readonly notch: readonly BoulderSetting[];
} {
  const { basin, direction, channel } = spring;
  const out = Math.atan2(direction.z, direction.x);
  const stones: BoulderSetting[] = [];
  const notch: BoulderSetting[] = [];
  const pebbles = ["rock_smallE", "rock_smallF", "rock_smallI", "rock_smallH"];
  for (let n = 0; n < 4; n += 1) {
    const key = `${spring.id}/pebble/${n}`;
    // Around the pond, never across the stream's mouth.
    const a = out + 0.9 + n * 1.2 + (hash(`${key}/a`) - 0.5) * 0.4;
    const r = pondRadius(spring, a) * 1.12;
    stones.push({
      shape: pebbles[n]!,
      x: basin.x + Math.cos(a) * r,
      z: basin.z + Math.sin(a) * r,
      scale: 0.9 + hash(`${key}/s`) * 0.6,
      turn: hash(`${key}/t`) * 6.28,
      turf: n % 2 === 0,
    });
  }
  const last = channel.at(-1)!;
  for (const side of [-1, 1]) {
    const w = last.halfWidth + 0.34;
    notch.push({
      shape: side < 0 ? "rock_tallC" : "rock_tallG",
      x: last.x - direction.z * w * side - direction.x * 0.1,
      z: last.z + direction.x * w * side - direction.z * 0.1,
      scale: 1.05 + hash(`${spring.id}/flank/${side}`) * 0.25,
      turn: hash(`${spring.id}/flank/${side}/t`) * 6.28,
      turf: true,
    });
  }
  return { pond: stones, notch };
}

/** Where the fall's centre is at share `s` of its drop: an arc out, then down the cliff. */
export function fallCentre(spring: CourseSpring, s: number): THREE.Vector3 {
  const last = spring.channel.at(-1)!;
  const early = Math.min(1, s / 0.22);
  const out = 1.25 * (1 - (1 - early) ** 3);
  return new THREE.Vector3(
    spring.lip.x + spring.direction.x * out,
    last.y - 0.03 - spring.drop * s ** 1.55,
    spring.lip.z + spring.direction.z * out,
  );
}

/** Two sheets of falling water; `springFlow` = (across in [-1, 1], share of the drop). */
function addFall(fall: Buffer, spring: CourseSpring) {
  const { direction, channel } = spring;
  const last = channel.at(-1)!;
  const rows = 16;
  const lanes = [-1, -0.6, -0.2, 0.2, 0.6, 1];
  const white = new THREE.Color(0xffffff);
  for (const layer of [0, 1]) {
    const width = last.halfWidth * (layer === 0 ? 1.3 : 0.9);
    const forward = layer === 0 ? 0 : 0.1;
    let previous: number[] | null = null;
    for (let row = 0; row <= rows; row += 1) {
      const s = row / rows;
      const centre = fallCentre(spring, s);
      const spread = width * (1 + 1.1 * s ** 1.2);
      const ids = lanes.map((across) =>
        vertex(
          fall,
          centre.x - direction.z * spread * across + direction.x * forward,
          centre.y + (layer === 1 ? 0.02 : 0),
          centre.z + direction.x * spread * across + direction.z * forward,
          white,
          across + layer * 4,
          s,
        ),
      );
      if (previous)
        for (let lane = 0; lane < lanes.length - 1; lane += 1)
          fall.indices.push(
            previous[lane]!,
            ids[lane]!,
            previous[lane + 1]!,
            previous[lane + 1]!,
            ids[lane]!,
            ids[lane + 1]!,
          );
      previous = ids;
    }
  }
}

export function buildCourseSpringGeometry(spring: CourseSpring) {
  const water = buffer(),
    fall = buffer(),
    bank = buffer();
  const { basin, direction, channel, lip } = spring;
  const segments = 28;
  // Pond: centre, two inner rings and the edge; depth runs 1 → 0 outward.
  const centre = vertex(water, basin.x, basin.y, basin.z, WATER, 1, -1);
  const rings = [
    { k: 0.45, depth: 0.8 },
    { k: 0.8, depth: 0.35 },
    { k: 1, depth: 0 },
  ];
  const ring: number[][] = rings.map(() => []);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i * Math.PI * 2) / segments;
    const r = pondRadius(spring, a);
    rings.forEach((entry, k) =>
      ring[k]!.push(
        vertex(
          water,
          basin.x + Math.cos(a) * r * entry.k,
          basin.y,
          basin.z + Math.sin(a) * r * entry.k,
          WATER,
          entry.depth,
          -1,
        ),
      ),
    );
  }
  for (let i = 1; i <= segments; i += 1) {
    water.indices.push(centre, ring[0]![i]!, ring[0]![i - 1]!);
    for (let k = 1; k < rings.length; k += 1)
      water.indices.push(
        ring[k - 1]![i - 1]!,
        ring[k - 1]![i]!,
        ring[k]![i - 1]!,
        ring[k]![i - 1]!,
        ring[k - 1]![i]!,
        ring[k]![i]!,
      );
  }
  // Stream: depth across (0 at the banks), distance along for the ripples.
  const lanes = [-1, -0.5, 0, 0.5, 1];
  let previous: number[] | null = null;
  let along = 0;
  channel.forEach((s, index) => {
    if (index > 0) along += Math.hypot(s.x - channel[index - 1]!.x, s.z - channel[index - 1]!.z);
    const width = streamHalfWidth(spring, index);
    const ids = lanes.map((side) =>
      vertex(
        water,
        s.x - direction.z * width * side,
        s.y,
        s.z + direction.x * width * side,
        WATER,
        1 - Math.abs(side),
        along,
      ),
    );
    if (previous)
      for (let lane = 0; lane < lanes.length - 1; lane += 1)
        water.indices.push(
          previous[lane]!,
          previous[lane + 1]!,
          ids[lane]!,
          previous[lane + 1]!,
          ids[lane + 1]!,
          ids[lane]!,
        );
    previous = ids;
  });
  // The last stretch runs out over the lip to where the fall takes over.
  const lipAlong = along + Math.hypot(lip.x - channel.at(-1)!.x, lip.z - channel.at(-1)!.z);
  const lipIds = lanes.map((side) =>
    vertex(
      water,
      lip.x - direction.z * channel.at(-1)!.halfWidth * side,
      channel.at(-1)!.y - 0.03,
      lip.z + direction.x * channel.at(-1)!.halfWidth * side,
      WATER,
      1 - Math.abs(side),
      lipAlong,
    ),
  );
  if (previous)
    for (let lane = 0; lane < lanes.length - 1; lane += 1)
      water.indices.push(
        previous[lane]!,
        previous[lane + 1]!,
        lipIds[lane]!,
        previous[lane + 1]!,
        lipIds[lane + 1]!,
        lipIds[lane]!,
      );

  addFall(fall, spring);
  addPondBank(bank, spring, segments);
  addStreamBanks(bank, spring);
  addLilyPads(bank, spring);
  addReeds(bank, spring);
  // The rock primitive stands on y = 0: seat the pond's stones on the basin's
  // ground and the notch's on the last stretch's; each sinks its own foot.
  const rocks = springStones(spring);
  const stones = [
    createBoulderGeometry(rocks.pond).translate(0, basin.groundRange[0], 0),
    createBoulderGeometry(rocks.notch).translate(0, channel.at(-1)!.groundRange[0], 0),
  ];
  const bankGeometry = geometry(bank, null);
  const triangles =
    (water.indices.length + fall.indices.length + bank.indices.length) / 3 +
    stones.reduce((sum, part) => sum + part.getIndex()!.count / 3, 0);
  if (triangles > COURSE_SPRING_TRIANGLE_CEILING)
    throw new Error("Spring exceeded its fixed geometric ceiling");
  return {
    water: geometry(water, "springFlow"),
    fall: geometry(fall, "springFlow"),
    bank: bankGeometry,
    stones,
  };
}

/**
 * Where the fall turns to mist: a few soft puffs at its foot, where the sheet
 * has already thinned out. Returned as rest positions; the renderer drifts
 * them slowly.
 */
export function springMistPuffs(spring: CourseSpring): Float32Array {
  const puffs: number[] = [];
  const last = spring.channel.at(-1)!;
  const { direction } = spring;
  // A low cloud where the sheet thins out: spread across and out from the
  // cliff, never a column of beads down the fall.
  for (let n = 0; n < 6; n += 1) {
    const key = `${spring.id}/mist/${n}`;
    const s = 0.84 + hash(`${key}/s`) * 0.16;
    const centre = fallCentre(spring, s);
    const across = ((n + 0.5) / 6 - 0.5) * last.halfWidth * 5 + (hash(`${key}/a`) - 0.5) * 0.4;
    const out = 0.3 + hash(`${key}/o`) * 1.1;
    puffs.push(
      centre.x - direction.z * across + direction.x * out,
      centre.y + (hash(`${key}/y`) - 0.5) * 0.8,
      centre.z + direction.x * across + direction.z * out,
    );
  }
  return Float32Array.from(puffs);
}

let mistTexture: THREE.DataTexture | null = null;
/** One soft round puff, generated once: white, alpha falling off to the rim. */
export function springMistTexture(): THREE.DataTexture {
  if (mistTexture) return mistTexture;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const alpha = Math.max(0, 1 - d) ** 1.8;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  mistTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  mistTexture.needsUpdate = true;
  return mistTexture;
}
