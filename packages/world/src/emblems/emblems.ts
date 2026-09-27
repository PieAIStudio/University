import * as THREE from "three";

import {
  disposeToy,
  extrude,
  inkMaterial,
  inked,
  paint,
  rbox,
  roundedStarShape,
  starShape,
} from "../craft/toy-craft.js";
import {
  BADGE_LOOKS,
  FAMILY_FACES,
  METALS,
  RANK_LOOKS,
  type BadgeFrame,
  type BadgeIcon,
} from "./emblem-looks.js";

/**
 * The rank emblems and the badge wall as 3D objects (V7 station 10), in the
 * chests' ink-and-clear-coat look. Each faces +z, centred on the origin, about
 * two units across. Ported from docs/reference/player-journey/v7/lab/badges3d.js.
 *
 * They are shown in DOM places (the avatar panel, the wall, the chest's reward
 * row, the completion card), so they are usually rendered once to an image
 * (emblem-images.ts); the promotion ceremony draws one live (EmblemCanvas.tsx).
 */

export interface Emblem {
  readonly group: THREE.Group;
  /** The rank's two wings, for the promotion ceremony to unfold; empty below gold. */
  readonly wings: readonly THREE.Object3D[];
  dispose(): void;
}

const INK = 0.02;

/** One ink material per thickness within a build, so each emblem compiles few programs. */
function inkCache() {
  const inks = new Map<number, THREE.Material>();
  return (thickness: number) => {
    let ink = inks.get(thickness);
    if (!ink) inks.set(thickness, (ink = inkMaterial(thickness)));
    return ink;
  };
}

/* ------------------------------------------------------------------ */
/* rank emblems                                                        */
/* ------------------------------------------------------------------ */

function bentRibbon(width: number, height: number, depth: number, bend: number, curl: number) {
  const geometry = rbox(width, height, depth, Math.min(height, depth) * 0.45, 3);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const u = position.getX(index) / (width / 2);
    position.setY(index, position.getY(index) - bend * u * u);
    position.setZ(index, position.getZ(index) - curl * u * u);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function featherShape(length: number, width: number) {
  const shape = new THREE.Shape();
  const r = width / 2;
  shape.moveTo(0, -r * 0.7);
  shape.lineTo(length - r, -r);
  shape.absarc(length - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, r * 0.7);
  shape.closePath();
  return shape;
}

const FEATHERS = [
  { length: 1.08, angle: 0.62, width: 0.3 },
  { length: 1.0, angle: 0.28, width: 0.3 },
  { length: 0.86, angle: -0.06, width: 0.28 },
  { length: 0.68, angle: -0.4, width: 0.26 },
] as const;

function crownShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, -0.12);
  shape.lineTo(0.34, -0.12);
  shape.lineTo(0.38, 0.2);
  shape.lineTo(0.2, 0.06);
  shape.lineTo(0, 0.3);
  shape.lineTo(-0.2, 0.06);
  shape.lineTo(-0.38, 0.2);
  shape.closePath();
  return shape;
}

