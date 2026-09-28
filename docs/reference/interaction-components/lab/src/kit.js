// Toy kit for the 3D-ification walkthrough. Mirrors the look of the product's
// courtyard game (packages/world/src/toy-play): the same TOY palette, waxy
// clearcoat materials, rounded slabs and warm key light. Prototype only.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export { THREE };

export const TOY = {
  sky: 0xc4e7ed,
  cream: 0xffedc9,
  paper: 0xfff8ea,
  grass: 0x8cbd49,
  grassEdge: 0x77a345,
  soil: 0xc29160,
  water: 0x57bdcc,
  bark: 0xb8834d,
  wood: 0xd9a066,
  leaf: 0x42974e,
  leafLight: 0x72b44e,
  blue: 0x659abc,
  coral: 0xe99073,
  gold: 0xf2c963,
  ink: 0x38545a,
  mint: 0x73b6a1,
  sky2: 0x739ec6,
  rose: 0xf4a99a,
  pink: 0xf7c1c6,
  red: 0xe56b5c,
  stone: 0xd9d3c7,
  white: 0xffffff,
  dark: 0x2c2f33,
};

const mats = new Map();
export function wax(color, { rough, clear = 0.35, emissive = 0, opacity = 1 } = {}) {
  const key = [color, rough, clear, emissive, opacity].join("/");
  let m = mats.get(key);
  if (!m) {
    const earthy = [TOY.grass, TOY.grassEdge, TOY.soil, TOY.bark].includes(color);
    m = new THREE.MeshPhysicalMaterial({
      color,
      roughness: rough ?? (earthy ? 0.72 : 0.4),
      metalness: 0,
      clearcoat: earthy ? 0.06 : clear,
      clearcoatRoughness: 0.4,
      emissive: emissive ? new THREE.Color(emissive) : new THREE.Color(0),
      emissiveIntensity: emissive ? 0.6 : 0,
      transparent: opacity < 1,
      opacity,
    });
    mats.set(key, m);
  }
  return m;
}
/** A fresh material the caller can animate (colour or glow) without touching the cache. */
export function waxOwn(color, opts = {}) {
  return wax(color, opts).clone();
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const boxCache = new Map();
export function block(w, h, d, color, r = 0.08, mat) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = [w, h, d, rr].join("/");
  let g = boxCache.get(key);
  if (!g) boxCache.set(key, (g = new RoundedBoxGeometry(w, h, d, 3, rr)));
  return mesh(g, mat ?? wax(color));
}
const sphereG = new THREE.SphereGeometry(1, 32, 20);
export function ball(r, color, mat) {
  const m = mesh(sphereG, mat ?? wax(color));
  m.scale.setScalar(r);
  return m;
}
export function blob(sx, sy, sz, color, mat) {
  const m = mesh(sphereG, mat ?? wax(color));
  m.scale.set(sx, sy, sz);
  return m;
}
const cylG = new THREE.CylinderGeometry(1, 1, 1, 28);
export function disc(r, h, color, mat) {
  const m = mesh(cylG, mat ?? wax(color));
  m.scale.set(r, h, r);
  return m;
}
export function cone(r, h, color) {
  return mesh(new THREE.ConeGeometry(r, h, 24), wax(color));
}
export function torus(r, tube, color, arc = Math.PI * 2) {
  return mesh(new THREE.TorusGeometry(r, tube, 14, 40, arc), wax(color));
}
export function capsule(r, len, color, mat) {
  return mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat ?? wax(color));
}

function roundRect(w, d, r) {
  const s = new THREE.Shape();
  const x = w / 2, z = d / 2;
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z);
  s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r);
  s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r);
  s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  return s;
}
export function slab(w, d, h, r, color, mat) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, d, r), {
    depth: h,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(0.12, h * 0.3),
    bevelThickness: Math.min(0.1, h * 0.3),
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  return mesh(g, mat ?? wax(color));
}

