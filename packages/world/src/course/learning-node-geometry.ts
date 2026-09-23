import * as THREE from "three";
import type { MapLearningKind } from "@pieai/university-core";

import { GRID_LEARNING_NODE_ALBEDO } from "../grid/grid-palette.js";
import type { LearningSite } from "./learning-sites.js";

/**
 * The three learning nodes as objects a learner can recognise at a few dozen
 * pixels, told apart by silhouette rather than colour (V5: 不只靠颜色区分):
 *
 * - checkpoint: a small gate — two posts and a lintel, a Π you pass through
 * - challenge:  a pennant on a pole — a line and a triangle
 * - personal:   a notice board on two legs, with one pinned note
 *
 * Deliberately not a disc with a token standing on it: ADR-0008 rejected that
 * for lesson nodes on 2026-08-28 ("a circle with an inexplicable little thing
 * in the middle").
 *
 * Each object turns to face the camera's heading, because a pennant or a board
 * seen edge-on is a line; the course camera pans and zooms but its heading is
 * fixed, so this is a rare update, not a spin. Posts and legs therefore sink
 * deeper than the steepest ground the placement accepts (MAX_SLOPE_RISE in
 * learning-sites.ts), so no turn can lift a foot off the ground.
 */

/**
 * Objects are authored at a unit scale and drawn this much larger. The gate is
 * the largest because the avatar stands under it; the owner asked for all
 * three to read bigger than the first 1.6 on 2026-09-23.
 */
export const LEARNING_NODE_KIND_SCALE: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 2.3,
  challenge: 2.1,
  personal: 1.95,
};
/** The gate's posts stand this far either side of the road's centre (scaled). */
export const LEARNING_GATE_HALF_SPAN = 0.36 * LEARNING_NODE_KIND_SCALE.checkpoint;
/** Posts and legs reach this far below the site's ground point (unscaled). */
export const LEARNING_NODE_POST_SINK = 0.3;
/**
 * The pad the avatar lands on under the gate, beside the pennant or in front of
 * the board: the lesson stone itself, the same size (the route's node radius),
 * so "you can stand here" is one thing everywhere on the island (V5 R59). The
 * owner rejected the smaller, differently coloured pads of R58-01.
 */
export const LEARNING_PAD_RADIUS = 0.62;
/** How far behind its pad (away from the road) the object stands, in world units. */
export const LEARNING_OBJECT_OFFSET: Readonly<Record<"challenge" | "personal", number>> = {
  challenge: 0.66,
  personal: 0.74,
};

/**
 * Triangle ceilings the technique lock asserts; the pennant's cloth counts with
 * its pole, the gate's rope and streamers with its posts.
 */
export const LEARNING_NODE_TRIANGLES: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 160,
  challenge: 36,
  personal: 60,
};
export const LEARNING_STONE_TRIANGLES = 18;
/** Columns in the pennant's cloth strip; the wind bends it along these. */
export const PENNANT_COLUMNS = 4;

/** Foot positions in the object's local frame; +z faces the road. */
export const LEARNING_NODE_FEET: Readonly<Record<MapLearningKind, readonly [number, number][]>> = {
  checkpoint: [
    [-0.36, 0],
    [0.36, 0],
  ],
  challenge: [[0, 0]],
  personal: [
    [-0.22, 0],
    [0.22, 0],
  ],
};

