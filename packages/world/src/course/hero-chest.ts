import * as THREE from "three";

import {
  disposeToy,
  inkMaterial,
  inked,
  paint,
  rbox,
  roundedStarGeometry,
} from "../craft/toy-craft.js";
import { CHEST_COLOURS } from "./chest-geometry.js";
import type { ChestTier } from "./chests-and-monsters.js";

/**
 * The close-up chest the learner opens after a lesson (V7 station 4).
 *
 * The map draws forty small chests (chest-geometry.ts); this is the one the
 * camera settles beside, so it carries the review chest's full craft: rounded
 * planks, an ink outline, a clear-coated paint, a lid that swings on its hinge,
 * a seam of light while it charges and a glowing inside once it opens. It is a
 * port of `makeChest` in docs/reference/player-journey/v7/lab/rewards3d.js,
 * whose look the Owner approved; one exists at a time, so its cost is not the
 * map's.
 *
 * Its origin is the centre of its footprint on the ground, front toward +z,
 * one unit wide, like the map chest it stands in for.
 */

export interface HeroChest {
  readonly group: THREE.Group;
  /** 0 shut, 1 open; the inside glows and the loot shows as it opens. */
  setOpen(open: number): void;
  /** 0–1: a band of light at the lid's seam while the chest charges. */
  setLeak(leak: number): void;
  /** Height of the open chest's rim, for where loot leaves from. */
  readonly rim: number;
  dispose(): void;
}