/** The floating toy island every scene stands on. */
export function island(w = 12, d = 9) {
  const g = new THREE.Group();
  const soil = slab(w, d, 1.2, Math.min(w, d) * 0.22, TOY.soil);
  soil.position.y = -0.72;
  const grass = slab(w + 0.14, d + 0.14, 0.2, Math.min(w, d) * 0.23, TOY.grass);
  grass.position.y = -0.08;
  g.add(soil, grass);
  return g;
}
export function tree(scale = 1) {
  const g = new THREE.Group();
  const trunk = disc(0.16, 1.4, TOY.bark);
  trunk.position.y = 0.7;
  const a = blob(0.85, 0.9, 0.82, TOY.leaf);
  a.position.set(0, 1.9, 0);
  const b = blob(0.55, 0.6, 0.55, TOY.leafLight);
  b.position.set(-0.45, 1.6, 0.22);
  const c = blob(0.5, 0.58, 0.52, TOY.leaf);
  c.position.set(0.5, 1.72, 0);
  const f = ball(0.1, TOY.coral);
  f.position.set(-0.5, 2.1, 0.55);
  g.add(trunk, a, b, c, f);
  g.scale.setScalar(scale);
  return g;
}
export function bush(scale = 1, color = TOY.leafLight) {
  const g = new THREE.Group();
  const a = blob(0.5, 0.38, 0.45, color);
  a.position.y = 0.25;
  const b = blob(0.36, 0.3, 0.34, TOY.leaf);
  b.position.set(0.38, 0.2, 0.08);
  g.add(a, b);
  g.scale.setScalar(scale);
  return g;
}
export function flower(color = TOY.cream) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const p = blob(0.08, 0.035, 0.08, color);
    const a = (i / 5) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08);
    g.add(p);
  }
  const c = ball(0.05, TOY.gold);
  c.position.y = 0.13;
  const stem = disc(0.015, 0.12, TOY.leaf);
  stem.position.y = 0.06;
  g.add(c, stem);
  return g;
}
export function lantern() {
  const g = new THREE.Group();
  const post = disc(0.06, 1.1, TOY.ink);
  post.position.y = 0.55;
  const lamp = block(0.3, 0.34, 0.3, TOY.gold, 0.08);
  lamp.material = waxOwn(TOY.gold, { emissive: 0xffd27a });
  lamp.position.y = 1.2;
  const cap = block(0.42, 0.08, 0.42, TOY.coral, 0.03);
  cap.position.y = 1.41;
  g.add(post, lamp, cap);
  return g;
}
export function fence(len, color = TOY.cream) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 0.6));
  for (let i = 0; i <= n; i++) {
    const p = block(0.1, 0.5, 0.1, color, 0.03);
    p.position.set(-len / 2 + (len * i) / n, 0.25, 0);
    g.add(p);
  }
  const rail = block(len, 0.07, 0.06, color, 0.02);
  rail.position.y = 0.36;
  g.add(rail);
  return g;
}
export function path(points, width = 0.9, color = TOY.cream) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const s = slab(width, len + width * 0.6, 0.06, width * 0.45, color, wax(color, { rough: 0.8, clear: 0 }));
    s.position.set((ax + bx) / 2, 0.1, (az + bz) / 2);
    s.rotation.y = Math.atan2(bx - ax, bz - az);
    s.castShadow = false;
    g.add(s);
  }
  return g;
}

