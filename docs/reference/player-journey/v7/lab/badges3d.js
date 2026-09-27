// University badges: five rank emblems (the stone steps) and the badge wall.
// Same ink-and-clear-coat look as the chests. Faces +z, centred on the origin.
import * as THREE from "three";
import { inked, paint, rbox, roundedStarShape, starShape, extrude } from "./rewards3d.js";

const INK = 0.02;

/* ------------------------------------------------------------------ */
/* rank emblems — cut on long-term cards, as the product already does  */
/* ------------------------------------------------------------------ */

export const RANKS = [
  { id: "stone", name: "石阶", at: 0, burst: 0xa8adb6, ring: 0x6f7682, face: 0xd4d8de, gem: 0xeef2f6, ribbon: 0x7c8491, stars: 1 },
  { id: "bronze", name: "铜阶", at: 10, burst: 0xdb9152, ring: 0x9a5427, face: 0xf1b27a, gem: 0xffe0b8, ribbon: 0xb8672e, stars: 2 },
  { id: "silver", name: "银阶", at: 50, burst: 0xdfe7f2, ring: 0x7f95b5, face: 0xb9cbe6, gem: 0xf2f8ff, ribbon: 0x6f8fc0, stars: 3 },
  { id: "gold", name: "金阶", at: 150, burst: 0xffc93a, ring: 0xc9791a, face: 0xffb52e, gem: 0xfff4c2, ribbon: 0xf08a24, stars: 4, wings: 0xfff1d0 },
  { id: "obsidian", name: "黑曜阶", at: 400, burst: 0x4a2474, ring: 0xff5ec8, face: 0x7b3fc4, gem: 0xe8c8ff, ribbon: 0x6a2fb0, stars: 5, wings: 0xffd6f4, crown: 0xffc93a, glow: 0xc77dff },
];

function bentRibbon(width, height, depth, bend, curl) {
  const g = rbox(width, height, depth, Math.min(height, depth) * 0.45, 3);
  g.computeBoundingBox();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = x / (width / 2);
    pos.setY(i, pos.getY(i) - bend * u * u);
    pos.setZ(i, pos.getZ(i) - curl * u * u);
  }
  g.computeVertexNormals();
  return g;
}

function ribbonTail(color, side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.13);
  s.lineTo(0.38, 0.13);
  s.lineTo(0.3, 0.0);
  s.lineTo(0.38, -0.13);
  s.lineTo(0, -0.13);
  s.closePath();
  const g = inked(extrude(s, 0.05, 0.012, 2), paint(new THREE.Color(color).multiplyScalar(0.72), { rough: 0.5 }), INK);
  g.scale.x = side;
  return g;
}

function starsOnRibbon(filled, total = 5, span = 0.92, y = 0, z = 0) {
  const g = new THREE.Group();
  const geo = extrude(roundedStarShape(0.078, 0.037, 5, Math.PI / 2, 0.35), 0.03, 0.012, 2);
  for (let i = 0; i < total; i++) {
    const on = i < filled;
    const st = inked(geo, paint(on ? 0xffe14a : 0x2b2350, { rough: 0.3, emissive: on ? 0x806000 : 0, ei: on ? 0.25 : 0 }), 0.01);
    const u = total === 1 ? 0 : i / (total - 1) - 0.5;
    st.position.set(u * span, y - 0.07 * (u * 2) * (u * 2), z - 0.08 * (u * 2) * (u * 2));
    g.add(st);
  }
  return g;
}

function wingShape() {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.18);
  s.bezierCurveTo(0.35, 0.55, 0.85, 0.72, 1.18, 0.66);
  s.bezierCurveTo(1.0, 0.52, 1.02, 0.46, 1.12, 0.36);
  s.bezierCurveTo(0.92, 0.3, 0.9, 0.22, 0.98, 0.1);
  s.bezierCurveTo(0.78, 0.06, 0.74, -0.02, 0.8, -0.14);
  s.bezierCurveTo(0.52, -0.12, 0.28, -0.12, 0.0, -0.2);
  s.closePath();
  return s;
}

function featherShape(len, w) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(0, -r * 0.7);
  s.lineTo(len - r, -r);
  s.absarc(len - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r * 0.7);
  s.closePath();
  return s;
}