class Builder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];
  private readonly colour = new THREE.Color();

  /** One flat-shaded quad (two triangles). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, colour: number) {
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    this.colour.setHex(colour);
    const base = this.positions.length / 3;
    for (const v of [a, b, c, d]) {
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(this.colour.r, this.colour.g, this.colour.b);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, colour: number) {
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    this.colour.setHex(colour);
    const base = this.positions.length / 3;
    for (const v of [a, b, c]) {
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(this.colour.r, this.colour.g, this.colour.b);
    }
    this.indices.push(base, base + 1, base + 2);
  }

  /** A box between two heights, with an optional forward tilt about local x. */
  box(
    frame: Frame,
    cx: number,
    cz: number,
    bottom: number,
    top: number,
    sx: number,
    sz: number,
    colour: number,
    tilt = 0,
  ) {
    const hx = sx / 2;
    const hz = sz / 2;
    const mid = (bottom + top) / 2;
    const corner = (x: number, y: number, z: number) => {
      // Tilt leans the top back (away from the road) around the box's middle.
      const dy = y - mid;
      const lz = z + Math.sin(tilt) * dy;
      const ly = mid + Math.cos(tilt) * dy;
      return frame.world(cx + x, ly, cz + lz);
    };
    const p = [
      corner(-hx, bottom, -hz),
      corner(hx, bottom, -hz),
      corner(hx, bottom, hz),
      corner(-hx, bottom, hz),
      corner(-hx, top, -hz),
      corner(hx, top, -hz),
      corner(hx, top, hz),
      corner(-hx, top, hz),
    ] as const;
    this.quad(p[4], p[7], p[6], p[5], colour); // top
    this.quad(p[0], p[1], p[2], p[3], colour); // bottom
    this.quad(p[3], p[2], p[6], p[7], colour); // front (+z)
    this.quad(p[1], p[0], p[4], p[5], colour); // back
    this.quad(p[0], p[3], p[7], p[4], colour); // left
    this.quad(p[2], p[1], p[5], p[6], colour); // right
  }

  /** An n-sided upright prism, sides only unless a cap is asked for. */
  prism(
    frame: Frame,
    cx: number,
    cz: number,
    bottom: number,
    top: number,
    radius: number,
    sides: number,
    colour: number,
    cap: boolean,
    turn = 0,
  ) {
    const ring = (y: number) =>
      Array.from({ length: sides }, (_, i) => {
        const a = turn + (i / sides) * Math.PI * 2;
        return frame.world(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
      });
    const low = ring(bottom);
    const high = ring(top);
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      this.quad(low[j]!, low[i]!, high[i]!, high[j]!, colour);
    }
    if (cap) {
      const centre = frame.world(cx, top, cz);
      for (let i = 0; i < sides; i += 1) this.tri(centre, high[(i + 1) % sides]!, high[i]!, colour);
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (!this.indices.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** An object's own frame, scaled; the scene turns and places it. */
class Frame {
  constructor(
    private readonly origin: THREE.Vector3 = new THREE.Vector3(),
    private readonly scale = 1,
    private readonly yaw = 0,
  ) {}
  world(x: number, y: number, z: number) {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const sx = x * this.scale;
    const sz = z * this.scale;
    return new THREE.Vector3(
      this.origin.x + sx * cos + sz * sin,
      this.origin.y + y * this.scale,
      this.origin.z - sx * sin + sz * cos,
    );
  }
}

function addGate(builder: Builder, frame: Frame) {
  const c = GRID_LEARNING_NODE_ALBEDO;
  // One colour family, posts included: brown posts vanished against the road
  // and the Π read as a single red stub. Tall enough that the avatar walking
  // the road passes under the lintel.
  LEARNING_NODE_FEET.checkpoint.forEach(([x, z]) =>
    builder.box(frame, x, z, -LEARNING_NODE_POST_SINK, 1.05, 0.13, 0.13, c.lintel),
  );
  builder.box(frame, 0, 0, 1.04, 1.15, 1.12, 0.15, c.gateCap);
  builder.box(frame, 0, 0, 0.8, 0.87, 0.72, 0.09, c.lintel);
  // A straw rope sagging between the posts under the lintel; what hangs from it
  // moves in the wind and is its own geometry (`learningGateStreamerGeometry`).
  const links = 6;
  for (let i = 0; i < links; i += 1) {
    const x0 = -ROPE_HALF + (2 * ROPE_HALF * i) / links;
    const x1 = -ROPE_HALF + (2 * ROPE_HALF * (i + 1)) / links;
    const mid = (x0 + x1) / 2;
    const y = ropeY(mid);
    builder.box(frame, mid, 0, y - 0.028, y + 0.028, x1 - x0 + 0.012, 0.05, c.rope);
  }
}

/** The rope's half length and height (unscaled): post to post, just under the lintel. */
const ROPE_HALF = 0.3;
function ropeY(x: number): number {
  return 0.74 - 0.045 * (1 - (x / ROPE_HALF) ** 2);
}

/**
 * What hangs from the gate (R59-04): two zig-zag paper streamers from the
 * rope and two amber ribbons from under the cap's ends, each a strip of
 * `STREAMER_ROWS` quads, double-sided. `hang` is each vertex's share of its
 * streamer's length from the top (0 at the knot), `phase` its streamer's
 * offset in the wind: `flutterGateStreamers` needs both.
 */
const STREAMER_ROWS = 4;
// The middle stays clear: the avatar stands on the pad under the gate.
const STREAMERS = [
  { x: -0.23, top: ropeY(-0.23) - 0.02, length: 0.36, width: 0.1, zig: 0.03, colour: "streamer" },
  { x: 0.23, top: ropeY(0.23) - 0.02, length: 0.36, width: 0.1, zig: 0.03, colour: "streamer" },
  { x: -0.54, top: 1.03, length: 0.5, width: 0.07, zig: 0, colour: "ribbon" },
  { x: 0.54, top: 1.03, length: 0.5, width: 0.07, zig: 0, colour: "ribbon" },
] as const;

export interface GateStreamers {
  readonly geometry: THREE.BufferGeometry;
  readonly rest: Float32Array;
  readonly hang: Float32Array;
  readonly phase: Float32Array;
}

export function learningGateStreamerGeometry(): GateStreamers {
  const scale = LEARNING_NODE_KIND_SCALE.checkpoint;
  const positions: number[] = [];
  const colours: number[] = [];
  const hang: number[] = [];
  const phase: number[] = [];
  const indices: number[] = [];
  const colour = new THREE.Color();
  STREAMERS.forEach((streamer, index) => {
    colour.setHex(GRID_LEARNING_NODE_ALBEDO[streamer.colour]);
    const base = positions.length / 3;
    for (let row = 0; row <= STREAMER_ROWS; row += 1) {
      const k = row / STREAMER_ROWS;
      // Paper streamers step left and right as they fall; ribbons hang straight.
      const shift = streamer.zig * (row % 2 === 0 ? -1 : 1) * Math.min(1, row);
      const y = streamer.top - streamer.length * k;
      const narrow = streamer.width * (1 - k * 0.25);
      for (const side of [-1, 1]) {
        positions.push((streamer.x + shift + (side * narrow) / 2) * scale, y * scale, 0);
        colours.push(colour.r, colour.g, colour.b);
        hang.push(k);
        phase.push(index * 1.9);
      }
    }
    for (let row = 0; row < STREAMER_ROWS; row += 1) {
      const a = base + row * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return {
    geometry,
    rest: Float32Array.from(positions),
    hang: Float32Array.from(hang),
    phase: Float32Array.from(phase),
  };
}

/** Swing the gate's streamers: a gust through the gate, growing toward each free end. */
export function flutterGateStreamers(streamers: GateStreamers, seconds: number): void {
  const position = streamers.geometry.getAttribute("position") as THREE.BufferAttribute;
  const scale = LEARNING_NODE_KIND_SCALE.checkpoint;
  for (let i = 0; i < position.count; i += 1) {
    const k = streamers.hang[i]!;
    const p = streamers.phase[i]!;
    const swing = Math.sin(seconds * 2.6 + p - k * 2.2) * 0.1 * k * scale;
    const sway = Math.sin(seconds * 1.7 + p * 0.7) * 0.025 * k * scale;
    position.setZ(i, streamers.rest[i * 3 + 2]! + swing);
    position.setX(i, streamers.rest[i * 3]! + sway);
    position.setY(i, streamers.rest[i * 3 + 1]! + Math.abs(swing) * 0.2 * k);
  }
  position.needsUpdate = true;
}

function addFlag(builder: Builder, frame: Frame) {
  const c = GRID_LEARNING_NODE_ALBEDO;
  builder.prism(frame, 0, 0, -LEARNING_NODE_POST_SINK, 0.05, 0.13, 6, c.stone, true, Math.PI / 6);
  builder.prism(frame, 0, 0, 0.05, 1.32, 0.028, 4, c.wood, false, Math.PI / 4);
  // The cloth is its own geometry (`learningPennantGeometry`): the wind moves it.
}

/** Where the pennant hangs on its pole, unscaled: from the pole to the tip. */
const PENNANT = { from: 0.03, to: 0.64, top: 1.3, low: 0.86, tip: 1.08 } as const;

/**
 * The pennant's cloth: one strip of columns off the pole, drawn double-sided so
 * it has no thickness to fold wrongly when it bends. `PENNANT_COLUMNS` quads,
 * the last one closing to the tip. Local x runs from the pole to the tip.
 */
export function learningPennantGeometry(): THREE.BufferGeometry {
  const scale = LEARNING_NODE_KIND_SCALE.challenge;
  const colour = new THREE.Color(GRID_LEARNING_NODE_ALBEDO.cloth);
  const positions: number[] = [];
  const colours: number[] = [];
  for (let i = 0; i <= PENNANT_COLUMNS; i += 1) {
    const k = i / PENNANT_COLUMNS;
    const x = PENNANT.from + (PENNANT.to - PENNANT.from) * k;
    const top = PENNANT.top + (PENNANT.tip - PENNANT.top) * k;
    const low = PENNANT.low + (PENNANT.tip - PENNANT.low) * k;
    positions.push(x * scale, top * scale, 0, x * scale, low * scale, 0);
    colours.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
  }
  const indices: number[] = [];
  for (let i = 0; i < PENNANT_COLUMNS; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3);
    if (i < PENNANT_COLUMNS - 1) indices.push(a, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Bend the pennant in the wind: a travelling wave that grows toward the tip,
 * so the edge at the pole never leaves it. Writes into the geometry in place;
 * `rest` is the untouched copy of its positions.
 */
export function flutterPennant(
  geometry: THREE.BufferGeometry,
  rest: Float32Array,
  seconds: number,
): void {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const scale = LEARNING_NODE_KIND_SCALE.challenge;
  const span = (PENNANT.to - PENNANT.from) * scale;
  for (let i = 0; i < position.count; i += 1) {
    const x = rest[i * 3]!;
    const along = Math.max(0, (x - PENNANT.from * scale) / span);
    const wave = Math.sin(seconds * 3.4 - along * 4.2);
    position.setZ(i, rest[i * 3 + 2]! + wave * 0.16 * along);
    position.setY(i, rest[i * 3 + 1]! - Math.abs(wave) * 0.03 * along);
  }
  position.needsUpdate = true;
}

function addBoard(builder: Builder, frame: Frame) {
  const c = GRID_LEARNING_NODE_ALBEDO;
  LEARNING_NODE_FEET.personal.forEach(([x, z]) =>
    builder.box(frame, x, z, -LEARNING_NODE_POST_SINK, 0.84, 0.06, 0.06, c.wood),
  );
  builder.box(frame, 0, 0.04, 0.42, 0.82, 0.6, 0.045, c.paper, -0.2);
  builder.box(frame, 0, 0.02, 0.83, 0.9, 0.68, 0.1, c.lintel);
  builder.box(frame, 0.17, 0.08, 0.68, 0.76, 0.08, 0.02, c.cloth, -0.2);
}

function addStone(builder: Builder, stone: THREE.Vector3, index: number) {
  const radius = 0.16 + ((index * 37) % 5) * 0.01;
  const frame = new Frame(stone, 1, (index * 1.7) % (Math.PI * 2));
  builder.prism(frame, 0, 0, -0.03, 0.025, radius, 6, GRID_LEARNING_NODE_ALBEDO.stone, true);
}

const ADD: Readonly<Record<MapLearningKind, (builder: Builder, frame: Frame) => void>> = {
  checkpoint: addGate,
  challenge: addFlag,
  personal: addBoard,
};

/** One kind's object in its own frame, origin on the ground, front toward +z. */
export function learningNodeKindGeometry(kind: MapLearningKind): THREE.BufferGeometry {
  const builder = new Builder();
  ADD[kind](builder, new Frame(new THREE.Vector3(), LEARNING_NODE_KIND_SCALE[kind]));
  return builder.geometry()!;
}

/** Every stepping stone of the drawn nodes, merged in blueprint space. */
export function buildLearningStoneGeometry(
  sites: readonly LearningSite[],
): THREE.BufferGeometry | null {
  const builder = new Builder();
  let index = 0;
  for (const site of sites) {
    if (!site.resolved) continue;
    for (const stone of site.branch) addStone(builder, stone, index++);
  }
  return builder.geometry();
}

export function learningNodeTriangles(kind: MapLearningKind): number {
  const geometry = learningNodeKindGeometry(kind);
  let count = geometry.getIndex()!.count / 3;
  geometry.dispose();
  if (kind === "challenge") {
    const cloth = learningPennantGeometry();
    count += cloth.getIndex()!.count / 3;
    cloth.dispose();
  }
  if (kind === "checkpoint") {
    const streamers = learningGateStreamerGeometry();
    count += streamers.geometry.getIndex()!.count / 3;
    streamers.geometry.dispose();
  }
  return count;
}