export function buildRankEmblem(tierId: string): Emblem {
  const look = RANK_LOOKS[tierId] ?? RANK_LOOKS.stone!;
  const ink = inkCache();
  const root = new THREE.Group();
  root.name = `rank-${tierId}`;
  const metal = { rough: 0.3, metal: 0.25 };
  const wings: THREE.Object3D[] = [];

  if (look.wings !== undefined) {
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      FEATHERS.forEach((feather, index) => {
        const tone = new THREE.Color(look.wings).multiplyScalar(1 - index * 0.05);
        const plume = inked(
          extrude(featherShape(feather.length, feather.width), 0.05, 0.018, 2),
          paint(tone, { rough: 0.45 }),
          ink(INK),
        );
        plume.rotation.z = feather.angle;
        plume.position.z = -index * 0.035;
        wing.add(plume);
      });
      wing.scale.x = side;
      wing.position.set(side * 0.58, 0.12, -0.1);
      wing.rotation.y = side * -0.22;
      root.add(wing);
      wings.push(wing);
    }
  }

  root.add(
    inked(
      extrude(roundedStarShape(1.0, 0.86, 16, Math.PI / 2, 0.55), 0.14, 0.04, 3),
      paint(look.burst, metal),
      ink(INK),
    ),
  );
  const ring = inked(new THREE.TorusGeometry(0.7, 0.07, 14, 60), paint(look.ring, metal), ink(INK));
  ring.position.z = 0.11;
  root.add(ring);
  const faceGeometry = new THREE.CylinderGeometry(0.66, 0.66, 0.12, 60);
  faceGeometry.rotateX(Math.PI / 2);
  const face = inked(faceGeometry, paint(look.face, { rough: 0.35, metal: 0.15 }), null);
  face.position.z = 0.08;
  root.add(face);

  const crystal = inked(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, -0.5),
        new THREE.Vector2(0.27, -0.14),
        new THREE.Vector2(0.27, 0.16),
        new THREE.Vector2(0, 0.56),
      ],
      6,
    ),
    new THREE.MeshPhysicalMaterial({
      color: look.gem,
      roughness: 0.12,
      metalness: 0.05,
      flatShading: true,
      clearcoat: 1,
      emissive: look.glow ?? look.gem,
      emissiveIntensity: look.glow !== undefined ? 0.5 : 0.12,
    }),
    ink(0.014),
  );
  crystal.scale.set(1, 1, 0.55);
  crystal.position.z = 0.22;
  root.add(crystal);

  if (look.crown !== undefined) {
    const crown = inked(
      extrude(crownShape(), 0.1, 0.03, 2),
      paint(look.crown, { rough: 0.25, metal: 0.4 }),
      ink(INK),
    );
    crown.position.set(0, 1.08, 0.02);
    root.add(crown);
    const jewel = new THREE.SphereGeometry(0.055, 16, 10);
    const jewelPaint = paint(0xff5ec8, { rough: 0.15, emissive: 0xff2aa0, glow: 0.3 });
    for (const [x, y] of [
      [-0.38, 0.2],
      [0, 0.3],
      [0.38, 0.2],
    ] as const) {
      const mesh = new THREE.Mesh(jewel, jewelPaint);
      mesh.position.set(x, 1.08 + y, 0.08);
      root.add(mesh);
    }
  }

  const band = inked(
    bentRibbon(1.76, 0.36, 0.07, 0.1, 0.22),
    paint(look.ribbon, { rough: 0.45 }),
    ink(INK),
  );
  band.position.set(0, -0.72, 0.3);
  root.add(band);
  const tail = new THREE.Shape();
  tail.moveTo(0, 0.13);
  tail.lineTo(0.38, 0.13);
  tail.lineTo(0.3, 0);
  tail.lineTo(0.38, -0.13);
  tail.lineTo(0, -0.13);
  tail.closePath();
  const tailGeometry = extrude(tail, 0.05, 0.012, 2);
  const tailPaint = paint(new THREE.Color(look.ribbon).multiplyScalar(0.72), { rough: 0.5 });
  for (const side of [-1, 1]) {
    const piece = inked(tailGeometry, tailPaint, ink(INK));
    piece.scale.x = side;
    piece.position.set(side * 0.82, -0.86, 0.05);
    root.add(piece);
  }

  const star = extrude(roundedStarShape(0.078, 0.037, 5, Math.PI / 2, 0.35), 0.03, 0.012, 2);
  const lit = paint(0xffe14a, { rough: 0.3, emissive: 0x806000, glow: 0.25 });
  const unlit = paint(0x2b2350, { rough: 0.3 });
  for (let index = 0; index < 5; index += 1) {
    const u = index / 4 - 0.5;
    const mesh = inked(star, index < look.stars ? lit : unlit, ink(0.01));
    mesh.position.set(u * 0.95, -0.7 - 0.07 * (u * 2) ** 2, 0.37 - 0.08 * (u * 2) ** 2);
    root.add(mesh);
  }

  return { group: root, wings, dispose: () => disposeToy(root) };
}

/* ------------------------------------------------------------------ */
/* badges                                                              */
/* ------------------------------------------------------------------ */

