// Scene sketches for the 3D-ification walkthrough. Each gesture has three
// takes; the recommended take of each is playable. Content comes from the
// real first lesson (the coffee photo) or, for tune, from a real tune lesson.
import {
  THREE, TOY, wax, waxOwn, block, ball, blob, disc, cone, torus, capsule, slab, island, tree, bush,
  flower, lantern, fence, path, bunny, bunnyTick, basket, signboard, card, dress, ease,
} from "./kit.js";
import { COFFEE_PHOTO } from "./media.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (api, s, fn) => api.tween(s, () => {}, fn);
function arc(api, obj, from, to, h, dur, done) {
  api.tween(dur, (k) => {
    const e = ease.inOut(k);
    obj.position.lerpVectors(from, to, e);
    obj.position.y += Math.sin(Math.PI * e) * h;
  }, done);
}
function pop(api, obj) {
  const base = obj.scale.clone();
  obj.scale.setScalar(0.001);
  api.tween(0.35, (k) => obj.scale.copy(base).multiplyScalar(Math.max(0.001, ease.back(k))));
}
function plane(size = 1) {
  // A folded paper plane.
  const g = new THREE.Group();
  const geo = new THREE.BufferGeometry();
  const p = [0, 0, 0.9 * size, -0.55 * size, 0.08 * size, -0.5 * size, 0, -0.06 * size, -0.45 * size,
    0, 0, 0.9 * size, 0, -0.06 * size, -0.45 * size, 0.55 * size, 0.08 * size, -0.5 * size];
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: TOY.paper, roughness: 0.6, side: THREE.DoubleSide }));
  m.castShadow = true;
  g.add(m);
  return g;
}
function lighthouse() {
  const g = new THREE.Group();
  const base = disc(0.9, 0.4, TOY.stone);
  base.position.y = 0.2;
  g.add(base);
  const cols = [TOY.white, TOY.red, TOY.white, TOY.red];
  cols.forEach((c, i) => {
    const s = disc(0.62 - i * 0.07, 0.62, c);
    s.position.y = 0.7 + i * 0.6;
    g.add(s);
  });
  const lampMat = waxOwn(TOY.gold, { emissive: 0xffe08a });
  const lamp = disc(0.34, 0.5, 0, lampMat);
  lamp.position.y = 3.3;
  const roof = cone(0.48, 0.5, TOY.ink);
  roof.position.y = 3.8;
  g.add(lamp, roof);
  g.userData.lamp = lampMat;
  g.userData.anchor = V(0, 4.3, 0);
  return g;
}
function mailbox() {
  const g = new THREE.Group();
  const post = disc(0.07, 1.0, TOY.ink);
  post.position.y = 0.5;
  const box = block(0.6, 0.8, 0.45, TOY.mint, 0.14);
  box.position.y = 1.35;
  const slot = block(0.36, 0.05, 0.02, TOY.ink, 0.01);
  slot.position.set(0, 1.55, 0.23);
  g.add(post, box, slot);
  return g;
}
function bird(color = TOY.white) {
  const g = new THREE.Group();
  const body = blob(0.22, 0.18, 0.3, color);
  const head = ball(0.13, color);
  head.position.set(0, 0.12, 0.25);
  const beak = cone(0.04, 0.1, TOY.gold);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.11, 0.39);
  g.add(body, head, beak);
  for (const s of [-1, 1]) {
    const w = blob(0.24, 0.04, 0.14, color);
    w.position.set(s * 0.2, 0.08, 0);
    w.rotation.z = s * 0.4;
    g.add(w);
  }
  return g;
}
function table(w = 3, d = 1.4, h = 0.9, color = TOY.wood) {
  const g = new THREE.Group();
  const top = block(w, 0.14, d, color, 0.05);
  top.position.y = h;
  g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = block(0.12, h, 0.12, TOY.bark, 0.03);
    l.position.set(x * (w / 2 - 0.15), h / 2, z * (d / 2 - 0.15));
    g.add(l);
  }
  return g;
}
function tank(color = TOY.water) {
  const g = new THREE.Group();
  const glass = disc(0.55, 2.2, 0, new THREE.MeshPhysicalMaterial({ color: 0xe8f7fb, transparent: true, opacity: 0.28, roughness: 0.1 }));
  glass.position.y = 1.2;
  glass.castShadow = false;
  const water = disc(0.5, 1, 0, waxOwn(color, { rough: 0.3 }));
  water.position.y = 0.1;
  const base = disc(0.62, 0.12, TOY.ink);
  base.position.y = 0.06;
  const cap = torus(0.56, 0.05, TOY.cream);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 2.3;
  g.add(base, water, glass, cap);
  g.userData.water = water;
  return g;
}
function setLevel(t, frac) {
  const w = t.userData.water;
  const h = Math.max(0.02, 2.1 * frac);
  w.scale.y = h;
  w.position.y = 0.12 + h / 2;
}
function valve(color = TOY.coral) {
  const g = new THREE.Group();
  const post = disc(0.08, 0.7, TOY.ink);
  post.position.y = 0.35;
  const wheel = torus(0.3, 0.06, color);
  wheel.position.y = 0.8;
  wheel.rotation.x = Math.PI / 2.4;
  const hub = ball(0.1, color);
  hub.position.y = 0.8;
  g.add(post, wheel, hub);
  g.userData.wheel = wheel;
  return g;
}
function engine(color = TOY.red) {
  const g = new THREE.Group();
  const body = block(1.2, 0.55, 0.8, color, 0.12);
  body.position.set(-0.05, 0.55, 0);
  const cab = block(0.55, 0.7, 0.78, TOY.blue, 0.1);
  cab.position.set(-0.45, 1.05, 0);
  const roof = block(0.7, 0.1, 0.9, TOY.ink, 0.04);
  roof.position.set(-0.45, 1.45, 0);
  const boiler = disc(0.3, 0.7, TOY.ink);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.set(0.3, 0.95, 0);
  const chimney = disc(0.12, 0.4, TOY.ink);
  chimney.position.set(0.5, 1.35, 0);
  g.add(body, cab, roof, boiler, chimney);
  for (const x of [-0.4, 0.35]) for (const z of [-0.42, 0.42]) {
    const w = disc(0.2, 0.1, TOY.ink);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.24, z);
    g.add(w);
  }
  return g;
}
function wagon(color = TOY.gold) {
  const g = new THREE.Group();
  const bed = block(1.25, 0.5, 0.8, color, 0.1);
  bed.position.y = 0.55;
  const face = block(1.05, 0.34, 0.02, TOY.paper, 0.03);
  face.position.set(0, 0.58, 0.41);
  g.add(bed, face);
  for (const x of [-0.38, 0.38]) for (const z of [-0.42, 0.42]) {
    const w = disc(0.17, 0.1, TOY.ink);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.2, z);
    g.add(w);
  }
  g.userData.anchor = V(0, 0.6, 0.45);
  return g;
}
function track(x0, x1, z) {
  const g = new THREE.Group();
  for (const dz of [-0.32, 0.32]) {
    const r = block(x1 - x0, 0.06, 0.08, TOY.ink, 0.02);
    r.position.set((x0 + x1) / 2, 0.2, z + dz);
    g.add(r);
  }
  for (let x = x0 + 0.2; x < x1; x += 0.55) {
    const s = block(0.2, 0.05, 0.95, TOY.bark, 0.02);
    s.position.set(x, 0.13, z);
    g.add(s);
  }
  return g;
}
function easel(tex) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = block(0.08, 3.1, 0.08, TOY.bark, 0.03);
    leg.position.set(s * 1.25, 1.5, 0);
    leg.rotation.z = s * 0.06;
    g.add(leg);
  }
  const back = block(0.08, 2.9, 0.08, TOY.bark, 0.03);
  back.position.set(0, 1.4, -0.55);
  back.rotation.x = -0.3;
  g.add(back);
  const board = block(3.0, 2.1, 0.1, TOY.wood, 0.05);
  board.position.set(0, 2.1, 0.05);
  const shelf = block(2.8, 0.1, 0.35, TOY.bark, 0.03);
  shelf.position.set(0, 1.0, 0.15);
  g.add(board, shelf);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  photo.position.set(0, 2.1, 0.115);
  g.add(photo);
  g.userData.photo = photo;
  return g;
}
function cameraProp() {
  const g = new THREE.Group();
  const body = block(0.9, 0.6, 0.45, TOY.ink, 0.1);
  const lens = disc(0.22, 0.3, TOY.dark);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.3;
  const ring = torus(0.22, 0.04, TOY.gold);
  ring.position.z = 0.45;
  const top = block(0.3, 0.15, 0.3, TOY.coral, 0.05);
  top.position.set(-0.2, 0.36, 0);
  const flashMat = waxOwn(TOY.cream, { emissive: 0 });
  const flash = block(0.2, 0.12, 0.05, 0, 0.03, flashMat);
  flash.position.set(0.25, 0.2, 0.24);
  g.add(body, lens, ring, top, flash);
  g.userData.flash = flashMat;
  return g;
}
function magnifier() {
  const g = new THREE.Group();
  const rim = torus(0.42, 0.07, TOY.gold);
  const glass = disc(0.4, 0.02, 0, new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35, roughness: 0.05 }));
  glass.rotation.x = Math.PI / 2;
  const handle = capsule(0.07, 0.55, TOY.bark);
  handle.position.set(0.45, -0.45, 0);
  handle.rotation.z = Math.PI / 4;
  g.add(rim, glass, handle);
  return g;
}
function pipe(api, a, b, color = TOY.sky2, lift = 0.8) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y += lift;
  const curve = new THREE.CatmullRomCurve3([a, a.clone().setY(a.y + 0.25), mid, b.clone().setY(b.y + 0.25), b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.09, 10), wax(color));
  m.castShadow = true;
  m.userData.curve = curve;
  api.add(m);
  return m;
}
function tap(color = TOY.sky2) {
  const g = new THREE.Group();
  const barrel = disc(0.45, 0.9, color);
  barrel.position.y = 0.45;
  const top = torus(0.45, 0.05, TOY.cream);
  top.rotation.x = Math.PI / 2;
  top.position.y = 0.9;
  const spout = disc(0.1, 0.5, TOY.ink);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(0.55, 0.55, 0);
  g.add(barrel, top, spout);
  g.userData.anchor = V(0, 1.35, 0);
  return g;
}
function pot() {
  const g = new THREE.Group();
  const body = disc(0.42, 0.55, TOY.coral);
  body.position.y = 0.28;
  const soil = disc(0.38, 0.04, TOY.soil);
  soil.position.y = 0.55;
  const bud = new THREE.Group();
  const stem = disc(0.03, 0.5, TOY.leaf);
  stem.position.y = 0.25;
  const head = flower(TOY.pink);
  head.scale.setScalar(2.2);
  head.position.y = 0.42;
  bud.add(stem, head);
  bud.position.y = 0.55;
  bud.scale.setScalar(0.25);
  g.add(body, soil, bud);
  g.userData.bud = bud;
  g.userData.anchor = V(0, 1.45, 0);
  return g;
}
function noticeBoard(w = 5.6, h = 3.2) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = disc(0.09, h + 1.1, TOY.bark);
    p.position.set(s * (w / 2 - 0.2), (h + 1.1) / 2, -0.05);
    g.add(p);
  }
  const board = block(w, h, 0.14, TOY.wood, 0.08);
  board.position.y = 0.9 + h / 2;
  const roof = block(w + 0.5, 0.14, 0.7, TOY.coral, 0.05);
  roof.position.set(0, 1.1 + h, 0.05);
  const paper = block(w - 0.7, h - 0.5, 0.02, TOY.paper, 0.02);
  paper.position.set(0, 0.9 + h / 2, 0.08);
  g.add(board, roof, paper);
  return g;
}
function workbench() {
  const g = table(3.2, 1.4, 1.0, TOY.wood);
  const saw = block(0.7, 0.05, 0.25, TOY.stone, 0.02);
  saw.position.set(-1.0, 1.1, 0.2);
  const jar = disc(0.14, 0.3, TOY.mint);
  jar.position.set(1.2, 1.22, -0.3);
  g.add(saw, jar);
  return g;
}
function hammer() {
  const g = new THREE.Group();
  const h = capsule(0.05, 0.6, TOY.bark);
  h.position.y = -0.3;
  const head = block(0.4, 0.18, 0.18, TOY.ink, 0.05);
  g.add(h, head);
  return g;
}
function postcard(color = TOY.gold) {
  const g = new THREE.Group();
  const frame = block(0.8, 0.6, 0.06, color, 0.04);
  const pic = block(0.66, 0.46, 0.02, TOY.sky, 0.02);
  pic.position.z = 0.035;
  const sun = ball(0.07, TOY.gold);
  sun.position.set(0.18, 0.1, 0.05);
  const hill = blob(0.3, 0.12, 0.02, TOY.leafLight);
  hill.position.set(-0.08, -0.14, 0.05);
  g.add(frame, pic, sun, hill);
  return g;
}
function shelfUnit() {
  const g = new THREE.Group();
  for (const y of [1.3, 2.3]) {
    const s = block(3.2, 0.12, 0.6, TOY.wood, 0.04);
    s.position.y = y;
    g.add(s);
  }
  for (const x of [-1.55, 1.55]) {
    const p = block(0.12, 2.6, 0.6, TOY.bark, 0.04);
    p.position.set(x, 1.3, 0);
    g.add(p);
  }
  return g;
}
function yard(api, w = 12, d = 8.5, spots) {
  api.add(island(w, d));
  dress(api, spots ?? [
    ["tree", -w / 2 + 0.9, -d / 2 + 1.1, 1],
    ["tree", w / 2 - 0.9, -d / 2 + 1.2, 0.9],
    ["bush", -w / 2 + 0.8, d / 2 - 1.0, 0.9],
    ["lantern", w / 2 - 0.7, d / 2 - 1.0],
    ["flower", -w / 2 + 2.2, 0.4],
    ["flower", w / 2 - 2.0, -0.3],
  ]);
}

