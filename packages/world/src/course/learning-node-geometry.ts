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

/** Objects are authored at a unit scale and drawn this much larger. */
export const LEARNING_NODE_SCALE = 1.6;
/** The gate's posts stand this far either side of the road's centre (scaled). */
export const LEARNING_GATE_HALF_SPAN = 0.36 * LEARNING_NODE_SCALE;
/** Posts and legs reach this far below the site's ground point (unscaled). */
export const LEARNING_NODE_POST_SINK = 0.3;

/** Triangle ceilings the technique lock asserts. */
export const LEARNING_NODE_TRIANGLES: Readonly<Record<MapLearningKind, number>> = {
  checkpoint: 48,
  challenge: 36,
  personal: 60,
};
export const LEARNING_STONE_TRIANGLES = 18;

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
    private readonly scale = LEARNING_NODE_SCALE,
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
}

function addFlag(builder: Builder, frame: Frame) {
  const c = GRID_LEARNING_NODE_ALBEDO;
  builder.prism(frame, 0, 0, -LEARNING_NODE_POST_SINK, 0.05, 0.13, 6, c.stone, true, Math.PI / 6);
  builder.prism(frame, 0, 0, 0.05, 1.32, 0.028, 4, c.wood, false, Math.PI / 4);
  // Pennant: a thin triangular slab off the top of the pole, seen side-on.
  const top = frame.world(0.02, 1.28, 0);
  const low = frame.world(0.02, 0.94, 0);
  const tip = frame.world(0.48, 1.11, 0);
  const t = 0.012;
  const back = (v: THREE.Vector3) => v.clone().add(frame.world(0, 0, -t).sub(frame.world(0, 0, 0)));
  const front = (v: THREE.Vector3) => v.clone().add(frame.world(0, 0, t).sub(frame.world(0, 0, 0)));
  builder.tri(front(top), front(low), front(tip), c.cloth);
  builder.tri(back(top), back(tip), back(low), c.cloth);
  builder.quad(back(top), front(top), front(tip), back(tip), c.cloth);
  builder.quad(front(low), back(low), back(tip), front(tip), c.cloth);
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
  ADD[kind](builder, new Frame());
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
  const count = geometry.getIndex()!.count / 3;
  geometry.dispose();
  return count;
}
