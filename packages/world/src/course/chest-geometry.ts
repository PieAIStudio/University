import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { ChestTier } from "./chests-and-monsters.js";

/**
 * The map's chest: a small, flat-shaded, vertex-coloured model of the V7
 * reward chest (docs/reference/player-journey/v7/lab/rewards3d.js, `makeChest`),
 * cut down for forty copies on one island. The close-up chest that opens after
 * a lesson is task 02's; this one only has to read as "a chest, this colour,
 * shut or open" at map distance.
 *
 * Two geometries per tier, because the lid swings: the body stands on the
 * ground with its front at +z, the lid is authored around its hinge (the body's
 * back top edge) so an open chest is the same lid under one extra rotation.
 * The body's top face is the dark inside, hidden under a shut lid.
 */

export interface ChestColours {
  readonly body: number;
  readonly lid: number;
  readonly band: number;
  readonly lock: number;
  readonly inner: number;
  readonly glow: number;
  readonly emblem: "keyhole" | "gem" | "star";
}

/** H1: the ordinary chest is wood, not the reference's green (the green ring already means "go"). */
export const CHEST_COLOURS: Readonly<Record<ChestTier, ChestColours>> = {
  wood: {
    body: 0x8c5a32,
    lid: 0x9a653a,
    band: 0xe2b64a,
    lock: 0xe2b64a,
    inner: 0x3a2213,
    glow: 0xffd27a,
    emblem: "keyhole",
  },
  rare: {
    body: 0x2f98f5,
    lid: 0x3aa6ff,
    band: 0xffdf5e,
    lock: 0xffdf5e,
    inner: 0x0c2f5c,
    glow: 0x9fd6ff,
    emblem: "keyhole",
  },
  epic: {
    body: 0xa04ff0,
    lid: 0xae5dfb,
    band: 0xffd24d,
    lock: 0xffd24d,
    inner: 0x2e0f52,
    glow: 0xe2b8ff,
    emblem: "gem",
  },
  legendary: {
    body: 0xffd23c,
    lid: 0xffdc52,
    band: 0xff5ea5,
    lock: 0xff5ea5,
    inner: 0x7a3a00,
    glow: 0xfff0a8,
    emblem: "star",
  },
};

/** The chest is authored one unit wide and drawn this wide, in blueprint units. */
export const CHEST_WIDTH = 0.8;
/** Local proportions, width 1. */
const W = 1;
const D = 0.66;
const H = 0.47;
const R = D / 2;
const DOME = 0.86;
const DOME_SEGMENTS = 8;
/** Hinge in the body's frame: the back top edge. */
export const CHEST_HINGE = new THREE.Vector3(0, H, -D / 2 + 0.01);
/** How far an open lid swings back, radians about the hinge. */
export const CHEST_OPEN_ANGLE = 1.95;
/** Top of a shut chest, local units; for glow and label placement. */
export const CHEST_HEIGHT = H + R * DOME + 0.04;

type Part = THREE.BufferGeometry;

function coloured(geometry: THREE.BufferGeometry, colour: number, top?: number): Part {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.deleteAttribute("uv");
  flat.computeVertexNormals();
  const normal = flat.getAttribute("normal") as THREE.BufferAttribute;
  const base = new THREE.Color(colour);
  const lid = top === undefined ? base : new THREE.Color(top);
  const colours = new Float32Array(normal.count * 3);
  for (let index = 0; index < normal.count; index += 1) {
    const c = normal.getY(index) > 0.9 ? lid : base;
    colours.set([c.r, c.g, c.b], index * 3);
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return flat;
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  colour: number,
  top?: number,
): Part {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return coloured(geometry, colour, top);
}

/** Half a barrel lying along x, its flat side down at y = 0, scaled flatter by DOME. */
function halfBarrel(radius: number, length: number, x: number, colour: number): Part {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    DOME_SEGMENTS,
    1,
    false,
    0,
    Math.PI,
  );
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(1, DOME, 1);
  geometry.translate(x, 0, 0);
  return coloured(geometry, colour);
}