const LESSON = {
  ask: ["说说这张照片里有什么。", "勺子在杯子的哪一边？", "帮我看看这张照片。"],
  answers: {
    "说说这张照片里有什么。": "一杯咖啡放在红色碟子上，旁边有把小勺。",
    "勺子在杯子的哪一边？": "勺子在杯子的右下方，靠在碟子上。",
    "帮我看看这张照片。": "这是一张咖啡的照片，看起来挺好喝。",
  },
  sortQ: "光看照片，答得出来吗？",
  sort: [
    ["杯子是什么颜色？", "yes", "颜色看得到。"],
    ["咖啡甜不甜？", "no", "味道看不到。"],
    ["勺子在哪一边？", "yes", "勺子看得到。"],
    ["这是哪家店？", "no", "照片里没有店名。"],
    ["碟子是什么颜色？", "yes", "碟子看得到。"],
    ["咖啡多少钱？", "no", "照片里没有价钱。"],
  ],
  pieces: [
    ["p-look", "看这张照片，"],
    ["p-cup", "杯子里"],
    ["p-foam", "有没有泡沫？"],
    ["p-all", "说说整张照片", "这块又变成问整张图了。"],
    ["p-long", "写得越长越好", "这块会让它说一大段。"],
  ],
  answer: [
    "这是一杯浓缩咖啡，放在红色的碟子上。",
    "勺子在杯子的右下方，靠在碟子边上。",
    "咖啡表面有一层浅棕色的泡沫。",
    "看起来是在一家咖啡馆里拍的。",
  ],
};

let coffeeTex = null;
function coffee() {
  if (!coffeeTex) {
    coffeeTex = new THREE.TextureLoader().load(COFFEE_PHOTO);
    coffeeTex.colorSpace = THREE.SRGBColorSpace;
  }
  return coffeeTex;
}