function shieldShape(s: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.72 * s, 0.78 * s);
  shape.quadraticCurveTo(0, 0.95 * s, 0.72 * s, 0.78 * s);
  shape.quadraticCurveTo(0.8 * s, 0.1 * s, 0.62 * s, -0.35 * s);
  shape.quadraticCurveTo(0.35 * s, -0.85 * s, 0, -1.02 * s);
  shape.quadraticCurveTo(-0.35 * s, -0.85 * s, -0.62 * s, -0.35 * s);
  shape.quadraticCurveTo(-0.8 * s, 0.1 * s, -0.72 * s, 0.78 * s);
  return shape;
}

function frameGeometry(frame: BadgeFrame, scale: number): THREE.BufferGeometry {
  switch (frame) {
    case "shield":
      return extrude(shieldShape(scale), 0.14, 0.045, 3);
    case "hex": {
      const r = 0.95 * scale;
      return extrude(
        roundedStarShape(r, r * Math.cos(Math.PI / 6), 6, Math.PI / 2, 0.3),
        0.14,
        0.045,
        3,
      );
    }
    case "crest":
      return extrude(
        roundedStarShape(0.98 * scale, 0.84 * scale, 10, Math.PI / 2, 0.9),
        0.14,
        0.045,
        3,
      );
    case "star":
      return extrude(
        roundedStarShape(1.08 * scale, 0.6 * scale, 5, Math.PI / 2, 0.42),
        0.14,
        0.045,
        3,
      );
    case "coin": {
      const coin = new THREE.CylinderGeometry(0.86 * scale, 0.86 * scale, 0.18, 64);
      coin.rotateX(Math.PI / 2);
      return coin;
    }
  }
}

function bar(x: number, y: number, w: number, h: number, r = 0.035) {
  const shape = new THREE.Shape();
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  return shape;
}

/** Block digits on a 0.3 × 0.5 cell: the shapes need no font download. */
function digitShapes(digit: string, x: number): THREE.Shape[] {
  const t = 0.09;
  const W = 0.3;
  const H = 0.5;
  const top = [x, H - t, W, t] as const;
  const middle = [x, H / 2 - t / 2, W, t] as const;
  const bottom = [x, 0, W, t] as const;
  const leftUp = [x, H / 2, t, H / 2] as const;
  const leftDown = [x, 0, t, H / 2] as const;
  const rightUp = [x + W - t, H / 2, t, H / 2] as const;
  const rightDown = [x + W - t, 0, t, H / 2] as const;
  const strokes: Record<string, readonly (readonly [number, number, number, number])[]> = {
    "0": [top, bottom, leftUp, leftDown, rightUp, rightDown],
    "1": [
      [x + W / 2 - t / 2, 0, t, H],
      [x + W / 2 - t * 1.6, H - t, t * 1.2, t],
    ],
    "3": [top, middle, bottom, rightUp, rightDown],
    "5": [top, leftUp, middle, rightDown, bottom],
    "7": [top, [x + W - t, 0, t, H]],
  };
  return (strokes[digit] ?? []).map(([bx, by, bw, bh]) => bar(bx, by, bw, bh));
}

function numberShapes(text: string, advance = 0.36): THREE.Shape[] {
  const width = text.length * advance - (advance - 0.3);
  return [...text].flatMap((digit, index) => digitShapes(digit, index * advance - width / 2));
}

function shifted(shape: THREE.Shape, dx: number, dy: number) {
  const { shape: outline } = shape.extractPoints(12);
  return new THREE.Shape(outline.map((point) => new THREE.Vector2(point.x + dx, point.y + dy)));
}