/** One close-up chest of a tier; `withLoot` shows coins and cards inside once open. */
export function buildHeroChest(tier: ChestTier, { withLoot = true } = {}): HeroChest {
  const c = CHEST_COLOURS[tier];
  const W = 1;
  const D = 0.66;
  const H = 0.47;
  const R = D / 2;
  const DOME = 0.86;
  const ink = inkMaterial(0.016);
  const root = new THREE.Group();
  root.name = `hero-chest-${tier}`;

  const body = paint(c.body, { rough: 0.42 });
  const lidPaint = paint(c.lid, { rough: 0.38 });
  const band = paint(c.band, { rough: 0.28, metal: 0.35 });
  const lock = paint(c.lock, { rough: 0.28, metal: 0.35 });
  const inner = paint(c.inner, { rough: 0.9 });
  const dark = paint(0x241a2c, { rough: 0.6 });

  const place = (object: THREE.Object3D, x: number, y: number, z: number) => {
    object.position.set(x, y, z);
    root.add(object);
    return object;
  };

  place(inked(rbox(W * 1.04, 0.07, D * 1.05, 0.03), band, ink), 0, 0.035, 0);
  const rowH = (H - 0.07) / 3;
  for (let row = 0; row < 2; row += 1) {
    const wobble = row % 2 ? 0.012 : -0.008;
    place(
      inked(rbox(W * 0.96 + wobble, rowH - 0.014, D * 0.95 + wobble * 0.5, 0.035), body, ink),
      0,
      0.07 + rowH * row + rowH / 2,
      0,
    );
  }
  const topY = 0.07 + rowH * 2 + rowH / 2;
  const wall = 0.08;
  for (const [w, d, x, z] of [
    [W * 0.97, wall, 0, (D * 0.955) / 2 - wall / 2],
    [W * 0.97, wall, 0, -(D * 0.955) / 2 + wall / 2],
    [wall, D * 0.955, (W * 0.97) / 2 - wall / 2, 0],
    [wall, D * 0.955, -(W * 0.97) / 2 + wall / 2, 0],
  ] as const)
    place(inked(rbox(w, rowH - 0.014, d, 0.03), body, ink), x, topY, z);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.82, D * 0.78), inner);
  floor.rotation.x = -Math.PI / 2;
  place(floor, 0, topY - rowH / 2 + 0.01, 0);
  const glowPaint = new THREE.MeshBasicMaterial({
    color: c.glow,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, D * 0.76), glowPaint);
  glow.rotation.x = -Math.PI / 2;
  place(glow, 0, topY - rowH / 2 + 0.02, 0);

  const loot = new THREE.Group();
  if (withLoot) {
    const coin = roundedStarGeometry(0.075, 0.036, 0.02, 0.01);
    const coinPaint = paint(0xffcf3a, { rough: 0.25, metal: 0.4, emissive: 0x7a4a00, glow: 0.3 });
    const card = rbox(0.13, 0.17, 0.012, 0.012, 2);
    const cardPaints = [0xffffff, 0xfff3c4, 0xe6f4ff].map((colour) =>
      paint(colour, { rough: 0.5 }),
    );
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let index = 0; index < 26; index += 1) {
      const piece =
        index % 4 === 3
          ? new THREE.Mesh(card, cardPaints[index % 3])
          : new THREE.Mesh(coin, coinPaint);
      piece.position.set(
        (random() - 0.5) * W * 0.7,
        topY - rowH / 2 + 0.05 + random() * 0.09,
        (random() - 0.5) * D * 0.6,
      );
      piece.rotation.set((random() - 0.5) * 1.2, random() * 3, (random() - 0.5) * 1.2);
      loot.add(piece);
    }
  }
  loot.visible = false;
  root.add(loot);

  for (const z of [(D * 0.95) / 2 + 0.002, -(D * 0.95) / 2 - 0.002])
    for (let row = 1; row < 3; row += 1)
      place(
        new THREE.Mesh(new THREE.BoxGeometry(W * 0.93, 0.012, 0.004), dark),
        0,
        0.07 + rowH * row,
        z,
      );

  const bandX = 0.3;
  const rivet = new THREE.SphereGeometry(0.022, 12, 8);
  const rivetPaint = paint(0xffffff, { rough: 0.3 });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      place(
        inked(rbox(0.13, H - 0.04, 0.035, 0.012), band, ink),
        sx * bandX,
        0.07 + (H - 0.07) / 2 - 0.005,
        sz * ((D * 0.955) / 2 + 0.012),
      );
      if (sz === 1)
        for (const y of [0.07 + (H - 0.07) * 0.28, 0.07 + (H - 0.07) * 0.74])
          place(new THREE.Mesh(rivet, rivetPaint), sx * bandX, y, (D * 0.955) / 2 + 0.034);
      place(
        inked(rbox(0.17, 0.15, 0.17, 0.04), band, ink),
        sx * (W / 2 - 0.05),
        0.085,
        sz * (D / 2 - 0.035),
      );
    }

  // The lid, hinged along the back top edge.
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2 + 0.01);
  root.add(hinge);
  const lid = new THREE.Group();
  lid.position.z = D / 2 - 0.01;
  hinge.add(lid);
  const dome = new THREE.CylinderGeometry(R * 0.98, R * 0.98, W * 0.97, 40, 1, false, 0, Math.PI);
  dome.rotateZ(Math.PI / 2);
  dome.scale(1, DOME, 1);
  const domeMesh = inked(dome, lidPaint, ink);
  domeMesh.position.y = 0.04;
  lid.add(domeMesh);
  const rim = inked(rbox(W, 0.075, D, 0.03), band, ink);
  rim.position.y = 0.035;
  lid.add(rim);
  const underPaint = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.inner).lerp(new THREE.Color(c.glow), 0.25),
    roughness: 0.8,
    emissive: c.glow,
    emissiveIntensity: 0,
  });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, D * 0.92), underPaint);
  under.rotation.x = Math.PI / 2;
  under.position.y = -0.008;
  lid.add(under);
  for (const sx of [-1, 1]) {
    const arc = new THREE.CylinderGeometry(
      R * 0.98 + 0.028,
      R * 0.98 + 0.028,
      0.13,
      40,
      1,
      false,
      0,
      Math.PI,
    );
    arc.rotateZ(Math.PI / 2);
    arc.scale(1, (R * 0.98 * DOME + 0.028) / (R * 0.98 + 0.028), 1);
    const strap = inked(arc, band, ink);
    strap.position.set(sx * bandX, 0.04, 0);
    lid.add(strap);
  }
  const hasp = new THREE.Shape();
  hasp.moveTo(-0.07, 0);
  hasp.lineTo(0.07, 0);
  hasp.lineTo(0.07, -0.1);
  hasp.quadraticCurveTo(0.07, -0.16, 0, -0.16);
  hasp.quadraticCurveTo(-0.07, -0.16, -0.07, -0.1);
  hasp.closePath();
  const haspGeometry = new THREE.ExtrudeGeometry(hasp, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  const haspMesh = inked(haspGeometry, lock, ink);
  haspMesh.position.set(0, 0.07, R + 0.015);
  lid.add(haspMesh);

  const plate = new THREE.Shape();
  plate.moveTo(-0.11, 0.1);
  plate.lineTo(0.11, 0.1);
  plate.lineTo(0.11, -0.06);
  plate.quadraticCurveTo(0.11, -0.16, 0, -0.16);
  plate.quadraticCurveTo(-0.11, -0.16, -0.11, -0.06);
  plate.closePath();
  place(
    inked(
      new THREE.ExtrudeGeometry(plate, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.014,
        bevelSize: 0.014,
        bevelSegments: 2,
      }),
      lock,
      ink,
    ),
    0,
    H - 0.13,
    (D * 0.955) / 2 + 0.01,
  );
  const emblemZ = (D * 0.955) / 2 + 0.07;
  if (c.emblem === "star") {
    place(
      inked(roundedStarGeometry(0.07, 0.034, 0.02, 0.008), paint(0xffffff, { rough: 0.25 }), ink),
      0,
      H - 0.14,
      emblemZ,
    );
  } else if (c.emblem === "gem") {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.05, 0),
      paint(0xff7ad9, { rough: 0.15, metal: 0.1, emissive: 0x8a1a6a, glow: 0.35 }),
    );
    gem.scale.set(0.9, 1.25, 0.6);
    place(gem, 0, H - 0.14, emblemZ - 0.005);
  } else {
    place(new THREE.Mesh(new THREE.CircleGeometry(0.028, 18), dark), 0, H - 0.12, emblemZ + 0.001);
    place(new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.06), dark), 0, H - 0.16, emblemZ + 0.001);
  }

  const leakPaint = new THREE.MeshBasicMaterial({
    color: c.glow,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  place(new THREE.Mesh(rbox(W * 1.02, 0.05, D * 1.02, 0.02, 2), leakPaint), 0, H + 0.005, 0);

  const setLeak = (k: number) => {
    leakPaint.opacity = Math.max(0, Math.min(1, k)) * 0.95;
  };
  const setOpen = (k: number) => {
    const open = Math.max(0, Math.min(1.2, k));
    if (open > 0.05) leakPaint.opacity = 0;
    hinge.rotation.x = -open * 1.95;
    glowPaint.opacity = Math.min(1, open) * 0.9;
    underPaint.emissiveIntensity = Math.min(1, open) * 0.55;
    loot.visible = withLoot && open > 0.15;
  };
  setOpen(0);

  return {
    group: root,
    setOpen,
    setLeak,
    rim: topY,
    dispose: () => disposeToy(root),
  };
}