/** Layered feathers fanning out from the badge, as on a game rank emblem. */
function makeWing(color, side) {
  const g = new THREE.Group();
  const feathers = [
    { len: 1.08, ang: 0.62, w: 0.3 },
    { len: 1.0, ang: 0.28, w: 0.3 },
    { len: 0.86, ang: -0.06, w: 0.28 },
    { len: 0.68, ang: -0.4, w: 0.26 },
  ];
  feathers.forEach((f, i) => {
    const tone = new THREE.Color(color).multiplyScalar(1 - i * 0.05);
    const m = inked(extrude(featherShape(f.len, f.w), 0.05, 0.018, 2), paint(tone, { rough: 0.45 }), INK);
    m.rotation.z = f.ang;
    m.position.z = -i * 0.035;
    g.add(m);
  });
  g.scale.x = side;
  return g;
}

function crownShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.34, -0.12);
  s.lineTo(0.34, -0.12);
  s.lineTo(0.38, 0.2);
  s.lineTo(0.2, 0.06);
  s.lineTo(0.0, 0.3);
  s.lineTo(-0.2, 0.06);
  s.lineTo(-0.38, 0.2);
  s.closePath();
  return s;
}

function crystal(color, glow) {
  const pts = [
    new THREE.Vector2(0, -0.5),
    new THREE.Vector2(0.27, -0.14),
    new THREE.Vector2(0.27, 0.16),
    new THREE.Vector2(0, 0.56),
  ];
  const g = new THREE.LatheGeometry(pts, 6);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.12,
    metalness: 0.05,
    flatShading: true,
    clearcoat: 1,
    emissive: glow ?? color,
    emissiveIntensity: glow ? 0.5 : 0.12,
  });
  const c = inked(g, m, 0.014);
  c.scale.set(1, 1, 0.55);
  return c;
}

export function makeRankBadge(id) {
  const r = RANKS.find((x) => x.id === id) ?? RANKS[0];
  const root = new THREE.Group();
  root.name = `rank-${id}`;
  const metal = { rough: 0.3, metal: 0.25 };
  if (r.wings) {
    for (const side of [-1, 1]) {
      const wing = makeWing(r.wings, side);
      wing.position.set(side * 0.58, 0.12, -0.1);
      wing.rotation.y = side * -0.22;
      root.add(wing);
    }
  }
  const burst = inked(extrude(roundedStarShape(1.0, 0.86, 16, Math.PI / 2, 0.55), 0.14, 0.04, 3), paint(r.burst, metal), INK);
  root.add(burst);
  const ringGeo = new THREE.TorusGeometry(0.7, 0.07, 14, 60);
  const ring = inked(ringGeo, paint(r.ring, metal), INK);
  ring.position.z = 0.11;
  root.add(ring);
  const faceGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.12, 60);
  faceGeo.rotateX(Math.PI / 2);
  const face = inked(faceGeo, paint(r.face, { rough: 0.35, metal: 0.15 }), 0);
  face.position.z = 0.08;
  root.add(face);
  const gem = crystal(r.gem, r.glow);
  gem.position.z = 0.22;
  root.add(gem);
  if (r.crown) {
    const cr = inked(extrude(crownShape(), 0.1, 0.03, 2), paint(r.crown, { rough: 0.25, metal: 0.4 }), INK);
    cr.position.set(0, 1.08, 0.02);
    root.add(cr);
    for (const [x, y] of [[-0.38, 0.2], [0, 0.3], [0.38, 0.2]]) {
      const j = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), paint(0xff5ec8, { rough: 0.15, emissive: 0xff2aa0, ei: 0.3 }));
      j.position.set(x, 1.08 + y, 0.08);
      root.add(j);
    }
  }
  // banner
  const band = inked(bentRibbon(1.76, 0.36, 0.07, 0.1, 0.22), paint(r.ribbon, { rough: 0.45 }), INK);
  band.position.set(0, -0.72, 0.3);
  root.add(band);
  for (const side of [-1, 1]) {
    const tail = ribbonTail(r.ribbon, side);
    tail.position.set(side * 0.82, -0.86, 0.05);
    root.add(tail);
  }
  const st = starsOnRibbon(r.stars, 5, 0.95, -0.7, 0.37);
  root.add(st);
  root.userData = { rank: r };
  return root;
}