/** The learner's bunny: one round body, long ears, glossy like the kit avatar. */
export function bunny(scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const skin = waxOwn(TOY.rose, { clear: 0.6, rough: 0.32 });
  const head = blob(0.62, 0.58, 0.6, 0, skin);
  head.position.y = 0.58;
  body.add(head);
  for (const s of [-1, 1]) {
    const ear = capsule(0.13, 0.52, 0, skin);
    ear.position.set(s * 0.22, 1.35, -0.05);
    ear.rotation.z = -s * 0.12;
    const inner = capsule(0.075, 0.38, TOY.coral);
    inner.position.set(0, 0.02, 0.07);
    ear.add(inner);
    body.add(ear);
    const eye = ball(0.075, TOY.dark);
    eye.position.set(s * 0.24, 0.66, 0.52);
    const glint = ball(0.025, TOY.white);
    glint.position.set(0.025, 0.03, 0.06);
    eye.add(glint);
    body.add(eye);
    const cheek = blob(0.1, 0.06, 0.04, TOY.pink);
    cheek.position.set(s * 0.36, 0.5, 0.48);
    cheek.rotation.y = s * 0.5;
    body.add(cheek);
  }
  const mouth = block(0.12, 0.08, 0.05, TOY.red, 0.02);
  mouth.position.set(0, 0.47, 0.57);
  body.add(mouth);
  const shadowPad = disc(0.5, 0.02, TOY.grassEdge);
  shadowPad.position.y = 0.01;
  shadowPad.castShadow = false;
  g.add(shadowPad, body);
  g.userData.body = body;
  g.scale.setScalar(scale);
  return g;
}
/** A small idle life for the bunny: breathe, and hop when asked. */
export function bunnyTick(b, t, { hop = 0, cheer = 0, shake = 0 } = {}) {
  const body = b.userData.body;
  const breathe = 1 + Math.sin(t * 2.4) * 0.025;
  body.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));
  body.position.y = hop > 0 ? Math.sin(Math.min(1, hop) * Math.PI) * 0.6 : 0;
  body.rotation.z = shake > 0 ? Math.sin(t * 30) * 0.18 * shake : 0;
  if (cheer > 0) body.position.y += Math.abs(Math.sin(t * 9)) * 0.35 * cheer;
}

export function basket(color) {
  const g = new THREE.Group();
  const outer = disc(0.62, 0.7, color);
  outer.position.y = 0.35;
  const rim = torus(0.62, 0.07, TOY.cream);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.72;
  const inner = disc(0.54, 0.05, TOY.ink);
  inner.position.y = 0.69;
  g.add(outer, rim, inner);
  return g;
}
export function signboard(w = 1.6, h = 0.8, color = TOY.wood, postH = 1.1) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = disc(0.06, postH + h, TOY.bark);
    p.position.set(s * (w / 2 - 0.12), (postH + h) / 2, -0.02);
    g.add(p);
  }
  const board = block(w, h, 0.12, color, 0.06);
  board.position.y = postH + h / 2;
  const face = block(w - 0.14, h - 0.14, 0.02, TOY.paper, 0.03);
  face.position.set(0, postH + h / 2, 0.065);
  g.add(board, face);
  g.userData.face = face;
  g.userData.anchor = new THREE.Vector3(0, postH + h / 2, 0.1);
  return g;
}

/** Card: a small paper tag, used as a thing that carries text. */
export function card(w = 1.2, h = 0.5, color = TOY.paper) {
  const g = new THREE.Group();
  const c = block(w, h, 0.05, color, 0.04);
  g.add(c);
  g.userData.anchor = new THREE.Vector3(0, 0, 0.05);
  return g;
}

export function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.08;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setClearColor(0x000000, 0);
  return r;
}
export function makeStage() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf7ff, 0xc59c73, 1.25));
  const key = new THREE.DirectionalLight(0xffefcf, 2.5);
  key.position.set(-6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.5, far: 40 });
  key.shadow.normalBias = 0.03;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0xc4e9fa, 0.7);
  fill.position.set(6, 5, -5);
  scene.add(key, fill);
  return scene;
}

/**
 * Mount a scene definition into a canvas with DOM labels on top.
 * def: { build(api) -> { tick?(t,dt), pick?(obj,api), camera?: {pos,target,fov} }, labels? }
 * Labels are DOM, never geometry (the product's rule): api.label(obj|vec3, text, cls)
 */
