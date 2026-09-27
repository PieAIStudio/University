// University reward prototypes: treasure chests and badges.
// Prototype for the V7 journey. Procedural, no textures, no fonts, no downloads
// beyond three.js itself, so the same file renders stills and runs live.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ------------------------------------------------------------------ */
/* shared look                                                         */
/* ------------------------------------------------------------------ */

const OUTLINE = 0x24172e;

export function outlineMaterial(thickness, color = OUTLINE) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uThick = { value: thickness };
    s.vertexShader = "uniform float uThick;\n" + s.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed = position + normalize(normal) * uThick;",
    );
  };
  m.userData.thickness = thickness;
  return m;
}

const hullCache = new WeakMap();
function hullGeometry(geo) {
  if (hullCache.has(geo)) return hullCache.get(geo);
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  hullCache.set(geo, merged);
  return merged;
}

/** A mesh plus its ink outline, as one group. */
export function inked(geo, mat, thickness = 0.018) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  if (thickness > 0) {
    const h = new THREE.Mesh(hullGeometry(geo), outlineMaterial(thickness));
    h.renderOrder = -1;
    g.add(h);
  }
  g.userData.mesh = m;
  return g;
}

export function paint(color, { rough = 0.48, metal = 0.0, emissive = 0x000000, ei = 0, coat = 0.5 } = {}) {
  // a clear coat gives painted toys their white streak of highlight
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: ei,
    clearcoat: coat,
    clearcoatRoughness: 0.25,
  });
}

export function rbox(w, h, d, r = 0.03, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
}

export function starShape(outer, inner, points = 5, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

export function roundedStarShape(outer, inner, points, rot = Math.PI / 2, soft = 0.35) {
  // quadratic corners so a sunburst reads as cast metal, not paper
  const s = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const n = pts.length;
  const mid = (a, b, t) => new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const start = mid(pts[n - 1], pts[0], 1 - soft / 2);
  s.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nx = pts[(i + 1) % n];
    const out = mid(p, nx, soft / 2);
    s.quadraticCurveTo(p.x, p.y, out.x, out.y);
    const next = mid(p, nx, 1 - soft / 2);
    s.lineTo(next.x, next.y);
  }
  return s;
}

export function extrude(shape, depth, bevel = 0.02, seg = 3) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: seg,
    curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* ------------------------------------------------------------------ */
/* chests                                                              */
/* ------------------------------------------------------------------ */

export const CHEST_TIERS = {
  wood: { name: "木箱", body: 0x8c5a32, lid: 0x9a653a, band: 0xe2b64a, lock: 0xe2b64a, inner: 0x3a2213, glow: 0xffd27a, emblem: "keyhole" },
  common: { name: "普通宝箱", body: 0x3fd67f, lid: 0x49df8a, band: 0xffd84d, lock: 0xffd84d, inner: 0x0f4a2b, glow: 0x9dffc9, emblem: "keyhole" },
  rare: { name: "稀有宝箱", body: 0x2f98f5, lid: 0x3aa6ff, band: 0xffdf5e, lock: 0xffdf5e, inner: 0x0c2f5c, glow: 0x9fd6ff, emblem: "keyhole" },
  epic: { name: "史诗宝箱", body: 0xa04ff0, lid: 0xae5dfb, band: 0xffd24d, lock: 0xffd24d, inner: 0x2e0f52, glow: 0xe2b8ff, emblem: "gem" },
  legendary: { name: "传说宝箱", body: 0xffd23c, lid: 0xffdc52, band: 0xff5ea5, lock: 0xff5ea5, inner: 0x7a3a00, glow: 0xfff0a8, emblem: "star" },
};
export const CHEST_ORDER = ["common", "rare", "epic", "legendary"];

/**
 * One chest. Local origin is the centre of its footprint on the ground.
 * Width is 1 unit. `setOpen(t)` swings the lid 0..1.
 */