function iconShapes(icon: BadgeIcon): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  const path = (points: readonly (readonly [number, number])[]) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    return shape;
  };
  switch (icon) {
    case "flag": {
      shapes.push(bar(-0.26, -0.42, 0.07, 0.84));
      const flag = new THREE.Shape();
      flag.moveTo(-0.2, 0.4);
      flag.quadraticCurveTo(0.05, 0.5, 0.32, 0.33);
      flag.lineTo(0.3, 0.02);
      flag.quadraticCurveTo(0.05, 0.16, -0.2, 0.06);
      flag.closePath();
      shapes.push(flag);
      break;
    }
    case "flame": {
      const flame = new THREE.Shape();
      flame.moveTo(0, -0.4);
      flame.bezierCurveTo(0.34, -0.4, 0.4, -0.05, 0.22, 0.14);
      flame.bezierCurveTo(0.2, 0, 0.12, -0.02, 0.1, 0.04);
      flame.bezierCurveTo(0.2, 0.25, 0.08, 0.42, -0.04, 0.5);
      flame.bezierCurveTo(0, 0.3, -0.12, 0.2, -0.2, 0.1);
      flame.bezierCurveTo(-0.34, -0.05, -0.34, -0.4, 0, -0.4);
      shapes.push(flame);
      break;
    }
    case "loop": {
      const arc = new THREE.Shape();
      arc.absarc(0, 0, 0.36, Math.PI * 0.15, Math.PI * 1.75, false);
      arc.absarc(0, 0, 0.22, Math.PI * 1.75, Math.PI * 0.15, true);
      arc.closePath();
      shapes.push(arc);
      const cx = Math.cos(Math.PI * 0.15) * 0.29;
      const cy = Math.sin(Math.PI * 0.15) * 0.29;
      shapes.push(
        path([
          [cx - 0.17, cy + 0.02],
          [cx + 0.17, cy + 0.02],
          [cx + 0.02, cy + 0.2],
        ]),
      );
      break;
    }
    case "cards":
      shapes.push(bar(-0.3, -0.34, 0.4, 0.56, 0.06), bar(-0.08, -0.2, 0.4, 0.56, 0.06));
      break;
    case "check":
      shapes.push(
        path([
          [-0.34, 0.02],
          [-0.2, -0.12],
          [-0.08, 0],
          [0.26, 0.34],
          [0.38, 0.2],
          [-0.08, -0.28],
        ]),
      );
      break;
    case "bubble": {
      const bubble = new THREE.Shape();
      bubble.moveTo(-0.36, 0.3);
      bubble.quadraticCurveTo(-0.36, 0.42, -0.24, 0.42);
      bubble.lineTo(0.24, 0.42);
      bubble.quadraticCurveTo(0.36, 0.42, 0.36, 0.3);
      bubble.lineTo(0.36, -0.06);
      bubble.quadraticCurveTo(0.36, -0.18, 0.24, -0.18);
      bubble.lineTo(-0.04, -0.18);
      bubble.lineTo(-0.2, -0.36);
      bubble.lineTo(-0.18, -0.18);
      bubble.lineTo(-0.24, -0.18);
      bubble.quadraticCurveTo(-0.36, -0.18, -0.36, -0.06);
      bubble.closePath();
      shapes.push(bubble);
      break;
    }
    case "island":
    case "island3": {
      const count = icon === "island3" ? 3 : 1;
      for (let index = 0; index < count; index += 1) {
        const ox = count === 1 ? 0 : (index - 1) * 0.3;
        const oy = count === 1 ? 0 : index === 1 ? 0.2 : -0.02;
        const k = count === 1 ? 1 : 0.6;
        const isle = new THREE.Shape();
        isle.moveTo(ox - 0.36 * k, oy - 0.12 * k);
        isle.quadraticCurveTo(ox, oy + 0.22 * k, ox + 0.36 * k, oy - 0.12 * k);
        isle.quadraticCurveTo(ox + 0.1 * k, oy - 0.42 * k, ox, oy - 0.44 * k);
        isle.quadraticCurveTo(ox - 0.1 * k, oy - 0.42 * k, ox - 0.36 * k, oy - 0.12 * k);
        shapes.push(isle);
        if (count > 1) continue;
        shapes.push(
          bar(ox - 0.02, oy + 0.04, 0.05, 0.4, 0.02),
          path([
            [ox + 0.03, oy + 0.42],
            [ox + 0.26, oy + 0.33],
            [ox + 0.03, oy + 0.24],
          ]),
        );
      }
      break;
    }
    case "fork":
      shapes.push(
        bar(-0.045, -0.42, 0.09, 0.42),
        path([
          [-0.045, -0.02],
          [0.045, -0.02],
          [-0.22, 0.26],
          [-0.3, 0.2],
        ]),
        path([
          [-0.045, -0.02],
          [0.045, -0.02],
          [0.3, 0.2],
          [0.22, 0.26],
        ]),
        shifted(starShape(0.1, 0.045, 5), -0.3, 0.34),
        shifted(starShape(0.1, 0.045, 5), 0.3, 0.34),
      );
      break;
    case "star":
      shapes.push(roundedStarShape(0.42, 0.2, 5, Math.PI / 2, 0.3));
      break;
    case "pennant":
      shapes.push(
        bar(-0.3, -0.42, 0.07, 0.84),
        path([
          [-0.24, 0.4],
          [0.36, 0.22],
          [-0.24, 0.02],
        ]),
      );
      break;
    case "up":
      for (const oy of [-0.2, 0.08])
        shapes.push(
          path([
            [-0.32, oy],
            [0, oy + 0.28],
            [0.32, oy],
            [0.32, oy - 0.12],
            [0, oy + 0.16],
            [-0.32, oy - 0.12],
          ]),
        );
      break;
    case "n10":
    case "n50":
    case "n100":
      for (const shape of numberShapes(icon.slice(1))) shapes.push(shifted(shape, 0, -0.25));
      break;
  }
  return shapes;
}