export function mount(host, def, { live = true, demo = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "toy-cv";
  const layer = document.createElement("div");
  layer.className = "toy-labels";
  host.append(canvas, layer);
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = makeStage();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const labels = [];
  const pickables = [];
  const tweens = [];
  const api = {
    THREE,
    demo,
    scene,
    camera,
    host,
    add: (...o) => scene.add(...o),
    label(target, text, cls = "", onClick) {
      const el = document.createElement(onClick ? "button" : "div");
      el.className = "toy-label " + cls;
      el.innerHTML = text;
      if (onClick) {
        el.type = "button";
        el.classList.add("hit");
        el.addEventListener("click", onClick);
      }
      layer.append(el);
      const rec = { target, el, offset: new THREE.Vector3() };
      labels.push(rec);
      return rec;
    },
    pickable(obj, data) {
      obj.userData.pick = data ?? true;
      pickables.push(obj);
      return obj;
    },
    tween(dur, fn, done) {
      tweens.push({ t: 0, dur, fn, done });
    },
    say(text, cls = "") {
      let el = host.querySelector(".toy-say");
      if (!el) {
        el = document.createElement("div");
        el.className = "toy-say";
        el.setAttribute("aria-live", "polite");
        host.append(el);
      }
      el.className = "toy-say " + cls;
      el.innerHTML = text;
      el.hidden = !text;
    },
    ask(text) {
      let el = host.querySelector(".toy-ask");
      if (!el) {
        el = document.createElement("div");
        el.className = "toy-ask";
        host.append(el);
      }
      el.innerHTML = text;
      el.hidden = !text;
    },
    /** Every 3D action has a plain button twin (keyboard, screen readers, no-WebGL). */
    controls(list) {
      let bar = host.querySelector(".toy-bar");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "toy-bar";
        host.append(bar);
      }
      bar.innerHTML = "";
      for (const c of list) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "toy-btn " + (c.cls || "");
        b.innerHTML = c.text;
        b.addEventListener("click", c.onClick);
        bar.append(b);
      }
      return bar;
    },
  };
  const def0 = def.build(api);
  const cam = def0.camera ?? {};
  camera.fov = cam.fov ?? 30;
  const pos = cam.pos ?? [0, 11, 16];
  const tgt = cam.target ?? [0, 0.6, 0];
  camera.position.set(...pos);
  camera.lookAt(...tgt);

  function size() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole diorama in view on narrow screens.
    const base = cam.fov ?? 30;
    camera.fov = camera.aspect < 1.2 ? base * (1.2 / Math.max(0.55, camera.aspect)) ** 0.75 : base;
    camera.updateProjectionMatrix();
  }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = host.clientWidth, h = host.clientHeight;
    for (const l of labels) {
      if (l.target.isVector3) v.copy(l.target);
      else if (l.target.userData?.anchor) v.copy(l.target.userData.anchor).applyMatrix4(l.target.matrixWorld);
      else l.target.getWorldPosition(v);
      v.add(l.offset);
      v.project(camera);
      const hidden = v.z > 1 || l.hidden;
      l.el.style.display = hidden ? "none" : "";
      l.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px)`;
    }
  }
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (e) => {
    if (!def0.pick) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o && !o.userData.pick) o = o.parent;
    if (o) def0.pick(o, api, hits[0]);
  });
  api.pickData = (o) => o.userData.pick;
  size();
  const ro = new ResizeObserver(size);
  ro.observe(host);
  let last = performance.now(), t0 = last, raf = 0, alive = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += reduced ? tw.dur : dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.done?.();
      }
    }
    def0.tick?.(reduced ? 0 : t, dt, api);
    scene.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels();
    if (live) raf = requestAnimationFrame(frame);
  }
  if (live) raf = requestAnimationFrame(frame);
  else frame(performance.now() + 1200);
  return {
    api,
    renderer,
    scene: def0,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      host.innerHTML = "";
    },
  };
}

export const ease = {
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
};
/** Scatter a few garden pieces around the edge, never in the play area. */
export function dress(api, spots) {
  for (const [kind, x, z, s = 1, r = 0] of spots) {
    const o = kind === "tree" ? tree(s) : kind === "bush" ? bush(s) : kind === "lantern" ? lantern() : kind === "flower" ? flower(s === 1 ? TOY.cream : s) : null;
    if (!o) continue;
    o.position.set(x, 0, z);
    o.rotation.y = r;
    api.add(o);
  }
}