export function makeChest(tierName = "common", { ink = 0.016, loot: withLoot = true, glow: withGlow = true } = {}) {
  const t = CHEST_TIERS[tierName] ?? CHEST_TIERS.common;
  const W = 1.0;
  const D = 0.66;
  const H = 0.47;
  const R = D / 2;
  const DOME = 0.86; // the lid is a slightly flattened half-barrel
  const root = new THREE.Group();
  root.name = `chest-${tierName}`;

  const bodyMat = paint(t.body, { rough: 0.42 });
  const bodyDark = paint(new THREE.Color(t.body).multiplyScalar(0.8), { rough: 0.5 });
  const lidMat = paint(t.lid, { rough: 0.38 });
  const bandMat = paint(t.band, { rough: 0.28, metal: 0.35 });
  const innerMat = paint(t.inner, { rough: 0.9 });
  const inkMat = paint(0x241a2c, { rough: 0.6 });

  // base trim
  const base = inked(rbox(W * 1.04, 0.07, D * 1.05, 0.03), bandMat, ink);
  base.position.y = 0.035;
  root.add(base);

  // body: two solid plank rows, then a hollow top row so the open chest has an inside
  const rowH = (H - 0.07) / 3;
  const gap = 0.014;
  for (let row = 0; row < 2; row++) {
    const wobble = row % 2 ? 0.012 : -0.008;
    const plank = inked(rbox(W * 0.96 + wobble, rowH - gap, D * 0.95 + wobble * 0.5, 0.035), row % 2 ? bodyMat : bodyMat, ink);
    plank.position.y = 0.07 + rowH * row + rowH / 2;
    root.add(plank);
  }
  const topY = 0.07 + rowH * 2 + rowH / 2;
  const wallT = 0.08;
  const walls = [
    [W * 0.97, rowH - gap, wallT, 0, (D * 0.955) / 2 - wallT / 2],
    [W * 0.97, rowH - gap, wallT, 0, -(D * 0.955) / 2 + wallT / 2],
    [wallT, rowH - gap, D * 0.955, (W * 0.97) / 2 - wallT / 2, 0],
    [wallT, rowH - gap, D * 0.955, -(W * 0.97) / 2 + wallT / 2, 0],
  ];
  for (const [w, h, d, x, z] of walls) {
    const p = inked(rbox(w, h, d, 0.03), bodyMat, ink);
    p.position.set(x, topY, z);
    root.add(p);
  }
  // inside floor and a glow plane that lights up when the lid opens
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.82, D * 0.78), innerMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = topY - rowH / 2 + 0.01;
  root.add(floor);
  const glowMat = new THREE.MeshBasicMaterial({ color: t.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, D * 0.76), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = topY - rowH / 2 + 0.02;
  root.add(glow);
  // loot peeking out of an open chest
  const loot = new THREE.Group();
  const coinGeo = extrude(roundedStarShape(0.075, 0.036, 5, Math.PI / 2, 0.3), 0.02, 0.01, 2);
  const coinMat = paint(0xffcf3a, { rough: 0.25, metal: 0.4, emissive: 0x7a4a00, ei: 0.3 });
  const cardGeo = rbox(0.13, 0.17, 0.012, 0.012, 2);
  const cardMats = [0xffffff, 0xfff3c4, 0xe6f4ff].map((c) => paint(c, { rough: 0.5 }));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const c = i % 4 === 3 ? new THREE.Mesh(cardGeo, cardMats[i % 3]) : new THREE.Mesh(coinGeo, coinMat);
    c.position.set((rnd() - 0.5) * W * 0.7, topY - rowH / 2 + 0.05 + rnd() * 0.09, (rnd() - 0.5) * D * 0.6);
    c.rotation.set((rnd() - 0.5) * 1.2, rnd() * 3, (rnd() - 0.5) * 1.2);
    loot.add(c);
  }
  loot.visible = false;
  root.add(loot);

  // plank seams on front and back, drawn as thin ink lines
  for (const z of [(D * 0.95) / 2 + 0.002, -(D * 0.95) / 2 - 0.002]) {
    for (let row = 1; row < 3; row++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(W * 0.93, 0.012, 0.004), inkMat);
      seam.position.set(0, 0.07 + rowH * row, z);
      root.add(seam);
    }
  }

  // vertical bands with rivets
  const bandX = 0.3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const b = inked(rbox(0.13, H - 0.04, 0.035, 0.012), bandMat, ink);
      b.position.set(sx * bandX, 0.07 + (H - 0.07) / 2 - 0.005, sz * ((D * 0.955) / 2 + 0.012));
      root.add(b);
      if (sz === 1) {
        for (const ry of [0.07 + (H - 0.07) * 0.28, 0.07 + (H - 0.07) * 0.74]) {
          const rv = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), paint(0xffffff, { rough: 0.3 }));
          rv.position.set(sx * bandX, ry, (D * 0.955) / 2 + 0.034);
          root.add(rv);
        }
      }
    }
  }
  // corner guards
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cg = inked(rbox(0.17, 0.15, 0.17, 0.04), bandMat, ink);
      cg.position.set(sx * (W / 2 - 0.05), 0.085, sz * (D / 2 - 0.035));
      root.add(cg);
    }
  }

  // lid, hinged along the back top edge
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2 + 0.01);
  root.add(hinge);
  const lid = new THREE.Group();
  lid.position.z = D / 2 - 0.01;
  hinge.add(lid);
  const dome = new THREE.CylinderGeometry(R * 0.98, R * 0.98, W * 0.97, 40, 1, false, 0, Math.PI);
  dome.rotateZ(Math.PI / 2);
  dome.scale(1, DOME, 1);
  const domeMesh = inked(dome, lidMat, ink);
  domeMesh.position.y = 0.04;
  lid.add(domeMesh);
  const rim = inked(rbox(W * 1.0, 0.075, D * 1.0, 0.03), bandMat, ink);
  rim.position.y = 0.035;
  lid.add(rim);
  // underside of the lid, dark, so an open lid does not look solid
  const underMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(t.inner).lerp(new THREE.Color(t.glow), 0.25), roughness: 0.8, emissive: t.glow, emissiveIntensity: 0 });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, D * 0.92), underMat);
  under.rotation.x = Math.PI / 2;
  under.position.y = -0.008;
  lid.add(under);
  for (const sx of [-1, 1]) {
    const arc = new THREE.CylinderGeometry(R * 0.98 + 0.028, R * 0.98 + 0.028, 0.13, 40, 1, false, 0, Math.PI);
    arc.rotateZ(Math.PI / 2);
    arc.scale(1, (R * 0.98 * DOME + 0.028) / (R * 0.98 + 0.028), 1);
    const a = inked(arc, bandMat, ink);
    a.position.set(sx * bandX, 0.04, 0);
    lid.add(a);
  }
  // hasp on the lid
  const haspShape = new THREE.Shape();
  haspShape.moveTo(-0.07, 0.0);
  haspShape.lineTo(0.07, 0.0);
  haspShape.lineTo(0.07, -0.1);
  haspShape.quadraticCurveTo(0.07, -0.16, 0.0, -0.16);
  haspShape.quadraticCurveTo(-0.07, -0.16, -0.07, -0.1);
  haspShape.closePath();
  const hasp = inked(extrude(haspShape, 0.03, 0.012), paint(t.lock, { rough: 0.28, metal: 0.35 }), ink);
  hasp.position.set(0, 0.07, R + 0.015);
  lid.add(hasp);

  // lock plate on the body
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.11, 0.1);
  plateShape.lineTo(0.11, 0.1);
  plateShape.lineTo(0.11, -0.06);
  plateShape.quadraticCurveTo(0.11, -0.16, 0.0, -0.16);
  plateShape.quadraticCurveTo(-0.11, -0.16, -0.11, -0.06);
  plateShape.closePath();
  const plate = inked(extrude(plateShape, 0.04, 0.014), paint(t.lock, { rough: 0.28, metal: 0.35 }), ink);
  plate.position.set(0, H - 0.13, (D * 0.955) / 2 + 0.03);
  root.add(plate);
  const emblemZ = (D * 0.955) / 2 + 0.07;
  if (t.emblem === "star") {
    const st = inked(extrude(roundedStarShape(0.07, 0.034, 5, Math.PI / 2, 0.3), 0.02, 0.008), paint(0xffffff, { rough: 0.25 }), 0.008);
    st.position.set(0, H - 0.14, emblemZ);
    root.add(st);
  } else if (t.emblem === "gem") {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), paint(0xff7ad9, { rough: 0.15, metal: 0.1, emissive: 0x8a1a6a, ei: 0.35 }));
    gem.geometry = gem.geometry.clone();
    gem.scale.set(0.9, 1.25, 0.6);
    gem.position.set(0, H - 0.14, emblemZ - 0.005);
    root.add(gem);
  } else {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.028, 18), inkMat);
    hole.position.set(0, H - 0.12, emblemZ + 0.001);
    root.add(hole);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.06), inkMat);
    slot.position.set(0, H - 0.16, emblemZ + 0.001);
    root.add(slot);
  }

  // a thin band of light at the lid seam: the chest "charges" before it opens
  const leakMat = new THREE.MeshBasicMaterial({ color: t.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const leak = new THREE.Mesh(rbox(W * 1.02, 0.05, D * 1.02, 0.02, 2), leakMat);
  leak.position.y = H + 0.005;
  root.add(leak);
  function setLeak(k) {
    leakMat.opacity = Math.max(0, Math.min(1, k)) * 0.95;
  }

  function setOpen(k) {
    const e = Math.max(0, Math.min(1, k));
    if (e > 0.05) leakMat.opacity = 0;
    hinge.rotation.x = -e * 1.95;
    glowMat.opacity = withGlow ? e * 0.9 : 0;
    underMat.emissiveIntensity = e * 0.55;
    loot.visible = withLoot && e > 0.15;
  }
  setOpen(0);

  root.userData = { tier: tierName, setOpen, setLeak, hinge, lid, glow, size: { W, D, H: H + R } };
  return root;
}

/* ------------------------------------------------------------------ */
/* stage: lights, environment, glow ring                               */
/* ------------------------------------------------------------------ */

export function makeRenderer(canvas, { alpha = true } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

export function makeStage(renderer, { floor = "shadow" } = {}) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6d5a86, 1.15));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.3);
  rim.position.set(2.5, 2.0, -3.0);
  scene.add(rim);
  if (floor === "shadow") {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.22 }));
    f.rotation.x = -Math.PI / 2;
    f.receiveShadow = true;
    scene.add(f);
  }
  return scene;
}