/* ------------------------------------------------------------------ */
/* the badge wall                                                      */
/* ------------------------------------------------------------------ */

const METAL = {
  bronze: { rim: 0xd08a4a, rimDark: 0x8e4e22 },
  silver: { rim: 0xdfe6f0, rimDark: 0x8394ad },
  gold: { rim: 0xffc93a, rimDark: 0xc07a14 },
  special: { rim: 0xf1e6ff, rimDark: 0x8f6fd0, iri: true },
};

const GROUP = {
  path: { face: 0x2fb5a8, name: "闯关" },
  streak: { face: 0xff6b3d, name: "连续" },
  memory: { face: 0x4a7dff, name: "记忆" },
  course: { face: 0x35c27a, name: "课程" },
  special: { face: 0x8a5cff, name: "特别" },
};

export const BADGES = [
  { id: "first-lesson", name: "上路", how: "学完第 1 关", group: "path", metal: "bronze", frame: "coin", icon: "flag" },
  { id: "ten-lessons", name: "十关", how: "学完 10 关", group: "path", metal: "bronze", frame: "coin", icon: "n10" },
  { id: "fifty-lessons", name: "五十关", how: "学完 50 关", group: "path", metal: "silver", frame: "coin", icon: "n50" },
  { id: "hundred-lessons", name: "一百关", how: "学完 100 关", group: "path", metal: "gold", frame: "coin", icon: "n100" },
  { id: "streak-7", name: "一周", how: "连续 7 天来学", group: "streak", metal: "bronze", frame: "shield", icon: "flame", num: "7" },
  { id: "streak-30", name: "一个月", how: "连续 30 天来学", group: "streak", metal: "silver", frame: "shield", icon: "flame", num: "30" },
  { id: "streak-100", name: "一百天", how: "连续 100 天来学", group: "streak", metal: "gold", frame: "shield", icon: "flame", num: "100" },
  { id: "first-review", name: "回头看", how: "复习第一张卡片", group: "memory", metal: "bronze", frame: "hex", icon: "loop" },
  { id: "long-term-50", name: "记住了", how: "50 张卡片记了 21 天以上还没忘", group: "memory", metal: "silver", frame: "hex", icon: "cards" },
  { id: "mistakes-cleared", name: "错题清零", how: "把错题本清空一次", group: "memory", metal: "silver", frame: "hex", icon: "check", added: true },
  { id: "own-words", name: "自己的话", how: "用自己的话讲过 5 关", group: "memory", metal: "bronze", frame: "hex", icon: "bubble", added: true },
  { id: "first-course", name: "走完一门", how: "学完一门课的每一关", group: "course", metal: "gold", frame: "crest", icon: "island" },
  { id: "three-courses", name: "三座岛", how: "学完 3 门课", group: "course", metal: "special", frame: "crest", icon: "island3", added: true },
  { id: "both-paths", name: "两条路", how: "两个方向都学完第一门课", group: "course", metal: "special", frame: "crest", icon: "fork", added: true },
  { id: "perfect-lesson", name: "一次全对", how: "一关里每道练习都第一次就答对", group: "special", metal: "gold", frame: "star", icon: "star", added: true },
  { id: "challenger", name: "挑战者", how: "通过一次岛上的游戏挑战", group: "special", metal: "silver", frame: "star", icon: "pennant", added: true },
  { id: "skip-test", name: "跳级", how: "通过一次跳级测验", group: "special", metal: "silver", frame: "star", icon: "up", added: true },
];

/* --- frames --- */

function shieldShape(s = 0.82) {
  const p = new THREE.Shape();
  p.moveTo(-0.72 * s, 0.78 * s);
  p.quadraticCurveTo(0, 0.95 * s, 0.72 * s, 0.78 * s);
  p.quadraticCurveTo(0.8 * s, 0.1 * s, 0.62 * s, -0.35 * s);
  p.quadraticCurveTo(0.35 * s, -0.85 * s, 0, -1.02 * s);
  p.quadraticCurveTo(-0.35 * s, -0.85 * s, -0.62 * s, -0.35 * s);
  p.quadraticCurveTo(-0.8 * s, 0.1 * s, -0.72 * s, 0.78 * s);
  return p;
}