/** A locked badge is the same emblem in grey: its rule is shown beside it, never hidden. */
export function buildBadgeEmblem(badgeId: string, { locked = false } = {}): Emblem {
  const look = BADGE_LOOKS[badgeId] ?? BADGE_LOOKS["first-lesson"]!;
  const metal = METALS[look.metal];
  const face = FAMILY_FACES[look.family];
  const tone = (colour: number, k = 1) =>
    new THREE.Color(locked ? 0xa7acb5 : colour).multiplyScalar(k);
  const ink = inkCache();
  const root = new THREE.Group();
  root.name = `badge-${badgeId}`;

  if (look.frame === "coin") {
    // The coin medals hang from a ribbon.
    const strip = new THREE.Shape();
    strip.moveTo(-0.13, 0);
    strip.lineTo(0.13, 0);
    strip.lineTo(0.13, -0.62);
    strip.lineTo(0, -0.5);
    strip.lineTo(-0.13, -0.62);
    strip.closePath();
    const stripGeometry = extrude(strip, 0.04, 0.01, 2);
    const stripPaint = paint(tone(face, 0.85), { rough: 0.5 });
    for (const side of [-1, 1]) {
      const ribbon = inked(stripGeometry, stripPaint, ink(INK));
      ribbon.position.set(side * 0.3, -0.45, -0.1);
      ribbon.rotation.z = side * 0.28;
      root.add(ribbon);
    }
  }
  const rimPaint = locked
    ? paint(0xb9bdc5, { rough: 0.5 })
    : new THREE.MeshPhysicalMaterial({
        color: metal.rim,
        roughness: 0.28,
        metalness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        iridescence: metal.iridescent ? 1 : 0,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [200, 700],
      });
  root.add(inked(frameGeometry(look.frame, 1), rimPaint, ink(INK)));
  const innerGeometry = frameGeometry(look.frame, 0.8);
  innerGeometry.scale(1, 1, 0.9);
  const inner = inked(innerGeometry, paint(tone(face), { rough: 0.4 }), ink(0.012));
  inner.position.z = 0.07;
  root.add(inner);

  const white = paint(locked ? 0xe3e5ea : 0xffffff, { rough: 0.3 });
  const shapes = iconShapes(look.icon);
  if (shapes.length > 0) {
    const icon = inked(extrude(shapes, 0.06, 0.018, 2), white, ink(0.014));
    icon.position.z = 0.2;
    const k = look.plate ? 0.72 : look.frame === "star" ? 0.78 : 0.95;
    icon.scale.set(k, k, 1);
    if (look.plate) icon.position.y = 0.14;
    root.add(icon);
  }
  if (look.plate) {
    const plate = inked(
      rbox(0.26 + look.plate.length * 0.3, 0.42, 0.08, 0.12),
      paint(tone(metal.rimDark), { rough: 0.35, metal: 0.2 }),
      ink(0.012),
    );
    plate.position.set(0, -0.42, 0.2);
    root.add(plate);
    const digits = inked(extrude(numberShapes(look.plate), 0.04, 0.012, 2), white, ink(0.01));
    digits.scale.set(0.62, 0.62, 1);
    digits.position.set(0, -0.42 - 0.155, 0.26);
    root.add(digits);
  }
  return { group: root, wings: [], dispose: () => disposeToy(root) };
}