function radialTexture(inner, outer, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
  gr.addColorStop(0, "rgba(255,255,255,0)");
  gr.addColorStop(0.55, "rgba(255,255,255,0.9)");
  gr.addColorStop(0.7, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/** The glowing ring a chest stands in, as in a game reward screen. */
export function makeGlowRing(color, radius = 0.9) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: ringTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  return m;
}

/* ------------------------------------------------------------------ */
/* opening: shake, burst, loot flies, settle                           */
/* ------------------------------------------------------------------ */

const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Drives one chest through the opening. `update(dt)` each frame.
 * Emits { at: 'burst' } and { at: 'settled' } through onEvent.
 */
/**
 * How big each chest's celebration is. Rarer chests burst in more waves, for
 * longer, with more kinds of things; the wood chest is the everyday one.
 */
export const OPENING_FX = {
  wood: { waves: 1, count: 60, gap: 0, shake: 0, shock: 1, fireworks: 0, rain: 0, charge: 0.6, settle: 1.2 },
  rare: { waves: 2, count: 80, gap: 0.45, shake: 0.015, shock: 2, fireworks: 0, rain: 0, charge: 0.8, settle: 1.6 },
  epic: { waves: 3, count: 100, gap: 0.42, shake: 0.03, shock: 3, fireworks: 3, rain: 0, charge: 1.0, settle: 2.0 },
  legendary: { waves: 4, count: 120, gap: 0.4, shake: 0.05, shock: 4, fireworks: 7, rain: 60, charge: 1.2, settle: 2.6 },
};
OPENING_FX.common = OPENING_FX.wood;

function softDot(color = "rgba(255,255,255,1)") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Drives one chest through the opening: charge, burst in waves, settle.
 * `update(dt)` each frame. Events: { at: 'burst' | 'wave' | 'settled', wave? }.
 * `shake` (read each frame) is a small camera jitter the host may apply.
 */
export function makeOpening(scene, chest, { onEvent = () => {}, reduced = false, seed = 0 } = {}) {
  let st = seed || Math.floor(Math.random() * 1e9) + 1;
  const rand = () => ((st = (st * 16807) % 2147483647) / 2147483647);
  const tierName = chest.userData.tier;
  const tier = CHEST_TIERS[tierName];
  const fx = OPENING_FX[tierName] ?? OPENING_FX.wood;
  const k0 = chest.scale.x;
  const parts = [];
  const geoStar = extrude(roundedStarShape(0.07, 0.034, 5, Math.PI / 2, 0.3), 0.018, 0.008, 2);
  const geoCard = rbox(0.12, 0.16, 0.01, 0.012, 2);
  const geoGem = new THREE.OctahedronGeometry(0.06, 0);
  const geoConf = new THREE.PlaneGeometry(0.05, 0.028);
  const geoCoin = new THREE.CylinderGeometry(0.06, 0.06, 0.016, 16);
  const starMat = paint(0xffcf3a, { rough: 0.25, metal: 0.4, emissive: 0x7a4a00, ei: 0.35 });
  const coinMat = paint(0xffd23c, { rough: 0.2, metal: 0.6, emissive: 0x6a4200, ei: 0.3 });
  const cardMat = paint(0xffffff, { rough: 0.5, emissive: 0xffffff, ei: 0.1 });
  const gemMats = [0xff6fb5, 0x6fd3ff, 0xb68bff, 0x7dffb0].map((c) => paint(c, { rough: 0.15, emissive: c, ei: 0.3 }));
  const confCols = [0xff5ea5, 0xffd84d, 0x4fd3ff, 0x7dff9a, 0xb07bff, 0xffffff];
  const dot = softDot();
  const sparkMat = new THREE.SpriteMaterial({ map: dot, color: tier.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  const flashMat = new THREE.MeshBasicMaterial({ map: dot, color: tier.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), flashMat);
  const beamMat = new THREE.MeshBasicMaterial({ map: dot, color: tier.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.6, 2.8, 24, 1, true), beamMat);
  const holder = new THREE.Group();
  holder.position.copy(chest.position);
  holder.scale.setScalar(k0);
  flash.position.set(0, 0.7, 0.2);
  beam.position.set(0, 1.9, 0);
  holder.add(flash, beam);
  scene.add(holder);
  const shocks = [];
  function shockwave(strength) {
    const m = new THREE.MeshBasicMaterial({ map: ringDot, color: tier.glow, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.03;
    holder.add(r);
    shocks.push({ r, m, age: 0, max: 2.2 + strength * 0.8 });
  }
  const ringDot = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.7, "rgba(255,255,255,0.9)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  function add(mesh, v, kind, drag) {
    mesh.position.copy(v.p);
    holder.add(mesh);
    parts.push({ mesh, v: v.v, w: new THREE.Vector3(rand() * 8, rand() * 8, rand() * 8), drag, life: 0, kind, ttl: v.ttl ?? 99 });
  }
  function spray(n, power) {
    for (let i = 0; i < n; i++) {
      const r = rand();
      const kind = r < 0.3 ? "star" : r < 0.4 ? "card" : r < 0.52 ? "gem" : tierName === "legendary" && r < 0.62 ? "coin" : "conf";
      let mesh;
      if (kind === "star") mesh = new THREE.Mesh(geoStar, starMat);
      else if (kind === "card") mesh = new THREE.Mesh(geoCard, cardMat);
      else if (kind === "gem") mesh = new THREE.Mesh(geoGem, gemMats[i % gemMats.length]);
      else if (kind === "coin") mesh = new THREE.Mesh(geoCoin, coinMat);
      else mesh = new THREE.Mesh(geoConf, new THREE.MeshBasicMaterial({ color: confCols[i % confCols.length], side: THREE.DoubleSide }));
      const a = rand() * Math.PI * 2;
      const sp = (kind === "conf" ? 1.2 + rand() * 1.8 : 0.8 + rand() * 1.4) * power;
      add(mesh, { p: new THREE.Vector3((rand() - 0.5) * 0.4, 0.62, (rand() - 0.5) * 0.25), v: new THREE.Vector3(Math.cos(a) * sp * 0.6, (3.2 + rand() * 2.2) * power, Math.sin(a) * sp * 0.45 + 0.6) }, kind, kind === "conf" ? 2.2 : 0.4);
    }
    for (let i = 0; i < Math.round(n * 0.4); i++) {
      const s = new THREE.Sprite(sparkMat);
      s.scale.setScalar(0.12 + rand() * 0.12);
      const a = rand() * Math.PI * 2;
      add(s, { p: new THREE.Vector3(0, 0.7, 0), v: new THREE.Vector3(Math.cos(a) * 2.2 * power, (1 + rand() * 3) * power, Math.sin(a) * 1.6 * power), ttl: 0.6 + rand() * 0.6 }, "spark", 1.6);
    }
  }
  function firework() {
    const c = new THREE.Vector3((rand() - 0.5) * 3.2, 2.2 + rand() * 1.4, -0.6 - rand() * 1.2);
    const col = [0xffe14a, 0xff6fb5, 0x6fd3ff, 0xb68bff][Math.floor(rand() * 4)];
    const m = new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.1);
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      add(s, { p: c.clone(), v: new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th)).multiplyScalar(1.6 + rand() * 0.6), ttl: 1.1 + rand() * 0.4 }, "spark", 1.2);
    }
  }
  function rain(n) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geoCoin, coinMat);
      add(mesh, { p: new THREE.Vector3((rand() - 0.5) * 4, 3.5 + rand() * 1.5, (rand() - 0.5) * 2), v: new THREE.Vector3(0, -rand() * 1.5, 0) }, "coin", 0.2);
    }
  }

  let t = 0;
  let phase = "idle";
  let wave = 0;
  let shake = 0;
  const base = chest.position.clone();
  const api = {
    get phase() {
      return phase;
    },
    get shake() {
      return shake;
    },
    fx,
    open() {
      if (phase !== "idle") return;
      phase = reduced ? "burst" : "charge";
      t = 0;
      if (reduced) {
        chest.userData.setOpen(1);
        onEvent({ at: "burst" });
        onEvent({ at: "settled" });
        phase = "settled";
      }
    },
    update(dt) {
      t += dt;
      shake *= Math.pow(0.02, dt);
      if (phase === "idle") {
        chest.position.y = base.y + (reduced ? 0 : Math.sin(t * 2.4) * 0.03 * k0 + 0.03 * k0);
        chest.rotation.y = reduced ? chest.rotation.y : Math.sin(t * 0.9) * 0.08 + (chest.userData.yaw0 ?? (chest.userData.yaw0 = chest.rotation.y));
        // every few seconds, a little hop to say "tap me"
        const cyc = t % 3.2;
        if (!reduced && cyc < 0.35) chest.rotation.z = Math.sin(cyc * 40) * 0.05 * (1 - cyc / 0.35);
        else chest.rotation.z = 0;
      } else if (phase === "charge") {
        const k = clamp01(t / fx.charge);
        const amp = (0.03 + k * k * 0.12);
        chest.rotation.z = Math.sin(t * (40 + k * 30)) * amp;
        chest.rotation.y = (chest.userData.yaw0 ?? 0) + Math.sin(t * 31) * amp * 0.6;
        chest.userData.setLeak(k);
        const sq = 1 - 0.12 * Math.pow(k, 3);
        chest.scale.set(k0 * (1 + (1 - sq) * 0.9), k0 * sq, k0 * (1 + (1 - sq) * 0.9));
        chest.position.y = base.y;
        if (k >= 1) {
          phase = "burst";
          t = 0;
          chest.rotation.z = 0;
          chest.rotation.y = chest.userData.yaw0 ?? 0;
          chest.scale.setScalar(k0);
          chest.userData.setLeak(0);
          wave = 1;
          spray(fx.count, 1);
          shockwave(1);
          if (fx.rain) rain(fx.rain);
          shake = fx.shake;
          onEvent({ at: "burst" });
          onEvent({ at: "wave", wave });
        }
      } else if (phase === "burst" || phase === "settled") {
        const k = clamp01(t / 0.45);
        if (!reduced) chest.userData.setOpen(easeOutBack(k));
        chest.scale.setScalar(k0 * (1 + 0.12 * Math.sin(Math.min(1, t / 0.3) * Math.PI)));
        // later waves: bigger, higher, with their own shockwave and fireworks
        if (!reduced && wave < fx.waves && t >= wave * fx.gap) {
          wave++;
          spray(Math.round(fx.count * (0.7 + wave * 0.15)), 1 + wave * 0.12);
          if (wave <= fx.shock) shockwave(wave);
          for (let i = 0; i < Math.ceil(fx.fireworks / Math.max(1, fx.waves - 1)); i++) firework();
          shake = fx.shake * (1 + wave * 0.3);
          onEvent({ at: "wave", wave });
        }
        const flashK = Math.max(0, 1 - t / 0.35) + (wave > 1 ? Math.max(0, 1 - (t - (wave - 1) * fx.gap) / 0.3) * 0.6 : 0);
        flashMat.opacity = reduced ? 0 : Math.min(0.8, flashK * 0.8);
        flash.lookAt(scene.userData.camera?.position ?? new THREE.Vector3(0, 1, 5));
        beamMat.opacity = reduced ? 0.25 : Math.min(0.5 + fx.waves * 0.08, t * 1.4) * (0.75 + 0.25 * Math.sin(t * 3));
        beam.rotation.y += dt * 0.6;
        for (const sh of shocks) {
          sh.age += dt;
          const kk = clamp01(sh.age / 0.9);
          sh.r.scale.setScalar(0.5 + kk * sh.max);
          sh.m.opacity = (1 - kk) * 0.9;
        }
        for (const p of parts) {
          p.life += dt;
          if (p.kind === "spark") {
            p.v.y -= 2.5 * dt;
            p.v.multiplyScalar(1 - p.drag * dt);
            p.mesh.position.addScaledVector(p.v, dt);
            p.mesh.material.opacity = Math.max(0, 1 - p.life / p.ttl);
            if (p.life > p.ttl) p.mesh.visible = false;
            continue;
          }
          p.v.y -= 7.5 * dt;
          p.v.multiplyScalar(1 - p.drag * dt);
          p.mesh.position.addScaledVector(p.v, dt);
          p.mesh.rotation.x += p.w.x * dt;
          p.mesh.rotation.y += p.w.y * dt;
          p.mesh.rotation.z += p.w.z * dt;
          if (p.mesh.position.y < 0.02 && p.kind !== "conf") {
            p.mesh.position.y = 0.02;
            p.v.y *= -0.35;
            p.v.x *= 0.6;
            p.v.z *= 0.6;
          }
          if (p.kind === "conf" && p.mesh.position.y < 0) p.mesh.visible = false;
        }
        if (phase === "burst" && t > (fx.waves - 1) * fx.gap + fx.settle) {
          phase = "settled";
          onEvent({ at: "settled" });
        }
      }
    },
    reset() {
      for (const p of parts) holder.remove(p.mesh);
      parts.length = 0;
      for (const sh of shocks) holder.remove(sh.r);
      shocks.length = 0;
      chest.userData.setOpen(0);
      chest.userData.setLeak(0);
      chest.rotation.set(0, chest.userData.yaw0 ?? chest.rotation.y, 0);
      chest.scale.setScalar(k0);
      chest.position.copy(base);
      flashMat.opacity = 0;
      beamMat.opacity = 0;
      phase = "idle";
      wave = 0;
      t = 0;
    },
    dispose() {
      api.reset();
      scene.remove(holder);
    },
  };
  return api;
}