function polygonShape(n, r, rot = 0, soft = 0.18) {
  return roundedStarShape(r, r * Math.cos(Math.PI / n), n, rot, soft);
}

function frameGeometry(frame, scale) {
  switch (frame) {
    case "shield":
      return extrude(shieldShape(scale), 0.14, 0.045, 3);
    case "hex":
      return extrude(polygonShape(6, 0.95 * scale, Math.PI / 2, 0.3), 0.14, 0.045, 3);
    case "crest":
      return extrude(roundedStarShape(0.98 * scale, 0.84 * scale, 10, Math.PI / 2, 0.9), 0.14, 0.045, 3);
    case "star":
      return extrude(roundedStarShape(1.08 * scale, 0.6 * scale, 5, Math.PI / 2, 0.42), 0.14, 0.045, 3);
    default: {
      const g = new THREE.CylinderGeometry(0.86 * scale, 0.86 * scale, 0.18, 64);
      g.rotateX(Math.PI / 2);
      return g;
    }
  }
}

/* --- icons, as flat shapes extruded in white --- */

function bar(x, y, w, h, r = 0.035) {
  const s = new THREE.Shape();
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

// block digits on a 0.3 x 0.5 cell, stroke 0.09
function digitShapes(ch, ox) {
  const t = 0.09;
  const W = 0.3;
  const H = 0.5;
  const top = [ox, H - t, W, t];
  const mid = [ox, H / 2 - t / 2, W, t];
  const bot = [ox, 0, W, t];
  const lu = [ox, H / 2, t, H / 2];
  const ll = [ox, 0, t, H / 2];
  const ru = [ox + W - t, H / 2, t, H / 2];
  const rl = [ox + W - t, 0, t, H / 2];
  const map = {
    0: [top, bot, lu, ll, ru, rl],
    1: [[ox + W / 2 - t / 2, 0, t, H], [ox + W / 2 - t * 1.6, H - t, t * 1.2, t]],
    3: [top, mid, bot, ru, rl],
    5: [top, lu, mid, rl, bot],
    7: [top, [ox + W - t, 0, t, H]],
  };
  return (map[ch] ?? []).map(([x, y, w, h]) => bar(x, y, w, h));
}

function textShapes(str, adv = 0.38) {
  const shapes = [];
  const width = str.length * adv - (adv - 0.3);
  [...str].forEach((ch, i) => shapes.push(...digitShapes(ch, i * adv - width / 2)));
  return { shapes, width };
}

function iconShapes(icon) {
  const S = [];
  switch (icon) {
    case "flag": {
      S.push(bar(-0.26, -0.42, 0.07, 0.84));
      const f = new THREE.Shape();
      f.moveTo(-0.2, 0.4);
      f.quadraticCurveTo(0.05, 0.5, 0.32, 0.33);
      f.lineTo(0.3, 0.02);
      f.quadraticCurveTo(0.05, 0.16, -0.2, 0.06);
      f.closePath();
      S.push(f);
      break;
    }
    case "flame": {
      const f = new THREE.Shape();
      f.moveTo(0, -0.4);
      f.bezierCurveTo(0.34, -0.4, 0.4, -0.05, 0.22, 0.14);
      f.bezierCurveTo(0.2, 0.0, 0.12, -0.02, 0.1, 0.04);
      f.bezierCurveTo(0.2, 0.25, 0.08, 0.42, -0.04, 0.5);
      f.bezierCurveTo(0.0, 0.3, -0.12, 0.2, -0.2, 0.1);
      f.bezierCurveTo(-0.34, -0.05, -0.34, -0.4, 0, -0.4);
      S.push(f);
      break;
    }
    case "loop": {
      const s = new THREE.Shape();
      s.absarc(0, 0, 0.36, Math.PI * 0.15, Math.PI * 1.75, false);
      s.absarc(0, 0, 0.22, Math.PI * 1.75, Math.PI * 0.15, true);
      s.closePath();
      S.push(s);
      const a = new THREE.Shape();
      const ang = Math.PI * 0.15;
      const cx = Math.cos(ang) * 0.29;
      const cy = Math.sin(ang) * 0.29;
      a.moveTo(cx - 0.17, cy + 0.02);
      a.lineTo(cx + 0.17, cy + 0.02);
      a.lineTo(cx + 0.02, cy + 0.2);
      a.closePath();
      S.push(a);
      break;
    }
    case "cards": {
      S.push(bar(-0.3, -0.34, 0.4, 0.56, 0.06));
      S.push(bar(-0.08, -0.2, 0.4, 0.56, 0.06));
      break;
    }
    case "check": {
      const c = new THREE.Shape();
      c.moveTo(-0.34, 0.02);
      c.lineTo(-0.2, -0.12);
      c.lineTo(-0.08, 0.0);
      c.lineTo(0.26, 0.34);
      c.lineTo(0.38, 0.2);
      c.lineTo(-0.08, -0.28);
      c.closePath();
      S.push(c);
      break;
    }
    case "bubble": {
      const b = new THREE.Shape();
      b.moveTo(-0.36, 0.3);
      b.quadraticCurveTo(-0.36, 0.42, -0.24, 0.42);
      b.lineTo(0.24, 0.42);
      b.quadraticCurveTo(0.36, 0.42, 0.36, 0.3);
      b.lineTo(0.36, -0.06);
      b.quadraticCurveTo(0.36, -0.18, 0.24, -0.18);
      b.lineTo(-0.04, -0.18);
      b.lineTo(-0.2, -0.36);
      b.lineTo(-0.18, -0.18);
      b.lineTo(-0.24, -0.18);
      b.quadraticCurveTo(-0.36, -0.18, -0.36, -0.06);
      b.closePath();
      S.push(b);
      break;
    }
    case "island":
    case "island3": {
      const n = icon === "island3" ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const ox = n === 1 ? 0 : (i - 1) * 0.3;
        const oy = n === 1 ? 0 : i === 1 ? 0.2 : -0.02;
        const sc = n === 1 ? 1 : 0.6;
        const s = new THREE.Shape();
        s.moveTo(ox - 0.36 * sc, oy - 0.12 * sc);
        s.quadraticCurveTo(ox, oy + 0.22 * sc, ox + 0.36 * sc, oy - 0.12 * sc);
        s.quadraticCurveTo(ox + 0.1 * sc, oy - 0.42 * sc, ox, oy - 0.44 * sc);
        s.quadraticCurveTo(ox - 0.1 * sc, oy - 0.42 * sc, ox - 0.36 * sc, oy - 0.12 * sc);
        S.push(s);
        if (n > 1) continue;
        S.push(bar(ox - 0.02 * sc, oy + 0.04 * sc, 0.05 * sc, 0.4 * sc, 0.02));
        const f = new THREE.Shape();
        f.moveTo(ox + 0.03 * sc, oy + 0.42 * sc);
        f.lineTo(ox + 0.26 * sc, oy + 0.33 * sc);
        f.lineTo(ox + 0.03 * sc, oy + 0.24 * sc);
        f.closePath();
        S.push(f);
      }
      break;
    }
    case "fork": {
      S.push(bar(-0.045, -0.42, 0.09, 0.42));
      const l = new THREE.Shape();
      l.moveTo(-0.045, -0.02);
      l.lineTo(0.045, -0.02);
      l.lineTo(-0.22, 0.26);
      l.lineTo(-0.3, 0.2);
      l.closePath();
      S.push(l);
      const r = new THREE.Shape();
      r.moveTo(-0.045, -0.02);
      r.lineTo(0.045, -0.02);
      r.lineTo(0.3, 0.2);
      r.lineTo(0.22, 0.26);
      r.closePath();
      S.push(r);
      S.push(shiftShape(starShape(0.1, 0.045, 5), -0.3, 0.34));
      S.push(shiftShape(starShape(0.1, 0.045, 5), 0.3, 0.34));
      break;
    }
    case "star":
      S.push(roundedStarShape(0.42, 0.2, 5, Math.PI / 2, 0.3));
      break;
    case "pennant": {
      S.push(bar(-0.3, -0.42, 0.07, 0.84));
      const p = new THREE.Shape();
      p.moveTo(-0.24, 0.4);
      p.lineTo(0.36, 0.22);
      p.lineTo(-0.24, 0.02);
      p.closePath();
      S.push(p);
      break;
    }
    case "up": {
      for (const oy of [-0.2, 0.08]) {
        const c = new THREE.Shape();
        c.moveTo(-0.32, oy);
        c.lineTo(0, oy + 0.28);
        c.lineTo(0.32, oy);
        c.lineTo(0.32, oy - 0.12);
        c.lineTo(0, oy + 0.16);
        c.lineTo(-0.32, oy - 0.12);
        c.closePath();
        S.push(c);
      }
      break;
    }
    default: {
      if (icon.startsWith("n")) {
        const { shapes } = textShapes(icon.slice(1), 0.36);
        shapes.forEach((s) => S.push(shiftShape(s, 0, -0.25)));
      }
    }
  }
  return S;
}