export const SCENES = {
  // ───────────── 选一个 ─────────────
  "choose-fork": {
    build(api) {
      yard(api, 12, 9);
      const fork = [0, 2.6];
      const ends = [[-3.6, -2.6], [0, -3.1], [3.6, -2.6]];
      api.add(path([[0, 3.6], fork]));
      for (const e of ends) api.add(path([fork, [e[0] * 0.5, 0.2], e]));
      const b = bunny(0.95);
      b.position.set(0, 0, 2.7);
      api.add(b);
      const signs = ends.map(([x, z], i) => {
        const s = signboard(2.3, 1.05, [TOY.mint, TOY.sky2, TOY.gold][i], 0.7);
        s.position.set(x, 0, z - 0.4);
        s.rotation.y = -x * 0.06;
        api.add(s);
        api.pickable(s, { i });
        api.label(s, LESSON.ask[i], "sign", () => choose(i));
        return s;
      });
      api.ask("你想知道勺子在杯子哪一边。哪句最能问到？");
      let busy = false, walk = null;
      function choose(i) {
        if (busy) return;
        busy = true;
        const [x, z] = ends[i];
        const from = b.position.clone();
        const mid = V(x * 0.5, 0, 0.2);
        const to = V(x * 0.92, 0, z + 0.6);
        b.rotation.y = Math.PI;
        api.say("小兔子出发了：它替你把这句问法送出去。");
        signs[i].userData.face.material = waxOwn(TOY.paper, { emissive: 0xfff0b8 });
        walk = 0;
        api.tween(0.9, (k) => { b.position.lerpVectors(from, mid, ease.inOut(k)); walk = k; }, () =>
          api.tween(0.9, (k) => { b.position.lerpVectors(mid, to, ease.inOut(k)); walk = k; }, () => {
            walk = null;
            b.rotation.y = 0;
            api.say("你选的是：「" + LESSON.ask[i] + "」<br>它会被真的发出去——下一步看 AI 怎么答。", "ok");
          }));
      }
      api.controls(LESSON.ask.map((t, i) => ({ text: t, onClick: () => choose(i) })).concat([{ text: "↺ 重来", cls: "ghost", onClick: () => { busy = false; b.position.set(0, 0, 2.7); b.rotation.y = 0; signs.forEach((s) => (s.userData.face.material = wax(TOY.paper))); api.say(""); } }]));
      if (api.demo) {
        b.position.set(0, 0, 0.3);
        b.rotation.y = Math.PI * 0.95;
        signs[1].userData.face.material = waxOwn(TOY.paper, { emissive: 0xfff0b8 });
        api.say("小兔子出发了：它替你把这句问法送出去。");
      }
      return {
        camera: { pos: [0, 9.2, 13.8], target: [0, 0.9, -0.3] },
        pick: (o) => choose(o.userData.pick.i),
        tick: (t) => bunnyTick(b, t, { hop: walk == null ? 0 : (walk * 3) % 1 }),
      };
    },
  },
  "choose-buzzer": {
    build(api) {
      yard(api, 12, 8.5);
      const desk = table(6.2, 1.6, 1.0, TOY.coral);
      desk.position.set(0, 0, 0.6);
      api.add(desk);
      const cols = [TOY.red, TOY.gold, TOY.sky2];
      [-2, 0, 2].forEach((x, i) => {
        const base = disc(0.5, 0.18, TOY.ink);
        base.position.set(x, 1.15, 0.6);
        const dome = blob(0.42, 0.3, 0.42, cols[i]);
        dome.position.set(x, 1.26, 0.6);
        api.add(base, dome);
        api.label(V(x, 0.55, 1.5), LESSON.ask[i], "sign");
      });
      const b = bunny(0.9);
      b.position.set(0, 0, -1.4);
      api.add(b);
      const sc = block(3.4, 1.3, 0.14, TOY.ink, 0.1);
      sc.position.set(0, 3.1, -2.6);
      api.add(sc);
      api.label(V(0, 3.1, -2.5), "哪句最能问到？", "screen");
      return { camera: { pos: [0, 7.6, 12.8], target: [0, 1.4, -0.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "choose-rings": {
    build(api) {
      yard(api, 12, 8.5);
      [-3, 0, 3].forEach((x, i) => {
        const peg = disc(0.12, 1.3, [TOY.mint, TOY.sky2, TOY.gold][i]);
        peg.position.set(x, 0.65, -1.6);
        const pad = disc(0.55, 0.1, TOY.cream);
        pad.position.set(x, 0.05, -1.6);
        api.add(peg, pad);
        api.label(V(x, 1.9, -1.6), LESSON.ask[i], "sign");
      });
      const ring1 = torus(0.36, 0.07, TOY.coral);
      ring1.position.set(-0.3, 1.9, 0.6);
      ring1.rotation.x = 1.2;
      const ring2 = torus(0.36, 0.07, TOY.coral);
      ring2.position.set(3, 0.25, -1.6);
      ring2.rotation.x = Math.PI / 2;
      api.add(ring1, ring2);
      const b = bunny(0.95);
      b.position.set(0, 0, 2.2);
      api.add(b);
      return { camera: { pos: [0, 8.2, 13.5], target: [0, 1, -0.6] }, tick: (t) => bunnyTick(b, t) };
    },
  },

  // ───────────── 发出去 ─────────────
  "send-plane": {
    build(api) {
      yard(api, 13, 8.5, [["tree", -5.4, -2.4, 0.9], ["bush", -5.3, 2.5, 0.9], ["flower", -3.2, 0.2], ["flower", 1.6, 2.4], ["lantern", 5.6, 2.5]]);
      const b = bunny(0.95);
      b.position.set(-3.6, 0, 1.4);
      b.rotation.y = 0.5;
      api.add(b);
      const lh = lighthouse();
      lh.position.set(3.6, 0, -2.0);
      api.add(lh);
      api.label(lh, "AI", "tag");
      const board = signboard(3.2, 1.3, TOY.wood, 0.4);
      board.position.set(-0.2, 0, -2.4);
      api.add(board);
      const answerLabel = api.label(board, "（回答会贴在这里）", "sign dim");
      const pl = plane(1.1);
      pl.visible = false;
      api.add(pl);
      const reqLabel = api.label(V(-3.6, 2.4, 1.4), "勺子在杯子的哪一边？", "bubble");
      let flying = false, glow = 0, cheer = 0;
      function send() {
        if (flying) return;
        flying = true;
        reqLabel.hidden = true;
        answerLabel.el.innerHTML = "（回答会贴在这里）";
        answerLabel.el.classList.add("dim");
        pl.visible = true;
        const a = V(-3.3, 1.4, 1.5), top = V(3.4, 3.4, -1.8);
        api.say("纸飞机飞过去的这几秒，就是 AI 在想的时间。");
        api.tween(2.2, (k) => {
          const e = ease.inOut(k);
          pl.position.lerpVectors(a, top, e);
          pl.position.y += Math.sin(Math.PI * e) * 1.6;
          pl.lookAt(top);
          pl.rotation.z = Math.sin(k * 12) * 0.2;
        }, () => {
          glow = 1;
          api.say("灯塔亮了：回答来了。");
          const back0 = V(3.2, 3.3, -1.6), back1 = V(-0.2, 1.9, -2.2);
          api.tween(1.6, (k) => {
            const e = ease.inOut(k);
            pl.position.lerpVectors(back0, back1, e);
            pl.position.y += Math.sin(Math.PI * e) * 0.8;
            pl.lookAt(back1);
          }, () => {
            pl.visible = false;
            answerLabel.el.classList.remove("dim");
            answerLabel.el.innerHTML = LESSON.answers["勺子在杯子的哪一边？"];
            api.say("回答贴在公告栏上了。下一步：在里面找出说勺子的那句。", "ok");
            cheer = 1;
            wait(api, 1.4, () => { cheer = 0; flying = false; reqLabel.hidden = false; });
          });
        });
      }
      api.controls([{ text: "发出去", cls: "go", onClick: send }]);
      api.pickable(b, {});
      if (api.demo) {
        reqLabel.hidden = true;
        pl.visible = true;
        pl.position.set(-0.6, 3.3, 0.6);
        pl.lookAt(3.4, 3.4, -1.8);
        for (let n = 1; n <= 7; n++) {
          const k = n / 8;
          const dot = ball(0.05, TOY.white);
          dot.position.set(-3.3 + (-0.6 + 3.3) * k, 1.4 + (3.3 - 1.4) * k + Math.sin(Math.PI * k) * 0.5, 1.5 + (0.6 - 1.5) * k);
          dot.castShadow = false;
          api.add(dot);
        }
        api.say("纸飞机飞过去的这几秒，就是 AI 在想的时间。");
      }
      return {
        camera: { pos: [0, 8.4, 14], target: [0, 1.2, -0.4] },
        pick: send,
        tick: (t, dt) => {
          glow = Math.max(0, glow - dt * 0.5);
          lh.userData.lamp.emissiveIntensity = 0.5 + glow * 1.6 + Math.sin(t * 3) * 0.1;
          bunnyTick(b, t, { cheer });
        },
      };
    },
  },
  "send-pigeon": {
    build(api) {
      yard(api, 12, 8.5);
      const mb = mailbox();
      mb.position.set(-1.6, 0, 0.4);
      api.add(mb);
      const b = bunny(0.9);
      b.position.set(-3.4, 0, 1.4);
      b.rotation.y = 0.6;
      api.add(b);
      const env = block(0.5, 0.34, 0.04, TOY.paper, 0.03);
      env.position.set(-1.6, 1.9, 0.5);
      env.rotation.z = 0.2;
      api.add(env);
      const bd = bird();
      bd.position.set(1.2, 2.7, -0.6);
      bd.rotation.y = -2.2;
      api.add(bd);
      const env2 = block(0.34, 0.24, 0.04, TOY.cream, 0.02);
      env2.position.set(1.25, 2.5, -0.55);
      api.add(env2);
      api.label(V(1.2, 3.4, -0.6), "回信", "tag");
      return { camera: { pos: [0, 6.6, 10.8], target: [0, 1.4, -0.3] }, tick: (t) => { bunnyTick(b, t); bd.position.y = 2.7 + Math.sin(t * 3) * 0.1; } };
    },
  },
  "send-balloon": {
    build(api) {
      yard(api, 12, 8.5);
      const b = bunny(0.95);
      b.position.set(-1.8, 0, 1.4);
      api.add(b);
      const bl = ball(0.6, TOY.coral);
      bl.scale.set(0.6, 0.72, 0.6);
      bl.position.set(0.6, 4.2, -0.4);
      api.add(bl);
      const curve = new THREE.CatmullRomCurve3([V(0.6, 3.5, -0.4), V(0.4, 2.8, -0.3), V(0.7, 2.2, -0.3)]);
      const str = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.015, 5), wax(TOY.ink));
      api.add(str);
      const letter = block(0.55, 0.36, 0.04, TOY.paper, 0.03);
      letter.position.set(0.7, 2.0, -0.3);
      api.add(letter);
      api.label(V(0.7, 2.0, -0.2), "勺子在哪边？", "tag");
      return { camera: { pos: [0, 6.4, 10.6], target: [0, 2.0, -0.4] }, tick: (t) => { bunnyTick(b, t); bl.position.y = 4.2 + Math.sin(t * 1.5) * 0.1; } };
    },
  },

  // ───────────── 点一句 ─────────────
  "find-board": {
    build(api) {
      yard(api, 12, 8, [["tree", -5.1, -2.2, 0.9], ["tree", 5.1, -2.1, 0.85], ["flower", -4.4, 2.2], ["flower", 4.2, 2.4], ["bush", -2.8, 2.9, 0.7]]);
      const nb = noticeBoard(6.2, 3.4);
      nb.position.set(0, 0, -1.4);
      api.add(nb);
      const mg = magnifier();
      mg.position.set(3.6, 3.2, -0.6);
      mg.rotation.y = -0.3;
      api.add(mg);
      api.ask("点出它说勺子的那一句");
      const lines = LESSON.answer.map((t, i) => {
        const y = 3.6 - i * 0.62;
        const l = api.label(V(0, y, -1.2), t, "line", () => pick(i, y));
        return l;
      });
      let done = false;
      function pick(i, y) {
        const to = V(-1.5 + i * 0.3, y, -0.7);
        const from = mg.position.clone();
        api.tween(0.5, (k) => mg.position.lerpVectors(from, to, ease.out(k)));
        lines.forEach((l, j) => l.el.classList.toggle("on", j === i));
        if (i === 1) {
          api.say("找到了！这句说的是勺子在哪边。", "ok");
          done = true;
        } else api.say("这句没说勺子。再找找。", "no");
      }
      api.controls([{ text: "↺ 重来", cls: "ghost", onClick: () => { lines.forEach((l) => l.el.classList.remove("on")); api.say(""); done = false; } }]);
      if (api.demo) pick(1, 3.6 - 0.62);
      return { camera: { pos: [0, 7.2, 13.4], target: [0, 2.0, -1.2] }, tick: (t) => { mg.rotation.z = Math.sin(t * 1.4) * 0.08; } };
    },
  },
  "find-line": {
    build(api) {
      yard(api, 12, 8);
      for (const s of [-1, 1]) {
        const p = disc(0.1, 3.0, TOY.bark);
        p.position.set(s * 4.4, 1.5, -1.2);
        api.add(p);
      }
      const curve = new THREE.CatmullRomCurve3([V(-4.4, 2.9, -1.2), V(0, 2.55, -1.2), V(4.4, 2.9, -1.2)]);
      api.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.025, 6), wax(TOY.ink)));
      LESSON.answer.forEach((t, i) => {
        const x = -3.3 + i * 2.2;
        const c = card(1.9, 1.25, i === 1 ? TOY.gold : TOY.paper);
        c.position.set(x, 1.95, -1.15);
        c.rotation.z = (i - 1.5) * 0.04;
        api.add(c);
        const clip = block(0.12, 0.3, 0.1, TOY.coral, 0.03);
        clip.position.set(x, 2.62, -1.12);
        api.add(clip);
        api.label(V(x, 1.95, -1.05), ["一杯浓缩咖啡…", "勺子在右下方…", "表面有泡沫…", "像在咖啡馆…"][i], "mini");
      });
      return { camera: { pos: [0, 5.2, 11.8], target: [0, 1.9, -1.2] } };
    },
  },
  "find-mole": {
    build(api) {
      yard(api, 12, 8.5);
      const spots = [[-3, -1.6], [0, -1.8], [3, -1.6], [-1.5, 0.8], [1.5, 0.8]];
      const texts = ["它说勺子在右边", "看起来很好喝", "这家店很有名", "泡沫是浅棕色", "应该是早上拍的"];
      spots.forEach(([x, z], i) => {
        const hole = disc(0.62, 0.06, TOY.soil);
        hole.position.set(x, 0.03, z);
        const rim = torus(0.62, 0.1, TOY.grassEdge);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, 0.08, z);
        api.add(hole, rim);
        if (i !== 3) {
          const mole = blob(0.42, 0.5, 0.42, TOY.bark);
          mole.position.set(x, 0.35, z);
          const nose = ball(0.08, TOY.pink);
          nose.position.set(x, 0.48, z + 0.4);
          api.add(mole, nose);
          api.label(V(x, 1.3, z), texts[i], "tag");
        }
      });
      const mallet = new THREE.Group();
      const head = disc(0.28, 0.6, TOY.red);
      head.rotation.z = Math.PI / 2;
      const h = capsule(0.06, 1.0, TOY.wood);
      h.position.set(0, -0.6, 0);
      mallet.add(head, h);
      mallet.position.set(3.9, 1.8, 1.4);
      mallet.rotation.z = 0.7;
      api.add(mallet);
      return { camera: { pos: [0, 8.6, 12.4], target: [0, 0.6, -0.4] } };
    },
  },

  // ───────────── 分一分 ─────────────
  "sort-throw": {
    build(api) {
      yard(api, 12, 9);
      const cols = [TOY.mint, TOY.coral];
      const bins = [["yes", "答得出"], ["no", "答不出"]];
      const baskets = bins.map(([id, name], i) => {
        const bk = basket(cols[i]);
        bk.position.set(i ? 2.3 : -2.3, 0, -1.8);
        api.add(bk);
        api.pickable(bk, { id });
        api.label(bk, name, "tag big", () => throwTo(id)).offset.set(0, 1.35, 0);
        bk.userData.balls = 0;
        return bk;
      });
      const crate = block(1.1, 0.6, 0.8, TOY.wood, 0.1);
      crate.position.set(-1.6, 0.3, 2.4);
      api.add(crate);
      for (let n = 0; n < 4; n++) {
        const c = block(0.7, 0.04, 0.5, TOY.paper, 0.02);
        c.position.set(-1.6 + (n % 2) * 0.08, 0.64 + n * 0.05, 2.4);
        c.rotation.y = n * 0.2;
        api.add(c);
      }
      const b = bunny(0.95);
      b.position.set(0, 0, 1.9);
      b.rotation.y = Math.PI;
      api.add(b);
      api.ask(LESSON.sortQ);
      let idx = 0, busy = false, shake = 0, cheer = 0;
      const itemLabel = api.label(V(0, 2.3, 2.0), "", "card");
      const ballMesh = ball(0.22, TOY.gold);
      ballMesh.visible = false;
      api.add(ballMesh);
      function show() {
        if (idx >= LESSON.sort.length) {
          itemLabel.el.innerHTML = "全部分完！";
          api.say("看得见的，才问得准。看不见的，它只能说不知道，或者猜。", "ok");
          return;
        }
        itemLabel.el.innerHTML = LESSON.sort[idx][0];
      }
      function throwTo(id) {
        if (busy || idx >= LESSON.sort.length) return;
        busy = true;
        const [, right, why] = LESSON.sort[idx];
        const bk = baskets.find((x) => x.userData.pick.id === id);
        ballMesh.visible = true;
        ballMesh.material = waxOwn(right === "yes" ? TOY.gold : TOY.gold);
        const from = V(0, 1.6, 1.6), to = bk.position.clone().setY(0.9);
        arc(api, ballMesh, from, to, 2.2, 0.8, () => {
          if (id === right) {
            ballMesh.visible = false;
            const kept = ball(0.16, TOY.gold);
            kept.position.set(bk.position.x + (bk.userData.balls % 3 - 1) * 0.22, 0.72, bk.position.z + (Math.floor(bk.userData.balls / 3) - 0.5) * 0.2);
            bk.userData.balls++;
            api.add(kept);
            pop(api, kept);
            api.say("对！" + why, "ok");
            cheer = 1;
            idx++;
            wait(api, 1.0, () => { cheer = 0; busy = false; show(); });
          } else {
            api.say("不对哦：" + why + " 再选一次。", "no");
            shake = 1;
            arc(api, ballMesh, to, V(0, 0.3, 1.2), 1.2, 0.6, () => { ballMesh.visible = false; shake = 0; busy = false; });
          }
        });
      }
      show();
      api.controls(bins.map(([id, name]) => ({ text: name, onClick: () => throwTo(id) })).concat([{ text: "↺ 重来", cls: "ghost", onClick: () => { idx = 0; api.say(""); show(); } }]));
      if (api.demo) {
        for (const [bk, n] of [[baskets[0], 2], [baskets[1], 1]]) for (let q = 0; q < n; q++) {
          const kept = ball(0.16, TOY.gold);
          kept.position.set(bk.position.x + (q - 0.5) * 0.24, 0.72, bk.position.z);
          api.add(kept);
        }
        idx = 3;
        show();
        ballMesh.visible = true;
        ballMesh.position.set(1.3, 2.9, -0.2);
        api.say("对！照片里没有店名。", "ok");
      }
      return {
        camera: { pos: [0, 8.2, 11.4], target: [0, 1.0, -0.1] },
        pick: (o) => throwTo(o.userData.pick.id),
        tick: (t) => bunnyTick(b, t, { shake, cheer }),
      };
    },
  },
  "sort-belt": {
    build(api) {
      yard(api, 12, 8.5);
      const belt = slab(7.5, 1.3, 0.3, 0.3, TOY.ink);
      belt.position.set(-0.8, 0.9, 0.2);
      api.add(belt);
      for (let x = -4.2; x <= 2.8; x += 0.7) {
        const r = disc(0.14, 1.34, TOY.stone);
        r.rotation.x = Math.PI / 2;
        r.position.set(x, 0.72, 0.2);
        api.add(r);
      }
      for (const x of [-4.3, 2.7]) {
        const leg = block(0.2, 0.75, 1.1, TOY.bark, 0.04);
        leg.position.set(x, 0.38, 0.2);
        api.add(leg);
      }
      ["咖啡甜不甜？", "杯子是什么颜色？", "这是哪家店？"].forEach((t, i) => {
        const bx = block(0.9, 0.55, 0.8, [TOY.cream, TOY.gold, TOY.cream][i], 0.1);
        bx.position.set(-3.2 + i * 1.9, 1.35, 0.2);
        api.add(bx);
        api.label(V(-3.2 + i * 1.9, 2.1, 0.2), t, "tag");
      });
      [["答得出", TOY.mint, -1.2], ["答不出", TOY.coral, 1.2]].forEach(([n, c, z]) => {
        const chute = block(1.2, 0.3, 1.1, c, 0.1);
        chute.position.set(4.0, 0.5, z);
        chute.rotation.z = -0.3;
        api.add(chute);
        api.label(V(4.3, 1.4, z), n, "tag");
      });
      const b = bunny(0.85);
      b.position.set(1.2, 0, -2.2);
      api.add(b);
      return { camera: { pos: [0, 8.2, 12.6], target: [0, 1.0, -0.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "sort-stamp": {
    build(api) {
      yard(api, 12, 8.5);
      const desk = table(5.2, 2.2, 1.0, TOY.wood);
      desk.position.set(0, 0, 0.2);
      api.add(desk);
      const paper = block(1.8, 0.03, 1.2, TOY.paper, 0.02);
      paper.position.set(0, 1.1, 0.3);
      paper.rotation.y = 0.08;
      api.add(paper);
      api.label(V(0, 1.2, 0.3), "咖啡甜不甜？", "sign");
      [["答得出", TOY.mint, -1.8], ["答不出", TOY.red, 1.8]].forEach(([n, c, x]) => {
        const base = block(0.7, 0.2, 0.5, c, 0.06);
        base.position.set(x, 1.2, 0.5);
        const handle = capsule(0.12, 0.35, TOY.bark);
        handle.position.set(x, 1.6, 0.5);
        api.add(base, handle);
        api.label(V(x, 2.2, 0.5), n, "tag");
      });
      const b = bunny(0.9);
      b.position.set(0, 0, -1.8);
      api.add(b);
      return { camera: { pos: [0, 7.8, 12.4], target: [0, 1.2, -0.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },

  // ───────────── 连一连 ─────────────
  "connect-pipes": {
    build(api) {
      yard(api, 13, 9, [["tree", -5.6, -2.6, 0.9], ["tree", 5.6, -2.6, 0.9], ["flower", -5.0, 3.0], ["lantern", 5.7, 3.0]]);
      const zs = [-2.2, 0, 2.2];
      const taps = LESSON.ask.map((t, i) => {
        const tp = tap([TOY.mint, TOY.sky2, TOY.gold][i]);
        tp.position.set(-3.8, 0, zs[i]);
        api.add(tp);
        api.pickable(tp, { side: "L", i });
        api.label(tp, t, "tag", () => pickL(i));
        return tp;
      });
      const order = [2, 0, 1]; // pots show the answers in a shuffled order
      const pots = order.map((qi, j) => {
        const p = pot();
        p.position.set(3.8, 0, zs[j]);
        api.add(p);
        api.pickable(p, { side: "R", j, qi });
        api.label(p, LESSON.answers[LESSON.ask[qi]], "tag", () => pickR(j));
        return p;
      });
      const b = bunny(0.8);
      b.position.set(-4.6, 0, 3.3);
      b.rotation.y = 0.5;
      api.add(b);
      api.ask("三句问法，各得到哪个回答？先点左边一句，再点右边一个回答。");
      let sel = null, cheer = 0;
      const links = new Map();
      function pickL(i) {
        sel = i;
        api.say("好，这句的水要流到哪个回答？");
      }
      function pickR(j) {
        if (sel == null) return api.say("先点左边的一句问法。");
        const old = links.get(sel);
        if (old) api.scene.remove(old.mesh);
        for (const [k, v] of links) if (v.j === j) { api.scene.remove(v.mesh); links.delete(k); }
        const a = taps[sel].position.clone().add(V(0.6, 0.55, 0));
        const bpos = pots[j].position.clone().add(V(-0.3, 0.45, 0));
        const mesh = pipe(api, a, bpos, TOY.sky2, 1.0);
        links.set(sel, { j, mesh });
        sel = null;
        api.say(links.size < 3 ? "接好一根。" : "三根都接好了。拧开水龙头试试。");
      }
      const drops = [];
      function flow() {
        if (links.size < 3) return api.say("三根水管都接好，才能放水。");
        let right = 0;
        for (const [qi, { j, mesh }] of links) {
          const ok = pots[j].userData.pick.qi === qi;
          if (ok) right++;
          for (let n = 0; n < 6; n++) {
            const d = ball(0.08, TOY.water);
            api.add(d);
            drops.push({ d, curve: mesh.userData.curve, t: -n * 0.12, ok, pot: pots[j] });
          }
        }
        cheer = right === 3 ? 1 : 0;
        api.say(right === 3 ? "三盆花都开了：每个回答，都是从它那句问法来的。" : `开了 ${right} 盆。没开的那盆，水管接错了。`, right === 3 ? "ok" : "no");
      }
      api.controls([{ text: "放水", cls: "go", onClick: flow }, { text: "↺ 重来", cls: "ghost", onClick: () => { for (const [, v] of links) api.scene.remove(v.mesh); links.clear(); pots.forEach((p) => p.userData.bud.scale.setScalar(0.25)); api.say(""); cheer = 0; } }]);
      if (api.demo) {
        for (const qi of [0, 1, 2]) { pickL(qi); pickR(order.indexOf(qi)); }
        pots.forEach((p) => p.userData.bud.scale.setScalar(1));
        for (const [, { mesh }] of links) for (const t of [0.3, 0.55, 0.8]) {
          const d = ball(0.09, TOY.water);
          d.position.copy(mesh.userData.curve.getPoint(t));
          api.add(d);
        }
        api.say("三盆花都开了：每个回答，都是从它那句问法来的。", "ok");
      }
      return {
        camera: { pos: [0, 10.4, 12.0], target: [0, 0.6, 0.3] },
        pick: (o) => (o.userData.pick.side === "L" ? pickL(o.userData.pick.i) : pickR(o.userData.pick.j)),
        tick: (t, dt) => {
          bunnyTick(b, t, { cheer });
          for (let i = drops.length - 1; i >= 0; i--) {
            const r = drops[i];
            r.t += dt * 0.7;
            if (r.t < 0) { r.d.visible = false; continue; }
            r.d.visible = true;
            if (r.t >= 1) {
              api.scene.remove(r.d);
              drops.splice(i, 1);
              if (r.ok) {
                const bud = r.pot.userData.bud;
                bud.scale.setScalar(Math.min(1, bud.scale.x + 0.14));
              }
              continue;
            }
            r.d.position.copy(r.curve.getPoint(r.t));
          }
        },
      };
    },
  },
  "connect-board": {
    build(api) {
      yard(api, 12, 8.5);
      const panel = block(6.4, 3.4, 0.3, TOY.ink, 0.15);
      panel.position.set(0, 2.2, -1.6);
      api.add(panel);
      const L = [3.2, 2.2, 1.2], R = [3.2, 2.2, 1.2];
      const colors = [TOY.gold, TOY.coral, TOY.mint];
      L.forEach((y, i) => {
        const s = disc(0.16, 0.1, TOY.cream);
        s.rotation.x = Math.PI / 2;
        s.position.set(-2.2, y, -1.42);
        api.add(s);
        api.label(V(-3.3, y, -1.4), ["说说这张照片", "勺子在哪边？", "帮我看看"][i], "tag");
      });
      R.forEach((y, i) => {
        const s = disc(0.16, 0.1, TOY.cream);
        s.rotation.x = Math.PI / 2;
        s.position.set(2.2, y, -1.42);
        api.add(s);
        const bulb = ball(0.16, i === 1 ? TOY.gold : TOY.stone);
        if (i === 1) bulb.material = waxOwn(TOY.gold, { emissive: 0xffd36b });
        bulb.position.set(2.65, y, -1.4);
        api.add(bulb);
        api.label(V(3.6, y, -1.4), ["勺子在右下方", "一杯咖啡…", "看起来挺好喝"][i], "tag");
      });
      const cable = (a, b, c) => {
        const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(V(0, -0.6, 0.5)), b]);
        api.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.06, 8), wax(c)));
      };
      cable(V(-2.2, 2.2, -1.35), V(2.2, 3.2, -1.35), colors[0]);
      cable(V(-2.2, 3.2, -1.35), V(2.2, 2.2, -1.35), colors[1]);
      const b = bunny(0.8);
      b.position.set(-4.4, 0, 1.6);
      api.add(b);
      return { camera: { pos: [0, 5.6, 12.2], target: [0, 2.0, -1.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "connect-onet": {
    build(api) {
      yard(api, 12, 8.5);
      const tray = slab(7.4, 4.6, 0.25, 0.4, TOY.cream);
      tray.position.set(0, 0.2, -0.2);
      api.add(tray);
      const words = ["勺子在哪边", "右下方", "照片里有什么", "一杯咖啡", "帮我看看", "挺好喝", "咖啡甜吗", "看不出", "哪家店", "没有店名", "多少钱", "没有价钱"];
      words.forEach((w, i) => {
        const x = -2.7 + (i % 4) * 1.8, z = -1.7 + Math.floor(i / 4) * 1.45;
        const t = block(1.55, 0.3, 1.2, i < 2 ? TOY.gold : [TOY.mint, TOY.sky2, TOY.pink, TOY.stone][i % 4], 0.12);
        t.position.set(x, 0.5, z);
        api.add(t);
        api.label(V(x, 0.7, z), w, "mini");
      });
      const curve = new THREE.CatmullRomCurve3([V(-2.7, 0.9, -1.7), V(-2.7, 1.1, -2.5), V(-0.9, 1.1, -2.5), V(-0.9, 0.9, -1.7)]);
      api.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.05, 6), waxOwn(TOY.coral, { emissive: 0xff9a7a })));
      return { camera: { pos: [0, 9.6, 9.4], target: [0, 0.4, -0.3] } };
    },
  },

  // ───────────── 排一排 ─────────────
  "order-train": {
    build(api) {
      yard(api, 14, 9, [["tree", -6.2, -2.8, 0.85], ["tree", 6.1, 3.0, 0.8], ["bush", -6.0, 3.1, 0.8], ["flower", -3.2, -3.4], ["flower", 2.2, -3.6]]);
      api.add(track(-6.2, 6.2, 0.9));
      const st = signboard(1.6, 0.7, TOY.coral, 1.2);
      st.position.set(-5.4, 0, -0.4);
      api.add(st);
      api.label(st, "寄出站", "sign");
      const eng = engine();
      eng.rotation.y = Math.PI;
      eng.position.set(-3.4, 0.12, 0.9);
      api.add(eng);
      api.ask("现在想知道：杯子里有没有泡沫。拼一句只问这一处（点车厢挂到车头后面，再按发车）");
      const cols = [TOY.gold, TOY.mint, TOY.sky2, TOY.pink, TOY.cream];
      const yardSpots = [[-4.4, -1.9], [-2.2, -2.3], [0, -2.5], [2.2, -2.3], [4.4, -1.9]];
      const mix = [2, 4, 0, 3, 1];
      const wagons = mix.map((pi, k) => {
        const w = wagon(cols[pi]);
        const [x, z] = yardSpots[k];
        w.position.set(x, 0, z);
        w.userData.home = w.position.clone();
        w.userData.piece = LESSON.pieces[pi];
        api.add(w);
        api.pickable(w, { k });
        api.label(w, LESSON.pieces[pi][1], "car", () => hook(k));
        return w;
      });
      const train = [];
      let running = false, cheer = 0, shake = 0;
      function layout() {
        train.forEach((w, n) => {
          const to = V(-2.0 + n * 1.42, 0.12, 0.9);
          const from = w.position.clone();
          api.tween(0.45, (k) => { w.position.lerpVectors(from, to, ease.out(k)); w.position.y = 0.12 * k + Math.sin(Math.PI * k) * 0.5; });
        });
      }
      function hook(k) {
        if (running) return;
        const w = wagons[k];
        const at = train.indexOf(w);
        if (at >= 0) {
          train.splice(at, 1);
          const from = w.position.clone();
          api.tween(0.45, (q) => w.position.lerpVectors(from, w.userData.home, ease.out(q)));
        } else if (train.length < 4) train.push(w);
        layout();
        api.say(train.length ? "火车上现在是：" + train.map((x) => x.userData.piece[1]).join("") : "");
      }
      function go() {
        if (running) return;
        if (!train.length) return api.say("先点车厢，把它们挂到车头后面。");
        running = true;
        const seq = train.map((w) => w.userData.piece[0]);
        const ok = JSON.stringify(seq) === JSON.stringify(["p-look", "p-cup", "p-foam"]) || JSON.stringify(seq) === JSON.stringify(["p-cup", "p-foam"]);
        const bad = train.find((w) => w.userData.piece[2]);
        const dist = ok ? -1.6 : -0.9;
        const group = [eng, ...train];
        const starts = group.map((o) => o.position.clone());
        api.tween(ok ? 2.4 : 1.2, (q) => group.forEach((o, n) => o.position.set(starts[n].x + dist * ease.inOut(q), 0.12, 0.9)), () => {
          if (ok) {
            api.say("火车到站：「" + train.map((x) => x.userData.piece[1]).join("") + "」 这次只问一处。", "ok");
            cheer = 1;
          } else {
            shake = 1;
            api.say(bad ? "火车停下了：" + bad.userData.piece[2] : "火车停下了：这句还没问到泡沫。", "no");
          }
          wait(api, 1.6, () => {
            shake = 0;
            cheer = 0;
            const now = group.map((o) => o.position.clone());
            api.tween(0.8, (q) => group.forEach((o, n) => o.position.lerpVectors(now[n], starts[n], ease.inOut(q))), () => (running = false));
          });
        });
      }
      api.controls([{ text: "发车", cls: "go", onClick: go }, { text: "↺ 重来", cls: "ghost", onClick: () => { while (train.length) { const w = train.pop(); w.position.copy(w.userData.home); } api.say(""); } }]);
      if (api.demo) {
        for (const id of ["p-look", "p-cup", "p-foam"]) hook(wagons.findIndex((w) => w.userData.piece[0] === id));
        api.say("火车上现在是：看这张照片，杯子里有没有泡沫？ 按「发车」送出去。");
      }
      return {
        camera: { pos: [0, 10.2, 12.2], target: [0, 0.5, -0.3] },
        pick: (o) => hook(o.userData.pick.k),
        tick: (t) => {
          eng.rotation.z = shake ? Math.sin(t * 40) * 0.03 : 0;
          eng.position.y = 0.12 + (cheer ? Math.abs(Math.sin(t * 8)) * 0.15 : 0);
        },
      };
    },
  },
  "order-domino": {
    build(api) {
      yard(api, 12, 8.5);
      const words = ["看这张照片，", "杯子里", "有没有泡沫？"];
      for (let i = 0; i < 6; i++) {
        const d = block(0.9, 1.5, 0.22, [TOY.gold, TOY.mint, TOY.sky2, TOY.cream, TOY.pink, TOY.cream][i], 0.06);
        const x = -3.2 + i * 1.3;
        d.position.set(x, 0.75, -0.2 + Math.sin(i) * 0.3);
        d.rotation.y = 0.2;
        if (i === 0) { d.rotation.x = -0.7; d.position.y = 0.6; d.position.z += 0.4; }
        api.add(d);
        if (i < 3) api.label(V(x, 1.9, -0.2), words[i], "tag");
      }
      const b = bunny(0.85);
      b.position.set(-4.6, 0, 1.6);
      api.add(b);
      return { camera: { pos: [0, 7.2, 12.4], target: [0, 1, -0.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "order-stack": {
    build(api) {
      yard(api, 12, 8.5);
      const words = ["有没有泡沫？", "杯子里", "看这张照片，"];
      words.forEach((w, i) => {
        const bl = block(2.8, 0.8, 1.2, [TOY.sky2, TOY.mint, TOY.gold][i], 0.14);
        bl.position.set(0, 0.42 + i * 0.84, -0.4);
        bl.rotation.y = (i - 1) * 0.08;
        api.add(bl);
        api.label(V(0, 0.42 + i * 0.84, 0.25), w, "mini");
      });
      const loose = block(2.6, 0.8, 1.2, TOY.pink, 0.14);
      loose.position.set(3.4, 0.42, 0.8);
      loose.rotation.y = 0.5;
      api.add(loose);
      api.label(V(3.4, 1.2, 0.8), "说说整张照片", "mini");
      const b = bunny(0.85);
      b.position.set(-3.4, 0, 1.2);
      api.add(b);
      return { camera: { pos: [0, 6.8, 12], target: [0, 1.3, -0.2] }, tick: (t) => bunnyTick(b, t) };
    },
  },

  // ───────────── 点图 ─────────────
  "point-camera": {
    build(api) {
      yard(api, 12, 8, [["tree", -5.2, -2.3, 0.85], ["bush", 5.0, 2.6, 0.8], ["flower", -4.6, 2.5], ["lantern", 5.4, -2.2]]);
      const es = easel(coffee());
      es.position.set(0, 0, -1.2);
      api.add(es);
      const cam = cameraProp();
      cam.position.set(2.9, 1.5, 1.6);
      cam.rotation.y = -0.55;
      const tri = new THREE.Group();
      for (const a of [0, 2.1, 4.2]) {
        const l = block(0.06, 1.5, 0.06, TOY.ink, 0.02);
        l.position.set(Math.cos(a) * 0.3, -0.75, Math.sin(a) * 0.3);
        l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
        tri.add(l);
      }
      cam.add(tri);
      api.add(cam);
      const b = bunny(0.8);
      b.position.set(-3.6, 0, 1.4);
      b.rotation.y = 0.5;
      api.add(b);
      api.ask("在照片上点出泡沫——对准了，咔嚓拍下来");
      const photo = es.userData.photo;
      api.pickable(photo, { photo: true });
      const frame = api.label(V(0, 0, 0), "", "viewfinder");
      frame.hidden = true;
      const flash = document.createElement("div");
      flash.className = "toy-flash";
      api.host.append(flash);
      const foam = { x: 0.36, y: 0.22, w: 0.25, h: 0.25 };
      let cheer = 0;
      function snap(uv) {
        const x = uv.x, y = 1 - uv.y;
        frame.target = photo.localToWorld(V((x - 0.5) * 2.7, (0.5 - y) * 1.8, 0.02));
        frame.hidden = false;
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
        cam.userData.flash.emissive = new THREE.Color(0xfff6cc);
        cam.userData.flash.emissiveIntensity = 2;
        wait(api, 0.3, () => (cam.userData.flash.emissiveIntensity = 0));
        const hit = x >= foam.x && x <= foam.x + foam.w && y >= foam.y && y <= foam.y + foam.h;
        if (hit) {
          api.say("咔嚓！拍到了泡沫。这是你亲眼看到的，以后它说什么，都这样对一对。", "ok");
          cheer = 1;
          wait(api, 1.4, () => (cheer = 0));
        } else api.say("这里不是。再看看杯子里面。", "no");
      }
      api.controls([{ text: "对准杯子中间拍", onClick: () => snap({ x: 0.48, y: 1 - 0.34 }) }, { text: "对准勺子拍", cls: "ghost", onClick: () => snap({ x: 0.6, y: 1 - 0.68 }) }]);
      if (api.demo) snap({ x: 0.48, y: 1 - 0.34 });
      return {
        camera: { pos: [0, 6.4, 12.2], target: [0, 1.8, -0.9] },
        pick: (o, a, hit) => hit.uv && snap(hit.uv),
        tick: (t) => bunnyTick(b, t, { cheer }),
      };
    },
  },
  "point-lens": {
    build(api) {
      yard(api, 12, 8);
      const es = easel(coffee());
      es.position.set(0, 0, -1.2);
      api.add(es);
      const mg = magnifier();
      mg.scale.setScalar(1.3);
      mg.position.set(0.2, 2.6, -0.8);
      api.add(mg);
      return { camera: { pos: [0, 5.4, 11.6], target: [0, 2.0, -1.0] } };
    },
  },
  "point-flag": {
    build(api) {
      yard(api, 12, 8.5);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.6), new THREE.MeshBasicMaterial({ map: coffee(), toneMapped: false }));
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(0, 0.06, -0.3);
      api.add(mat);
      const pole = disc(0.04, 1.4, TOY.ink);
      pole.position.set(-0.1, 0.7, -0.9);
      const flag = block(0.6, 0.38, 0.03, TOY.red, 0.02);
      flag.position.set(0.2, 1.2, -0.9);
      api.add(pole, flag);
      const b = bunny(0.85);
      b.position.set(-1.0, 0, 0.4);
      b.rotation.y = 0.4;
      api.add(b);
      return { camera: { pos: [0, 7.4, 7.2], target: [0, 0.2, -0.5] }, tick: (t) => bunnyTick(b, t) };
    },
  },

  // ───────────── 拧一拧 ─────────────
  "tune-tanks": {
    build(api) {
      yard(api, 13, 9, [["tree", -5.7, -2.7, 0.85], ["bush", 5.6, 3.0, 0.8], ["flower", -5.1, 3.1], ["lantern", 5.8, -2.6]]);
      const ctl = { photos: 25000, numbers: 512 };
      const metrics = [
        { name: "要先下载的文件", unit: "MB", max: 20, scale: 40, val: () => ctl.photos * ctl.numbers * 4e-6, good: (v) => v <= 20 },
        { name: "每搜一次要算", unit: "万次", max: 500, scale: 1000, val: () => ctl.photos * ctl.numbers * 1e-4, good: (v) => v <= 500 },
        { name: "装得下的照片", unit: "张", min: 8000, scale: 25000, val: () => ctl.photos, good: (v) => v >= 8000 },
      ];
      const tanks = metrics.map((m, i) => {
        const t = tank();
        t.position.set(-2.6 + i * 2.6, 0, -1.6);
        api.add(t);
        const band = torus(0.6, 0.035, TOY.leafLight);
        band.rotation.x = Math.PI / 2;
        const f = (m.max ?? m.min) / m.scale;
        band.position.set(t.position.x, 0.12 + 2.1 * f, t.position.z);
        api.add(band);
        m.label = api.label(V(t.position.x, 3.05, -1.6), "", "sign");
        return t;
      });
      const valves = [["收录多少张照片", "photos", 1000, 50000, 1000], ["每张记多少个数", "numbers", 128, 512, 64]].map(([n, key, lo, hi, step], i) => {
        const v = valve(i ? TOY.gold : TOY.coral);
        v.position.set(i ? 1.6 : -1.6, 0, 1.8);
        api.add(v);
        const l = api.label(V(v.position.x, 1.5, 1.8), "", "tag");
        return { v, key, lo, hi, step, n, l };
      });
      api.ask("拧两个阀门，让三个水箱都落在绿线的对的一边（内容来自一节真课：给自己的相册做搜索）");
      function update() {
        let allGood = true;
        metrics.forEach((m, i) => {
          const v = m.val();
          setLevel(tanks[i], Math.min(1, v / m.scale));
          const g = m.good(v);
          allGood &&= g;
          tanks[i].userData.water.material.color.set(g ? TOY.water : TOY.coral);
          m.label.el.innerHTML = `${m.name}<br><span style="font-weight:500">${m.max != null ? "别超过 " + m.max : "至少 " + m.min.toLocaleString()} ${m.unit}</span><br><b>${Math.round(v).toLocaleString()} ${m.unit} ${g ? "✓" : "✗"}</b>`;
        });
        valves.forEach((x) => (x.l.el.innerHTML = `${x.n}<br><b>${ctl[x.key].toLocaleString()}</b>`));
        api.say(allGood ? "三个水箱都对了：装得下你的相册，文件也不大，搜得也快。" : "还有水箱不对。先看哪一个是红的。", allGood ? "ok" : "");
      }
      function turn(i, dir) {
        const x = valves[i];
        ctl[x.key] = Math.max(x.lo, Math.min(x.hi, ctl[x.key] + dir * x.step * (x.key === "photos" ? 2 : 1)));
        const w = x.v.userData.wheel;
        const from = w.rotation.z;
        api.tween(0.3, (k) => (w.rotation.z = from + dir * 0.8 * k));
        update();
      }
      valves.forEach((x, i) => api.pickable(x.v, { i }));
      if (api.demo) { ctl.photos = 10000; ctl.numbers = 384; }
      update();
      api.controls([
        { text: "照片 −", onClick: () => turn(0, -1) }, { text: "照片 +", onClick: () => turn(0, 1) },
        { text: "每张的数 −", onClick: () => turn(1, -1) }, { text: "每张的数 +", onClick: () => turn(1, 1) },
      ]);
      return { camera: { pos: [0, 7.8, 12.2], target: [0, 1.1, -0.1] }, pick: (o) => turn(o.userData.pick.i, -1) };
    },
  },
  "tune-radio": {
    build(api) {
      yard(api, 12, 8.5);
      const body = block(4.2, 2.4, 1.3, TOY.wood, 0.3);
      body.position.set(0, 1.35, -0.6);
      api.add(body);
      const grill = disc(0.8, 0.1, TOY.cream);
      grill.rotation.x = Math.PI / 2;
      grill.position.set(-1.0, 1.4, 0.1);
      api.add(grill);
      const win = block(1.6, 0.6, 0.06, TOY.paper, 0.05);
      win.position.set(0.95, 1.8, 0.07);
      api.add(win);
      const needle = block(0.04, 0.5, 0.02, TOY.red, 0.01);
      needle.position.set(1.2, 1.8, 0.12);
      api.add(needle);
      const knob = disc(0.3, 0.25, TOY.ink);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.95, 0.95, 0.15);
      api.add(knob);
      const ant = disc(0.03, 1.6, TOY.ink);
      ant.position.set(1.6, 3.2, -0.6);
      ant.rotation.z = -0.4;
      api.add(ant);
      const b = bunny(0.85);
      b.position.set(-3.2, 0, 1.4);
      api.add(b);
      api.label(V(-1.9, 3.0, 0.2), "♪ 调对了，杂音变成音乐", "tag");
      return { camera: { pos: [0, 6.6, 11.8], target: [0, 1.5, -0.4] }, tick: (t) => bunnyTick(b, t, { cheer: 0.3 }) };
    },
  },
  "tune-scale": {
    build(api) {
      yard(api, 12, 8.5);
      const post = disc(0.12, 2.6, TOY.ink);
      post.position.set(0, 1.3, -0.4);
      const base = disc(0.8, 0.2, TOY.stone);
      base.position.set(0, 0.1, -0.4);
      const beam = block(5, 0.14, 0.14, TOY.gold, 0.05);
      beam.position.set(0, 2.6, -0.4);
      beam.rotation.z = 0.08;
      api.add(post, base, beam);
      [[-2.3, 2.78], [2.3, 2.42]].forEach(([x, y], i) => {
        const pan = disc(0.9, 0.08, TOY.cream);
        pan.position.set(x, y - 1.2, -0.4);
        api.add(pan);
        for (let n = 0; n < (i ? 3 : 2); n++) {
          const w = block(0.45, 0.35, 0.45, i ? TOY.coral : TOY.mint, 0.08);
          w.position.set(x + (n - 1) * 0.5, y - 0.95, -0.4);
          api.add(w);
        }
        api.label(V(x, y - 0.1, -0.4), i ? "花的钱" : "省的时间", "tag");
      });
      return { camera: { pos: [0, 6.2, 11.8], target: [0, 1.6, -0.4] } };
    },
  },

  // ───────────── 自己做 ─────────────
  "make-bench": {
    build(api) {
      yard(api, 12, 9, [["tree", -5.1, -2.8, 0.85], ["bush", 5.0, 3.0, 0.8], ["flower", -4.6, 3.0], ["lantern", 5.3, -2.5]]);
      const wb = workbench();
      wb.position.set(0, 0, 0.6);
      api.add(wb);
      const sh = shelfUnit();
      sh.position.set(0, 0, -2.6);
      api.add(sh);
      const b = bunny(0.9);
      b.position.set(0, 0, -0.8);
      api.add(b);
      const hm = hammer();
      hm.position.set(0.7, 1.5, 0.2);
      api.add(hm);
      const cat = card(1.0, 0.75, TOY.cream);
      cat.position.set(-0.4, 1.1, 0.8);
      cat.rotation.x = -Math.PI / 2;
      api.add(cat);
      api.label(V(-0.4, 1.2, 0.8), "猫的照片", "tag");
      api.ask("换张猫照片。你想知道它哪一处？自己写一句，发出去，再改成你的作品");
      let made = 0, hammering = 0, cheer = 0;
      const shelfSpots = [[-1.0, 2.62], [0, 2.62], [1.0, 2.62], [-1.0, 1.62], [0, 1.62], [1.0, 1.62]];
      function make() {
        if (hammering) return;
        hammering = 1;
        api.say("小兔子在敲敲打打：AI 正在按你的请求干活。");
        wait(api, 1.8, () => {
          hammering = 0;
          const pc = postcard([TOY.gold, TOY.mint, TOY.sky2, TOY.coral, TOY.pink, TOY.cream][made % 6]);
          const [x, y] = shelfSpots[made % 6];
          pc.position.set(x, y, -2.45);
          api.add(pc);
          pop(api, pc);
          made++;
          cheer = 1;
          api.say(made === 1 ? "做好了！作品摆上架子。评分通过，给它盖一个小红花。" : `你的第 ${made} 件作品。架子会越摆越满。`, "ok");
          wait(api, 1.2, () => (cheer = 0));
        });
      }
      api.controls([{ text: "发出去，做一件", cls: "go", onClick: make }]);
      if (api.demo) {
        for (let n = 0; n < 3; n++) {
          const pc = postcard([TOY.gold, TOY.mint, TOY.sky2][n]);
          pc.position.set(shelfSpots[n][0], shelfSpots[n][1], -2.45);
          api.add(pc);
        }
        made = 3;
        hammering = 1;
        api.say("小兔子在敲敲打打：AI 正在按你的请求干活。");
      }
      return {
        camera: { pos: [0, 7.4, 12.2], target: [0, 1.4, -0.6] },
        tick: (t) => {
          hm.rotation.x = hammering ? Math.sin(t * 16) * 0.8 : 0.2;
          bunnyTick(b, t, { cheer, hop: hammering ? (t * 3) % 1 : 0 });
        },
      };
    },
  },
  "make-oven": {
    build(api) {
      yard(api, 12, 8.5);
      const ov = block(3, 2.4, 1.6, TOY.cream, 0.3);
      ov.position.set(0.4, 1.2, -0.8);
      api.add(ov);
      const win = block(1.6, 1.0, 0.06, TOY.ink, 0.15);
      win.position.set(0.1, 1.2, 0.02);
      api.add(win);
      const glowM = waxOwn(TOY.gold, { emissive: 0xffa24a });
      const glow = block(1.3, 0.7, 0.04, 0, 0.12, glowM);
      glow.position.set(0.1, 1.2, 0.06);
      api.add(glow);
      for (let i = 0; i < 2; i++) {
        const k = disc(0.16, 0.12, TOY.coral);
        k.rotation.x = Math.PI / 2;
        k.position.set(1.4, 1.6 - i * 0.5, 0.05);
        api.add(k);
      }
      const b = bunny(0.85);
      b.position.set(-2.6, 0, 1.2);
      b.rotation.y = 0.5;
      api.add(b);
      api.label(V(0.4, 2.9, -0.8), "请求 = 菜谱", "tag");
      return { camera: { pos: [0, 6.4, 11.6], target: [0, 1.3, -0.4] }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "make-easel": {
    build(api) {
      yard(api, 12, 8.5);
      const es = easel(coffee());
      es.position.set(0.6, 0, -1.2);
      api.add(es);
      const pal = slab(1.0, 0.7, 0.06, 0.3, TOY.wood);
      pal.position.set(-2.3, 1.0, 0.8);
      api.add(pal);
      [TOY.red, TOY.gold, TOY.sky2, TOY.mint].forEach((c, i) => {
        const d = ball(0.1, c);
        d.position.set(-2.6 + i * 0.2, 1.08, 0.7 + (i % 2) * 0.15);
        api.add(d);
      });
      const b = bunny(0.85);
      b.position.set(-3.4, 0, 1.2);
      api.add(b);
      return { camera: { pos: [0, 5.8, 11.8], target: [0, 1.8, -0.8] }, tick: (t) => bunnyTick(b, t) };
    },
  },

  // ───────────── 岛上的快版 ─────────────
  "fast-tetris": {
    build(api) {
      yard(api, 12, 8.5);
      const lanes = [["答得出", TOY.mint], ["答不出", TOY.coral], ["说不准", TOY.sky2]];
      lanes.forEach(([n, c], i) => {
        const x = -2.4 + i * 2.4;
        const wall = block(0.12, 3.6, 1.2, TOY.cream, 0.04);
        wall.position.set(x - 1.2, 1.8, -1.2);
        api.add(wall);
        const floor = block(2.3, 0.2, 1.2, c, 0.06);
        floor.position.set(x, 0.1, -1.2);
        api.add(floor);
        api.label(V(x, -0.2, -0.5), n, "tag");
      });
      const w = block(0.12, 3.6, 1.2, TOY.cream, 0.04);
      w.position.set(2.4 + 1.2, 1.8, -1.2);
      api.add(w);
      [[-2.4, 0.55, TOY.mint], [-2.4, 1.2, TOY.mint], [0, 0.55, TOY.coral], [2.4, 0.55, TOY.stone]].forEach(([x, y, c]) => {
        const bx = block(2.1, 0.6, 1.0, c, 0.1);
        bx.position.set(x, y, -1.2);
        api.add(bx);
      });
      const fall = block(2.1, 0.6, 1.0, TOY.gold, 0.1);
      fall.position.set(0, 3.2, -1.2);
      api.add(fall);
      api.label(V(0, 3.2, -0.6), "咖啡多少钱？", "tag");
      return { camera: { pos: [0, 5.6, 12.2], target: [0, 1.7, -1.2] } };
    },
  },
  "fast-snake": {
    build(api) {
      yard(api, 12, 9);
      const grid = slab(8, 5.6, 0.1, 0.3, TOY.cream);
      grid.position.set(0, 0.06, -0.2);
      api.add(grid);
      const body = [[-2.5, 0.6], [-2.0, 0.6], [-1.5, 0.6], [-1.0, 0.6], [-1.0, 0.1], [-0.5, 0.1]];
      body.forEach(([x, z], i) => {
        const s = ball(0.26, i === body.length - 1 ? TOY.leaf : TOY.leafLight);
        s.position.set(x, 0.32, z);
        api.add(s);
      });
      [["1", "看这张照片，", -2.8, -1.8], ["2", "杯子里", 0.6, 0.1], ["3", "有没有泡沫？", 2.4, -1.4], ["✗", "写得越长越好", 1.8, 1.8]].forEach(([n, t, x, z]) => {
        const p = block(0.5, 0.3, 0.5, n === "✗" ? TOY.coral : TOY.gold, 0.1);
        p.position.set(x, 0.3, z);
        api.add(p);
        api.label(V(x, 0.9, z), t, "tag");
      });
      return { camera: { pos: [0, 9.4, 9.2], target: [0, 0.2, -0.3] } };
    },
  },

  // ───────────── 一座庭院里的第一课 ─────────────
  "overview": {
    build(api) {
      api.add(island(22, 15));
      const route = [[-8.5, 5], [-5, 3.2], [-6, -0.8], [-2.2, -3.6], [1.6, -1.2], [4.8, -4.2], [7.8, -0.6], [5, 3.4], [8.5, 5.2]];
      api.add(path(route, 1.0));
      const add = (o, x, z, r = 0) => { o.position.set(x, 0, z); o.rotation.y = r; api.add(o); return o; };
      const sg = signboard(1.1, 0.5, TOY.mint, 0.6);
      add(sg, -5, 2.2);
      const sg2 = signboard(1.1, 0.5, TOY.gold, 0.6);
      add(sg2, -3.8, 2.6);
      const lh = lighthouse();
      lh.scale.setScalar(0.6);
      add(lh, -7.8, -2.6);
      const nb = noticeBoard(2.6, 1.5);
      nb.scale.setScalar(0.8);
      add(nb, -4.6, -2.2);
      [TOY.mint, TOY.coral].forEach((c, i) => add(basket(c), -2.8 + i * 1.5, -5.2));
      const t1 = tap(TOY.sky2);
      t1.scale.setScalar(0.7);
      add(t1, 0.4, -3.2);
      const p1 = pot();
      p1.scale.setScalar(0.8);
      add(p1, 2.4, -3.0);
      api.add(track(3.4, 8.2, -5.8));
      const e = engine();
      e.scale.setScalar(0.7);
      add(e, 6.6, -5.8);
      const wg = wagon(TOY.gold);
      wg.scale.setScalar(0.7);
      add(wg, 5.5, -5.8);
      const es = easel(coffee());
      es.scale.setScalar(0.55);
      add(es, 9.2, -2.0, -0.4);
      const wb = workbench();
      wb.scale.setScalar(0.7);
      add(wb, 6.4, 5.4);
      const b = bunny(0.8);
      add(b, -8.2, 5.8);
      dress(api, [["tree", -9.4, -5.6, 1], ["tree", 0.2, 5.4, 0.9], ["tree", 9.8, 2.6, 0.8], ["bush", -1.6, 2.8, 0.8], ["bush", 3.2, 1.6, 0.7], ["lantern", -9.8, 1.4], ["flower", -0.8, 0.6], ["flower", 2.6, 4.6], ["flower", -6.6, 6.2]]);
      const tags = [
        [V(-4.4, 2.2, 2.4), "猜 · 岔路口"], [V(-7.8, 2.8, -2.6), "跑 · 纸飞机"], [V(-4.6, 3.0, -2.2), "跑 · 公告栏"],
        [V(-2.0, 1.6, -5.2), "看 · 投篮"], [V(1.4, 1.8, -3.1), "看 · 接水管"], [V(6, 1.6, -5.8), "改 · 小火车"],
        [V(9.2, 2.7, -2.0), "改 · 拍照"], [V(6.4, 1.9, 5.4), "做 · 工作台"], [V(-8.2, 1.9, 5.8), "起点"],
      ];
      for (const [v, t] of tags) api.label(v, t, "tag");
      return { camera: { pos: [0, 19, 22], target: [0, -0.6, -0.4], fov: 32 }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "roles": {
    build(api) {
      api.add(island(14, 6));
      const bs = [bunny(0.8), bunny(0.8)];
      bs[0].position.set(-4.4, 0, 0.6);
      bs[0].rotation.y = Math.PI * 0.9;
      const bk = basket(TOY.mint);
      bk.position.set(-4.4, 0, -1.4);
      const bl = ball(0.2, TOY.gold);
      bl.position.set(-4.4, 1.8, -0.4);
      api.add(bs[0], bk, bl);
      const tp = tap(TOY.sky2);
      tp.scale.setScalar(0.8);
      tp.position.set(-0.8, 0, -0.8);
      const pt = pot();
      pt.position.set(1.0, 0, -0.8);
      api.add(tp, pt);
      pipe(api, V(-0.35, 0.45, -0.8), V(0.75, 0.4, -0.8), TOY.sky2, 0.6);
      bs[1].position.set(0.1, 0, 1.3);
      bs[1].scale.setScalar(0.6);
      api.add(bs[1]);
      const nb = noticeBoard(2.8, 1.8);
      nb.scale.setScalar(0.8);
      nb.position.set(4.6, 0, -0.9);
      api.add(nb);
      api.label(V(-4.4, 2.8, -0.4), "主角：身体的活", "tag");
      api.label(V(0.1, 2.8, -0.4), "陪着：手指的活", "tag");
      api.label(V(4.6, 3.6, -0.4), "不出场：眼睛的活", "tag");
      return { camera: { pos: [0, 9.6, 15.6], target: [0, 0.8, -0.4] }, tick: (t) => bs.forEach((b) => bunnyTick(b, t)) };
    },
  },
};

// ───────────── 舞台 + 平面按钮的三个样子（讨论用） ─────────────
function cupOnSaucer() {
  const g = new THREE.Group();
  const saucer = disc(0.42, 0.05, TOY.red);
  saucer.position.y = 0.03;
  const cup = disc(0.22, 0.3, TOY.white);
  cup.position.y = 0.2;
  const coffee = disc(0.19, 0.02, 0x7a4a2a);
  coffee.position.y = 0.355;
  const handle = torus(0.09, 0.03, TOY.white);
  handle.position.set(0.25, 0.22, 0);
  const spoon = block(0.05, 0.02, 0.36, TOY.stone, 0.01);
  spoon.position.set(0.28, 0.07, 0.12);
  spoon.rotation.y = 0.6;
  g.add(saucer, cup, coffee, handle, spoon);
  return g;
}
function cafeTable() {
  const g = new THREE.Group();
  const top = disc(0.85, 0.08, TOY.cream);
  top.position.y = 0.92;
  const leg = disc(0.08, 0.9, TOY.ink);
  leg.position.y = 0.45;
  const foot = disc(0.4, 0.05, TOY.ink);
  foot.position.y = 0.03;
  const cup = cupOnSaucer();
  cup.position.y = 0.96;
  g.add(top, leg, foot, cup);
  return g;
}
Object.assign(SCENES, {
  "stage-guess": {
    build(api) {
      yard(api, 9, 6, [["tree", -3.6, -1.6, 0.8], ["bush", 3.5, 1.6, 0.8], ["flower", 3.2, -1.2], ["flower", -3.0, 1.9]]);
      const t = cafeTable();
      t.position.set(0.9, 0, -0.6);
      api.add(t);
      const b = bunny(0.95);
      b.position.set(-1.2, 0, 0.6);
      b.rotation.y = 0.9;
      api.add(b);
      api.label(V(-1.2, 2.25, 0.6), "？", "bubble");
      return { camera: { pos: [0, 4.6, 7.4], target: [0, 0.8, -0.2], fov: 32 }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "stage-round": {
    build(api) {
      yard(api, 9, 6, [["tree", -3.7, -1.7, 0.75], ["tree", 3.7, -1.6, 0.7], ["flower", 3.2, 1.8]]);
      const cols = [TOY.mint, TOY.coral];
      [["答得出", -1.7, 2], ["答不出", 1.7, 1]].forEach(([n, x, k], i) => {
        const bk = basket(cols[i]);
        bk.position.set(x, 0, -1.1);
        api.add(bk);
        api.label(bk, n, "tag big").offset.set(0, 1.35, 0);
        for (let q = 0; q < k; q++) {
          const kept = ball(0.16, TOY.gold);
          kept.position.set(x + (q - 0.5) * 0.24, 0.72, -1.1);
          api.add(kept);
        }
      });
      const b = bunny(0.9);
      b.position.set(0, 0, 1.3);
      b.rotation.y = Math.PI;
      api.add(b);
      const bl = ball(0.2, TOY.gold);
      bl.position.set(0.8, 2.4, 0.1);
      api.add(bl);
      api.label(V(0, 2.25, 1.4), "咖啡甜不甜？", "card");
      return { camera: { pos: [0, 5.2, 7.6], target: [0, 0.8, -0.2], fov: 34 }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "stage-done": {
    build(api) {
      yard(api, 9, 6, [["tree", -3.6, -1.6, 0.8], ["bush", 3.6, 1.7, 0.8], ["lantern", 3.7, -1.5], ["flower", -3.1, 1.9]]);
      const t = cafeTable();
      t.position.set(0.6, 0, -0.5);
      api.add(t);
      const chair = new THREE.Group();
      const seat = block(0.7, 0.1, 0.7, TOY.coral, 0.05);
      seat.position.y = 0.55;
      const back = block(0.7, 0.7, 0.1, TOY.coral, 0.05);
      back.position.set(0, 0.95, -0.32);
      chair.add(seat, back);
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
        const l = block(0.07, 0.55, 0.07, TOY.bark, 0.02);
        l.position.set(x, 0.27, z);
        chair.add(l);
      }
      chair.position.set(2.0, 0, -0.9);
      chair.rotation.y = -0.9;
      api.add(chair);
      const b = bunny(0.9);
      b.position.set(-1.3, 0, 0.7);
      b.rotation.y = 0.5;
      api.add(b);
      const conf = [TOY.gold, TOY.coral, TOY.mint, TOY.sky2, TOY.pink];
      for (let i = 0; i < 26; i++) {
        const c = block(0.09, 0.02, 0.05, conf[i % 5], 0.01);
        c.position.set(-1.3 + Math.sin(i * 2.3) * 1.6, 1.6 + (i % 7) * 0.22, 0.4 + Math.cos(i * 1.7) * 1.0);
        c.rotation.set(i, i * 0.7, i * 1.3);
        c.castShadow = false;
        api.add(c);
      }
      api.label(V(0.6, 2.1, -0.5), "新：一张咖啡小桌", "tag big");
      return { camera: { pos: [0, 4.6, 7.4], target: [0, 0.8, -0.2], fov: 32 }, tick: (t) => bunnyTick(b, t, { cheer: 1 }) };
    },
  },
});

// ───────────── 专业课的小舞台（讨论用）：等信号的小火车、代码小镇 ─────────────
function signal(red = true) {
  const g = new THREE.Group();
  const post = disc(0.07, 1.8, TOY.ink);
  post.position.y = 0.9;
  const head = block(0.36, 0.7, 0.3, TOY.ink, 0.08);
  head.position.y = 1.95;
  const lampR = ball(0.11, 0, waxOwn(TOY.red, { emissive: red ? 0xff5a4a : 0 }));
  lampR.position.set(0, 2.1, 0.16);
  const lampG = ball(0.11, 0, waxOwn(TOY.leafLight, { emissive: red ? 0 : 0x7dff8a }));
  lampG.position.set(0, 1.8, 0.16);
  g.add(post, head, lampR, lampG);
  return g;
}
function house(color, w = 1.4, h = 1.1, d = 1.2) {
  const g = new THREE.Group();
  const body = block(w, h, d, color, 0.1);
  body.position.y = h / 2;
  const roof = cone(Math.max(w, d) * 0.78, 0.7, TOY.coral);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.34;
  const door = block(0.3, 0.5, 0.04, TOY.bark, 0.04);
  door.position.set(0, 0.25, d / 2 + 0.01);
  g.add(body, roof, door);
  g.userData.anchor = V(0, h + 1.0, 0);
  return g;
}
function warehouse(color) {
  const g = new THREE.Group();
  const body = block(1.5, 1.0, 1.2, color, 0.12);
  body.position.y = 0.5;
  const roof = block(1.7, 0.16, 1.4, TOY.ink, 0.06);
  roof.position.y = 1.08;
  const doorM = block(0.7, 0.62, 0.04, TOY.cream, 0.05);
  doorM.position.set(0, 0.32, 0.61);
  g.add(body, roof, doorM);
  g.userData.anchor = V(0, 1.7, 0);
  return g;
}
Object.assign(SCENES, {
  "stage-await": {
    build(api) {
      yard(api, 10, 6, [["tree", -4.1, -1.7, 0.75], ["bush", 4.1, 1.8, 0.8], ["flower", -3.3, 2.0]]);
      api.add(track(-4.8, 4.8, 0.2));
      const eng = engine(TOY.red);
      eng.position.set(-0.6, 0.12, 0.2);
      api.add(eng);
      const sg = signal(true);
      sg.position.set(0.9, 0, -0.55);
      api.add(sg);
      const st = signboard(1.9, 0.9, TOY.sky2, 0.5);
      st.position.set(2.8, 0, -1.4);
      api.add(st);
      api.label(st, "分享窗口：开着", "sign");
      const b = bunny(0.75);
      b.position.set(-2.8, 0, 1.6);
      b.rotation.y = 0.4;
      api.add(b);
      api.label(V(0.9, 2.75, -0.55), "await：在这里等", "tag big");
      return { camera: { pos: [0, 4.4, 7.2], target: [0.2, 0.9, -0.3], fov: 34 }, tick: (t) => bunnyTick(b, t) };
    },
  },
  "stage-town": {
    build(api) {
      yard(api, 11, 7, [["tree", -4.6, -2.2, 0.7], ["tree", 4.7, 2.3, 0.65], ["flower", -4.2, 2.4], ["flower", 1.2, 2.8]]);
      const biz = house(TOY.cream);
      biz.position.set(-3.4, 0, 0.6);
      api.add(biz);
      api.label(biz, "业务代码", "tag");
      const hub = house(TOY.gold, 1.6, 1.4, 1.4);
      hub.position.set(-0.3, 0, 0.2);
      api.add(hub);
      api.label(hub, "存储总台", "tag big");
      const w1 = warehouse(TOY.mint);
      w1.position.set(3.2, 0, -1.6);
      api.add(w1);
      api.label(w1, "手机：Preferences", "tag");
      const w2 = warehouse(TOY.sky2);
      w2.position.set(3.2, 0, 1.9);
      api.add(w2);
      api.label(w2, "浏览器：localStorage", "tag");
      api.add(path([[-2.7, 0.9], [-1.2, 0.5]], 0.6));
      api.add(path([[0.6, 0.0], [2.3, -1.3]], 0.6, TOY.mint));
      api.add(path([[0.6, 0.5], [2.3, 1.7]], 0.6, 0xd9e4ee));
      const cart = block(0.5, 0.35, 0.4, TOY.coral, 0.08);
      cart.position.set(1.5, 0.3, -0.7);
      cart.rotation.y = -0.6;
      api.add(cart);
      api.label(V(1.5, 0.95, -0.7), "getItem('k')", "mini");
      const b = bunny(0.6);
      b.position.set(-1.7, 0, 2.2);
      api.add(b);
      return { camera: { pos: [0, 10.5, 12.5], target: [0, 0.4, 0.2], fov: 34 }, tick: (t) => bunnyTick(b, t) };
    },
  },
});

// ───────────── 一关只载入一次的小舞台 ─────────────
// A lesson world is one scene for the whole lesson. The lesson page calls
// go(step) to move the camera and bring in that step's props, react(kind) after
// every answer, and a few step actions (throw, add a wagon, fly, snap, make, celebrate).
function worldRig(api, presets, start) {
  const camT = V(...presets[start].target);
  let stepName = start;
  const rig = {
    go(step, done) {
      const p = presets[step];
      if (!p) return;
      stepName = step;
      const fromP = api.camera.position.clone(), fromT = camT.clone();
      const toP = V(...p.pos), toT = V(...p.target);
      api.tween(0.9, (k) => {
        const e = ease.inOut(k);
        api.camera.position.lerpVectors(fromP, toP, e);
        camT.lerpVectors(fromT, toT, e);
      }, done);
    },
    get step() { return stepName; },
    look() { api.camera.lookAt(camT); },
  };
  return rig;
}
function walk(api, b, to, rotY, dur = 0.8, done) {
  const from = b.position.clone();
  const target = V(to[0], 0, to[1]);
  b.rotation.y = Math.atan2(target.x - from.x, target.z - from.z);
  b.userData.walking = true;
  api.tween(dur, (k) => b.position.lerpVectors(from, target, ease.inOut(k)), () => {
    b.userData.walking = false;
    b.rotation.y = rotY;
    done?.();
  });
}

Object.assign(SCENES, {
  "world-lesson1": {
    build(api) {
      api.add(island(16, 11));
      dress(api, [["tree", -6.9, -4.2, 1], ["tree", 6.8, -4.3, 0.9], ["tree", -7.0, 3.8, 0.85], ["bush", 0.6, -4.6, 0.9], ["bush", 7.0, 3.9, 0.8], ["lantern", -1.8, -4.3], ["flower", 1.9, 1.2], ["flower", -5.4, -1.2], ["flower", 5.9, -0.2], ["flower", -0.4, 4.6]]);
      const tbl = cafeTable();
      tbl.position.set(0, 0, 0);
      api.add(tbl);
      const chair = new THREE.Group();
      const seat = block(0.7, 0.1, 0.7, TOY.coral, 0.05);
      seat.position.y = 0.55;
      const back = block(0.7, 0.7, 0.1, TOY.coral, 0.05);
      back.position.set(0, 0.95, -0.32);
      chair.add(seat, back);
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
        const l = block(0.07, 0.55, 0.07, TOY.bark, 0.02);
        l.position.set(x, 0.27, z);
        chair.add(l);
      }
      chair.position.set(1.3, 0, -0.5);
      chair.rotation.y = -1.2;
      chair.visible = false;
      api.add(chair);
      const es = easel(coffee());
      es.scale.setScalar(0.8);
      es.position.set(4.6, 0, -1.6);
      es.rotation.y = -0.45;
      api.add(es);
      const cam = cameraProp();
      cam.scale.setScalar(0.8);
      cam.position.set(3.2, 1.2, 0.4);
      cam.rotation.y = -0.2;
      api.add(cam);
      const board = noticeBoard(3.4, 2.0);
      board.scale.setScalar(0.75);
      board.position.set(-4.4, 0, -2.6);
      board.rotation.y = 0.4;
      api.add(board);
      const notes = [];
      for (let i = 0; i < 3; i++) {
        const n = block(0.62, 0.42, 0.03, [TOY.cream, TOY.gold, TOY.pink][i], 0.02);
        n.position.set(-5.3 + i * 0.8, 1.95, -2.26 + i * 0.3);
        n.rotation.y = 0.4;
        api.add(n);
        notes.push(n);
      }
      const lh = lighthouse();
      lh.scale.setScalar(0.75);
      lh.position.set(5.9, 0, -3.8);
      api.add(lh);
      const bins = [basket(TOY.mint), basket(TOY.coral)];
      bins[0].position.set(-5.2, 0, 0.3);
      bins[1].position.set(-3.1, 0, 1.3);
      bins.forEach((b) => { b.visible = false; api.add(b); });
      const binLabels = [api.label(bins[0], "答得出", "tag big"), api.label(bins[1], "答不出", "tag big")];
      binLabels.forEach((l) => { l.offset.set(0, 1.35, 0); l.hidden = true; });
      api.add(track(-0.4, 5.6, 4.2));
      const eng = engine();
      eng.rotation.y = Math.PI;
      eng.position.set(0.6, 0.12, 4.2);
      api.add(eng);
      const wagons = [];
      const bench = workbench();
      bench.scale.setScalar(0.7);
      bench.position.set(5.2, 0, 2.0);
      bench.rotation.y = -0.5;
      api.add(bench);
      const shelf = shelfUnit();
      shelf.scale.setScalar(0.55);
      shelf.position.set(6.6, 0, 0.6);
      shelf.rotation.y = -1.1;
      api.add(shelf);
      const hm = hammer();
      hm.position.set(5.0, 1.35, 1.7);
      api.add(hm);
      const b = bunny(0.85);
      b.position.set(-1.2, 0, 1.4);
      api.add(b);
      const think = api.label(V(0, 0, 0), "？", "bubble");
      think.target = b;
      think.offset.set(0, 2.1, 0);
      think.hidden = true;
      const aiTag = api.label(lh, "AI", "tag");
      const pl = plane(0.8);
      pl.visible = false;
      api.add(pl);
      const flash = document.createElement("div");
      flash.className = "toy-flash";
      api.host.append(flash);
      const presets = {
        intro: { pos: [0, 10.5, 15.5], target: [0, 0.6, 0], at: [-1.2, 1.4, 0.4] },
        guess: { pos: [-0.6, 4.4, 6.6], target: [0, 0.9, 0], at: [-1.2, 1.2, 0.7] },
        send: { pos: [1.6, 6.6, 7.8], target: [2.6, 1.6, -1.6], at: [0.8, 0.6, 0.9] },
        find: { pos: [-2.6, 4.2, 4.2], target: [-4.4, 1.6, -2.4], at: [-3.0, -0.8, 0.5] },
        round: { pos: [-3.4, 4.6, 7.2], target: [-4.1, 0.8, 0.9], at: [-3.9, 3.0, Math.PI * 0.95] },
        match: { pos: [-2.6, 4.2, 4.2], target: [-4.4, 1.6, -2.4], at: [-3.0, -0.8, 0.5] },
        build: { pos: [2.0, 5.2, 9.8], target: [2.0, 0.8, 3.4], at: [1.6, 2.0, 0.2] },
        point: { pos: [2.6, 3.4, 3.4], target: [4.4, 1.6, -1.4], at: [2.8, 0.6, -0.9] },
        make: { pos: [3.4, 4.6, 6.8], target: [5.4, 1.1, 1.4], at: [6.3, 2.5, -0.9] },
        done: { pos: [-0.4, 4.6, 6.8], target: [0.3, 0.8, 0], at: [-1.3, 1.0, 0.5] },
      };
      const rig = worldRig(api, presets, "intro");
      const cam0 = presets.intro;
      let cheer = 0, shake = 0, hammering = 0, glow = 0;
      const show = (step) => {
        const round = step === "round";
        bins.forEach((x) => (x.visible = round));
        binLabels.forEach((l) => (l.hidden = !round));
        think.hidden = step !== "guess";
        aiTag.hidden = !(step === "send" || step === "intro");
      };
      function react(kind) {
        if (kind === "ok") { cheer = 1; api.tween(1.1, () => {}, () => (cheer = 0)); }
        else if (kind === "no") { shake = 1; api.tween(0.7, () => {}, () => (shake = 0)); }
      }
      function go(step) {
        const p = presets[step];
        show(step);
        rig.go(step);
        if (p?.at) walk(api, b, [p.at[0], p.at[1]], p.at[2]);
      }
      function throwBall(i, ok, done) {
        const ball0 = ball(0.18, TOY.gold);
        api.add(ball0);
        const from = b.position.clone().setY(1.4), to = bins[i].position.clone().setY(0.8);
        arc(api, ball0, from, to, 2.0, 0.7, () => {
          if (ok) {
            bins[i].userData.kept = (bins[i].userData.kept || 0) + 1;
            const n = bins[i].userData.kept - 1;
            ball0.scale.setScalar(0.16);
            bins[i].add(ball0);
            ball0.position.set(((n % 3) - 1) * 0.22, 0.72, (Math.floor(n / 3) - 0.5) * 0.2);
            react("ok");
            done?.();
          } else {
            react("no");
            arc(api, ball0, to, V(b.position.x + 0.5, 0.25, b.position.z + 0.6), 1.0, 0.5, () => { api.scene.remove(ball0); done?.(); });
          }
        });
      }
      function addWagon(color) {
        const w = wagon(color);
        w.scale.setScalar(0.85);
        const n = wagons.length;
        w.position.set(1.65 + n * 1.12, 0.12, 4.2);
        api.add(w);
        pop(api, w);
        wagons.push(w);
      }
      function clearWagons() { while (wagons.length) api.scene.remove(wagons.pop()); }
      function depart(ok, done) {
        const group = [eng, ...wagons];
        const starts = group.map((o) => o.position.clone());
        const dist = ok ? -1.2 : -0.5;
        api.tween(ok ? 1.4 : 0.7, (q) => group.forEach((o, n) => (o.position.x = starts[n].x + dist * ease.inOut(q))), () => {
          react(ok ? "ok" : "no");
          api.tween(1.0, () => {}, () => {
            const now = group.map((o) => o.position.clone());
            api.tween(0.6, (q) => group.forEach((o, n) => o.position.lerpVectors(now[n], starts[n], ease.inOut(q))), done);
          });
        });
      }
      function fly(back, done) {
        pl.visible = true;
        const a = b.position.clone().setY(1.5), top = lh.position.clone().add(V(0, 2.9, 0));
        api.tween(1.6, (k) => {
          const e = ease.inOut(k);
          pl.position.lerpVectors(a, top, e);
          pl.position.y += Math.sin(Math.PI * e) * 1.4;
          pl.lookAt(top);
        }, () => {
          glow = 1;
          if (!back) { pl.visible = false; done?.(); return; }
          api.tween(1.3, (k) => {
            const e = ease.inOut(k);
            pl.position.lerpVectors(top, a, e);
            pl.position.y += Math.sin(Math.PI * e) * 0.9;
            pl.lookAt(a);
          }, () => { pl.visible = false; react("ok"); done?.(); });
        });
      }
      function snap(ok) {
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
        react(ok ? "ok" : "no");
      }
      let made = 0;
      function makeItem(done) {
        hammering = 1;
        api.tween(1.6, () => {}, () => {
          hammering = 0;
          const pc = postcard([TOY.gold, TOY.mint, TOY.sky2][made % 3]);
          pc.scale.setScalar(0.55);
          const shelfSpot = shelf.localToWorld(V(-0.9 + (made % 3) * 0.9, 2.62, 0.12));
          pc.position.copy(shelfSpot);
          pc.rotation.y = shelf.rotation.y;
          api.add(pc);
          pop(api, pc);
          made++;
          react("ok");
          done?.();
        });
      }
      function celebrate() {
        chair.visible = true;
        pop(api, chair);
        const conf = [TOY.gold, TOY.coral, TOY.mint, TOY.sky2, TOY.pink];
        for (let i = 0; i < 30; i++) {
          const c = block(0.09, 0.02, 0.05, conf[i % 5], 0.01);
          c.castShadow = false;
          const x0 = (Math.random() - 0.5) * 3, z0 = (Math.random() - 0.5) * 2;
          c.position.set(x0, 3.5, z0);
          api.add(c);
          const vy = 0.5 + Math.random();
          api.tween(1.6 + Math.random(), (k) => { c.position.y = 3.5 + vy - (vy + 3.4) * k * k; c.rotation.x += 0.2; c.rotation.z += 0.15; }, () => api.scene.remove(c));
        }
        react("ok");
      }
      show("intro");
      return {
        camera: { pos: cam0.pos, target: cam0.target, fov: 32 },
        tick: (t, dt) => {
          rig.look();
          glow = Math.max(0, glow - dt * 0.6);
          lh.userData.lamp.emissiveIntensity = 0.5 + glow * 1.6;
          hm.rotation.x = hammering ? Math.sin(t * 16) * 0.8 : 0.2;
          bunnyTick(b, t, { cheer, shake, hop: b.userData.walking ? (t * 3) % 1 : 0 });
        },
        go, react, throwBall, addWagon, clearWagons, depart, fly, snap, makeItem, celebrate,
      };
    },
  },
  "world-await": {
    build(api) {
      api.add(island(13, 7));
      dress(api, [["tree", -5.4, -2.3, 0.85], ["tree", 5.5, -2.4, 0.8], ["bush", -5.6, 2.4, 0.8], ["flower", 3.4, 2.6], ["flower", -1.6, 2.8]]);
      api.add(track(-6.0, 6.0, 0.4));
      const eng = engine(TOY.red);
      eng.position.set(-3.4, 0.12, 0.4);
      api.add(eng);
      const lamps = { red: waxOwn(TOY.red, { emissive: 0 }), green: waxOwn(TOY.leafLight, { emissive: 0 }) };
      const sig = new THREE.Group();
      const post = disc(0.07, 1.8, TOY.ink);
      post.position.y = 0.9;
      const head = block(0.36, 0.7, 0.3, TOY.ink, 0.08);
      head.position.y = 1.95;
      const lr = ball(0.11, 0, lamps.red);
      lr.position.set(0, 2.1, 0.16);
      const lg = ball(0.11, 0, lamps.green);
      lg.position.set(0, 1.8, 0.16);
      sig.add(post, head, lr, lg);
      sig.position.set(0.4, 0, -0.35);
      api.add(sig);
      const sign = signboard(2.2, 0.95, TOY.sky2, 0.5);
      sign.position.set(2.8, 0, -1.6);
      api.add(sign);
      const signLabel = api.label(sign, "分享窗口：还没弹出", "sign");
      const line5 = api.label(V(0.4, 2.8, -0.35), "第 5 行：await", "tag big");
      line5.hidden = true;
      const b = bunny(0.7);
      b.position.set(-2.3, 0, 2.0);
      b.rotation.y = 0.5;
      api.add(b);
      let cheer = 0, shake = 0, running = false;
      const setLight = (c) => {
        lamps.red.emissive = new THREE.Color(c === "red" ? 0xff5a4a : 0);
        lamps.red.emissiveIntensity = c === "red" ? 0.9 : 0;
        lamps.green.emissive = new THREE.Color(c === "green" ? 0x7dff8a : 0);
        lamps.green.emissiveIntensity = c === "green" ? 0.9 : 0;
      };
      setLight("green");
      function reset() { eng.position.set(-3.4, 0.12, 0.4); setLight("green"); signLabel.el.textContent = "分享窗口：还没弹出"; }
      // play(events): the recorded run, told by the stage. onEvent(i) fires as each log line happens.
      function play(onEvent, withAwait = true, done) {
        if (running) return;
        running = true;
        reset();
        const x0 = -3.4;
        onEvent?.(0);
        api.tween(1.0, (k) => (eng.position.x = x0 + (-0.6 - x0) * ease.out(k)), () => {
          signLabel.el.textContent = "分享窗口：开着";
          onEvent?.(1);
          if (withAwait) {
            setLight("red");
            onEvent?.(2);
            api.tween(2.2, () => {}, () => {
              signLabel.el.textContent = "分享窗口：分享好了";
              onEvent?.(3);
              setLight("green");
              api.tween(1.0, (k) => (eng.position.x = -0.6 + 5.0 * ease.inOut(k)), () => { onEvent?.(4); running = false; cheer = 1; api.tween(1, () => {}, () => (cheer = 0)); done?.(); });
            });
          } else {
            api.tween(1.0, (k) => (eng.position.x = -0.6 + 5.0 * ease.inOut(k)), () => { onEvent?.(4); running = false; shake = 1; api.tween(0.8, () => {}, () => (shake = 0)); done?.(); });
          }
        });
      }
      function react(kind) {
        if (kind === "ok") { cheer = 1; api.tween(1.1, () => {}, () => (cheer = 0)); }
        else { shake = 1; api.tween(0.7, () => {}, () => (shake = 0)); }
      }
      return {
        camera: { pos: [0, 4.8, 8.8], target: [0, 1.0, 0.2], fov: 32 },
        tick: (t) => bunnyTick(b, t, { cheer, shake }),
        play, react, reset,
        showLine(v) { line5.hidden = !v; },
      };
    },
  },
  "world-town": {
    // Code town for an architecture lesson: modules are houses, a request is a cart,
    // storage places are warehouses. route(kind) drives one cart along the real call path.
    build(api) {
      api.add(island(13, 8.5));
      dress(api, [["tree", -5.6, -3.0, 0.75], ["tree", 5.8, 3.2, 0.7], ["bush", -5.8, 3.0, 0.7], ["flower", -4.6, 2.9], ["flower", 1.2, 3.4]]);
      const biz = house(TOY.cream);
      biz.position.set(-3.8, 0, 0.6);
      api.add(biz);
      api.label(biz, "业务代码", "tag");
      const hub = house(TOY.gold, 1.6, 1.4, 1.4);
      hub.position.set(-0.4, 0, 0.2);
      api.add(hub);
      api.label(hub, "存储总台", "tag big");
      const phone = warehouse(TOY.mint);
      phone.position.set(3.4, 0, -1.7);
      api.add(phone);
      api.label(phone, "手机里的抽屉", "tag");
      const web = warehouse(TOY.sky2);
      web.position.set(3.4, 0, 2.1);
      api.add(web);
      api.label(web, "浏览器里的抽屉", "tag");
      api.add(path([[-3.0, 0.9], [-1.3, 0.5]], 0.6));
      const toPhone = path([[0.5, 0.0], [2.5, -1.4]], 0.6, TOY.mint);
      const toWeb = path([[0.5, 0.5], [2.5, 1.8]], 0.6, 0xd9e4ee);
      api.add(toPhone, toWeb);
      const cart = block(0.5, 0.35, 0.4, TOY.coral, 0.08);
      cart.position.set(-3.0, 0.3, 1.2);
      api.add(cart);
      const cartTag = api.label(cart, "存一条记录", "mini");
      cartTag.offset.set(0, 0.55, 0);
      const ask = api.label(V(-0.9, 3.4, 0.2), "第 92 行：是手机吗？", "tag");
      ask.hidden = true;
      const b = bunny(0.6);
      b.position.set(-1.9, 0, 2.4);
      api.add(b);
      let cheer = 0, shake = 0, busy = false;
      const legs = {
        phone: [[-3.0, 1.2], [-0.4, 1.3], [0.9, -0.1], [2.6, -1.3]],
        web: [[-3.0, 1.2], [-0.4, 1.3], [0.9, 0.9], [2.6, 1.9]],
      };
      function react(kind) {
        if (kind === "ok") { cheer = 1; api.tween(1.1, () => {}, () => (cheer = 0)); }
        else { shake = 1; api.tween(0.7, () => {}, () => (shake = 0)); }
      }
      function reset() { cart.position.set(-3.0, 0.3, 1.2); ask.hidden = true; }
      // route(kind, onLeg): kind is "phone" or "web"; onLeg(i) fires as the cart reaches each stop.
      function route(kind, onLeg, done) {
        if (busy) return;
        busy = true;
        reset();
        const pts = legs[kind];
        let i = 0;
        const next = () => {
          onLeg?.(i);
          if (i === 1) ask.hidden = false;
          if (i >= pts.length - 1) { busy = false; react("ok"); done?.(); return; }
          const a = V(pts[i][0], 0.3, pts[i][1]), c = V(pts[i + 1][0], 0.3, pts[i + 1][1]);
          cart.rotation.y = Math.atan2(c.x - a.x, c.z - a.z) + Math.PI / 2;
          api.tween(i === 1 ? 0.5 : 0.8, (k) => cart.position.lerpVectors(a, c, ease.inOut(k)), () => {
            i++;
            api.tween(i === 1 ? 0.7 : 0.15, () => {}, next);
          });
        };
        next();
      }
      return {
        camera: { pos: [0.4, 8.6, 10.4], target: [0.3, 0.4, 0.4], fov: 34 },
        tick: (t) => bunnyTick(b, t, { cheer, shake }),
        route, react, reset,
      };
    },
  },
});