function star(outer: number, inner: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index += 1) {
    const r = index % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (index / 10) * Math.PI * 2;
    if (index === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function darker(colour: number, amount: number): number {
  return new THREE.Color(colour).multiplyScalar(amount).getHex();
}

export interface ChestGeometry {
  readonly body: THREE.BufferGeometry;
  readonly lid: THREE.BufferGeometry;
}

/** Body and lid for one tier, both in the chest's one-unit frame. */
export function buildChestGeometry(tier: ChestTier): ChestGeometry {
  const c = CHEST_COLOURS[tier];
  const front = (D * 0.95) / 2;
  const bodyParts: Part[] = [
    box(W * 1.04, 0.07, D * 1.05, 0, 0.035, 0, c.band),
    box(W * 0.96, H - 0.07, D * 0.95, 0, 0.07 + (H - 0.07) / 2, 0, c.body, c.inner),
    // One darker seam at mid height reads as planks from the map.
    box(W * 0.97, 0.022, D * 0.962, 0, 0.07 + (H - 0.07) * 0.5, 0, darker(c.body, 0.62)),
    box(0.12, H - 0.05, D * 0.99, -0.3, 0.07 + (H - 0.07) / 2 - 0.01, 0, c.band),
    box(0.12, H - 0.05, D * 0.99, 0.3, 0.07 + (H - 0.07) / 2 - 0.01, 0, c.band),
    box(0.22, 0.2, 0.05, 0, H - 0.13, front + 0.02, c.lock),
  ];
  if (c.emblem === "keyhole") {
    bodyParts.push(box(0.05, 0.09, 0.02, 0, H - 0.14, front + 0.05, darker(c.inner, 0.8)));
  } else if (c.emblem === "gem") {
    const gem = new THREE.OctahedronGeometry(0.06, 0);
    gem.scale(0.9, 1.2, 0.55);
    gem.translate(0, H - 0.13, front + 0.06);
    bodyParts.push(coloured(gem, 0xff7ad9));
  } else {
    const emblem = star(0.075, 0.034, 0.02);
    emblem.translate(0, H - 0.13, front + 0.045);
    bodyParts.push(coloured(emblem, 0xffffff));
  }
  const body = mergeGeometries(bodyParts, false);
  for (const part of bodyParts) part.dispose();

  // The lid, around the hinge: its centre sits D/2 in front of the hinge line.
  const lidParts: Part[] = [
    halfBarrel(R * 0.98, W * 0.97, 0, c.lid),
    halfBarrel(R * 0.98 + 0.028, 0.13, -0.3, c.band),
    halfBarrel(R * 0.98 + 0.028, 0.13, 0.3, c.band),
    box(W, 0.075, D, 0, 0.0, 0, c.band),
    box(0.13, 0.12, 0.035, 0, 0.0, R + 0.02, c.lock),
  ];
  for (const part of lidParts) part.translate(0, 0.035, D / 2 - 0.01);
  const lid = mergeGeometries(lidParts, false);
  for (const part of lidParts) part.dispose();
  if (!body || !lid) throw new Error(`chest geometry for ${tier} did not merge`);
  body.computeBoundingSphere();
  lid.computeBoundingSphere();
  return { body, lid };
}

export function chestTriangles(geometry: ChestGeometry): number {
  const count = (g: THREE.BufferGeometry) =>
    (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  return count(geometry.body) + count(geometry.lid);
}

const UP = new THREE.Vector3(0, 1, 0);
const scratch = {
  turn: new THREE.Quaternion(),
  size: new THREE.Vector3(),
  hinge: new THREE.Matrix4(),
  swing: new THREE.Matrix4(),
};

/**
 * The chest's instance transform: ground point, heading, and the chest's own
 * scale (1, or smaller where it hangs at a stone's edge). Allocation-free, so
 * the hop can call it every frame.
 */
export function composeChestMatrix(
  position: THREE.Vector3,
  yaw: number,
  scale: number,
  target: THREE.Matrix4,
): THREE.Matrix4 {
  scratch.turn.setFromAxisAngle(UP, yaw);
  scratch.size.setScalar(CHEST_WIDTH * scale);
  return target.compose(position, scratch.turn, scratch.size);
}

/** The lid's transform for a chest matrix, shut (0) to fully open (1). */
export function composeLidMatrix(
  chest: THREE.Matrix4,
  open: number,
  target: THREE.Matrix4,
): THREE.Matrix4 {
  scratch.hinge.makeTranslation(CHEST_HINGE.x, CHEST_HINGE.y, CHEST_HINGE.z);
  scratch.swing.makeRotationX(-CHEST_OPEN_ANGLE * open);
  return target.copy(chest).multiply(scratch.hinge).multiply(scratch.swing);
}