function shiftShape(shape, dx, dy) {
  const pts = shape.extractPoints(12);
  const s = new THREE.Shape(pts.shape.map((p) => new THREE.Vector2(p.x + dx, p.y + dy)));
  return s;
}

export function makeBadge(id, { locked = false } = {}) {
  const b = BADGES.find((x) => x.id === id) ?? BADGES[0];
  const metal = METAL[b.metal];
  const grp = GROUP[b.group];
  const grey = (c, k = 1) => (locked ? new THREE.Color(0xa7acb5).multiplyScalar(k) : new THREE.Color(c).multiplyScalar(k));
  const root = new THREE.Group();
  root.name = `badge-${id}`;

  // hanging ribbon behind the coin medals
  if (b.frame === "coin") {
    for (const side of [-1, 1]) {
      const s = new THREE.Shape();
      s.moveTo(-0.13, 0.0);
      s.lineTo(0.13, 0.0);
      s.lineTo(0.13, -0.62);
      s.lineTo(0.0, -0.5);
      s.lineTo(-0.13, -0.62);
      s.closePath();
      const r = inked(extrude(s, 0.04, 0.01, 2), paint(grey(grp.face, 0.85), { rough: 0.5 }), INK);
      r.position.set(side * 0.3, -0.45, -0.1);
      r.rotation.z = side * 0.28;
      root.add(r);
    }
  }
  const rimMat = locked
    ? paint(0xb9bdc5, { rough: 0.5 })
    : new THREE.MeshPhysicalMaterial({
        color: metal.rim,
        roughness: 0.28,
        metalness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        iridescence: metal.iri ? 1 : 0,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [200, 700],
      });
  const outer = inked(frameGeometry(b.frame, 1.0), rimMat, INK);
  root.add(outer);
  const innerGeo = frameGeometry(b.frame, 0.8);
  innerGeo.scale(1, 1, 0.9);
  const inner = inked(innerGeo, paint(grey(grp.face), { rough: 0.4 }), 0.012);
  inner.position.z = 0.07;
  root.add(inner);

  const shapes = iconShapes(b.icon);
  if (shapes.length) {
    const icon = inked(extrude(shapes, 0.06, 0.018, 2), paint(locked ? 0xe3e5ea : 0xffffff, { rough: 0.3 }), 0.014);
    icon.position.z = 0.2;
    const sc = b.frame === "star" ? 0.78 : 0.95;
    icon.scale.set(sc, sc, 1);
    if (b.num) {
      icon.scale.set(0.72, 0.72, 1);
      icon.position.y = 0.14;
    }
    root.add(icon);
  }
  if (b.num) {
    const { shapes: ds } = textShapes(b.num, 0.36);
    const plate = inked(rbox(0.26 + b.num.length * 0.3, 0.42, 0.08, 0.12), paint(grey(metal.rimDark), { rough: 0.35, metal: 0.2 }), 0.012);
    plate.position.set(0, -0.42, 0.2);
    root.add(plate);
    const num = inked(extrude(ds, 0.04, 0.012, 2), paint(locked ? 0xe3e5ea : 0xffffff, { rough: 0.3 }), 0.01);
    num.scale.set(0.62, 0.62, 1);
    num.position.set(0, -0.42 - 0.155, 0.26);
    root.add(num);
  }
  root.userData = { badge: b, locked };
  return root;
}
