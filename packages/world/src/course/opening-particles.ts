import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { roundedStarGeometry } from "../craft/toy-craft.js";

/**
 * The loot that flies out of an opening chest: stars, cards, gems, confetti and
 * (gold only) coins, plus soft sparks. One pooled InstancedMesh per kind and one
 * Points cloud, so a four-wave gold opening is a handful of draws rather than
 * the review prototype's one mesh per piece. Physics is the prototype's: thrown
 * up, gravity, drag, a bounce on the ground; confetti drifts and vanishes.
 */

export type PieceKind = "star" | "card" | "gem" | "confetti" | "coin";

interface Piece {
  kind: PieceKind;
  slot: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  rotation: THREE.Euler;
  drag: number;
  alive: boolean;
}

interface Spark {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  ttl: number;
  drag: number;
  colour: THREE.Color;
}

const CAPACITY: Readonly<Record<PieceKind, number>> = {
  star: 160,
  card: 60,
  gem: 80,
  confetti: 220,
  coin: 140,
};
const SPARKS = 600;
const CONFETTI = [0xff5ea5, 0xffd84d, 0x4fd3ff, 0x7dff9a, 0xb07bff, 0xffffff];
const GEMS = [0xff6fb5, 0x6fd3ff, 0xb68bff, 0x7dffb0];
const FIREWORK = [0xffe14a, 0xff6fb5, 0x6fd3ff, 0xb68bff];

/** A soft round dot, made in memory so it needs neither a canvas nor a download. */
export function softDotTexture(size = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.6;
      data.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

export class OpeningParticles {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PieceKind, THREE.InstancedMesh>();
  private readonly pieces: Piece[] = [];
  private readonly free = new Map<PieceKind, number[]>();
  private readonly sparks: Spark[] = [];
  private readonly sparkGeometry = new THREE.BufferGeometry();
  private readonly sparkPoints: THREE.Points;
  private readonly dot = softDotTexture();
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private random: () => number;

  constructor(seed = 1) {
    let state = Math.max(1, Math.floor(seed)) % 2147483647;
    this.random = () => (state = (state * 16807) % 2147483647) / 2147483647;
    const geometry: Record<PieceKind, THREE.BufferGeometry> = {
      star: roundedStarGeometry(0.07, 0.034, 0.018, 0.008),
      card: new RoundedBoxGeometry(0.12, 0.16, 0.01, 2, 0.012),
      gem: new THREE.OctahedronGeometry(0.06, 0),
      confetti: new THREE.PlaneGeometry(0.05, 0.028),
      coin: new THREE.CylinderGeometry(0.06, 0.06, 0.016, 16),
    };
    const material: Record<PieceKind, THREE.Material> = {
      star: new THREE.MeshStandardMaterial({
        color: 0xffcf3a,
        roughness: 0.25,
        metalness: 0.4,
        emissive: 0x7a4a00,
        emissiveIntensity: 0.35,
      }),
      card: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x333333 }),
      gem: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, emissive: 0x222222 }),
      confetti: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      coin: new THREE.MeshStandardMaterial({
        color: 0xffd23c,
        roughness: 0.2,
        metalness: 0.6,
        emissive: 0x6a4200,
        emissiveIntensity: 0.3,
      }),
    };
    for (const kind of Object.keys(CAPACITY) as PieceKind[]) {
      const mesh = new THREE.InstancedMesh(geometry[kind], material[kind], CAPACITY[kind]);
      mesh.name = `opening-${kind}`;
      mesh.frustumCulled = false;
      for (let slot = 0; slot < CAPACITY[kind]; slot += 1) mesh.setMatrixAt(slot, this.hidden);
      if (kind === "gem" || kind === "confetti")
        for (let slot = 0; slot < CAPACITY[kind]; slot += 1)
          mesh.setColorAt(slot, new THREE.Color(0xffffff));
      mesh.raycast = () => {};
      this.meshes.set(kind, mesh);
      this.free.set(
        kind,
        Array.from({ length: CAPACITY[kind] }, (_, slot) => CAPACITY[kind] - 1 - slot),
      );
      this.group.add(mesh);
    }
    this.sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3),
    );
    this.sparkGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3),
    );
    this.sparkGeometry.setDrawRange(0, 0);
    this.sparkPoints = new THREE.Points(
      this.sparkGeometry,
      new THREE.PointsMaterial({
        size: 0.22,
        map: this.dot,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.sparkPoints.frustumCulled = false;
    this.sparkPoints.raycast = () => {};
    this.group.add(this.sparkPoints);
  }

  private add(kind: PieceKind, position: THREE.Vector3, velocity: THREE.Vector3, drag: number) {
    const slot = this.free.get(kind)!.pop();
    if (slot === undefined) return;
    if (kind === "gem" || kind === "confetti") {
      const palette = kind === "gem" ? GEMS : CONFETTI;
      this.meshes
        .get(kind)!
        .setColorAt(slot, new THREE.Color(palette[Math.floor(this.random() * palette.length)]!));
    }
    this.pieces.push({
      kind,
      slot,
      position: position.clone(),
      velocity,
      spin: new THREE.Vector3(this.random() * 8, this.random() * 8, this.random() * 8),
      rotation: new THREE.Euler(),
      drag,
      alive: true,
    });
  }

  private spark(position: THREE.Vector3, velocity: THREE.Vector3, ttl: number, colour: number) {
    if (this.sparks.length >= SPARKS) return;
    this.sparks.push({
      position: position.clone(),
      velocity,
      age: 0,
      ttl,
      drag: 1.6,
      colour: new THREE.Color(colour),
    });
  }

  /** One wave of loot out of the chest's mouth at `rim` (local units), `gold` adds coins. */
  spray(pieces: number, power: number, rim: number, glow: number, gold: boolean) {
    for (let index = 0; index < pieces; index += 1) {
      const r = this.random();
      const kind: PieceKind =
        r < 0.3
          ? "star"
          : r < 0.4
            ? "card"
            : r < 0.52
              ? "gem"
              : gold && r < 0.62
                ? "coin"
                : "confetti";
      const a = this.random() * Math.PI * 2;
      const speed =
        (kind === "confetti" ? 1.2 + this.random() * 1.8 : 0.8 + this.random() * 1.4) * power;
      this.add(
        kind,
        new THREE.Vector3((this.random() - 0.5) * 0.4, rim + 0.15, (this.random() - 0.5) * 0.25),
        new THREE.Vector3(
          Math.cos(a) * speed * 0.6,
          (3.2 + this.random() * 2.2) * power,
          Math.sin(a) * speed * 0.45 + 0.6,
        ),
        kind === "confetti" ? 2.2 : 0.4,
      );
    }
    for (let index = 0; index < Math.round(pieces * 0.4); index += 1) {
      const a = this.random() * Math.PI * 2;
      this.spark(
        new THREE.Vector3(0, rim + 0.2, 0),
        new THREE.Vector3(
          Math.cos(a) * 2.2 * power,
          (1 + this.random() * 3) * power,
          Math.sin(a) * 1.6 * power,
        ),
        0.6 + this.random() * 0.6,
        glow,
      );
    }
  }

  /** A burst of sparks in the sky behind the chest. */
  firework() {
    const centre = new THREE.Vector3(
      (this.random() - 0.5) * 3.2,
      2.2 + this.random() * 1.4,
      -0.6 - this.random() * 1.2,
    );
    const colour = FIREWORK[Math.floor(this.random() * FIREWORK.length)]!;
    for (let index = 0; index < 28; index += 1) {
      const u = this.random() * 2 - 1;
      const theta = this.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      this.spark(
        centre,
        new THREE.Vector3(r * Math.cos(theta), u, r * Math.sin(theta)).multiplyScalar(
          1.6 + this.random() * 0.6,
        ),
        1.1 + this.random() * 0.4,
        colour,
      );
    }
  }

  /** Gold coins falling from the sky around the chest. */
  rain(count: number) {
    for (let index = 0; index < count; index += 1)
      this.add(
        "coin",
        new THREE.Vector3(
          (this.random() - 0.5) * 4,
          3.5 + this.random() * 1.5,
          (this.random() - 0.5) * 2,
        ),
        new THREE.Vector3(0, -this.random() * 1.5, 0),
        0.2,
      );
  }

  update(dt: number) {
    for (const piece of this.pieces) {
      if (!piece.alive) continue;
      piece.velocity.y -= 7.5 * dt;
      piece.velocity.multiplyScalar(Math.max(0, 1 - piece.drag * dt));
      piece.position.addScaledVector(piece.velocity, dt);
      piece.rotation.x += piece.spin.x * dt;
      piece.rotation.y += piece.spin.y * dt;
      piece.rotation.z += piece.spin.z * dt;
      if (piece.kind !== "confetti" && piece.position.y < 0.02) {
        piece.position.y = 0.02;
        piece.velocity.y *= -0.35;
        piece.velocity.x *= 0.6;
        piece.velocity.z *= 0.6;
      }
      const mesh = this.meshes.get(piece.kind)!;
      if (piece.kind === "confetti" && piece.position.y < 0) {
        piece.alive = false;
        mesh.setMatrixAt(piece.slot, this.hidden);
        this.free.get(piece.kind)!.push(piece.slot);
        continue;
      }
      mesh.setMatrixAt(
        piece.slot,
        this.matrix.compose(piece.position, this.quaternion.setFromEuler(piece.rotation), this.one),
      );
    }
    for (const mesh of this.meshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const position = this.sparkGeometry.getAttribute("position") as THREE.BufferAttribute;
    const colour = this.sparkGeometry.getAttribute("color") as THREE.BufferAttribute;
    let live = 0;
    for (const spark of this.sparks) {
      spark.age += dt;
      if (spark.age > spark.ttl) continue;
      spark.velocity.y -= 2.5 * dt;
      spark.velocity.multiplyScalar(Math.max(0, 1 - spark.drag * dt));
      spark.position.addScaledVector(spark.velocity, dt);
      const fade = 1 - spark.age / spark.ttl;
      position.setXYZ(live, spark.position.x, spark.position.y, spark.position.z);
      // Additive: darker is more transparent, so fading is scaling the colour.
      colour.setXYZ(live, spark.colour.r * fade, spark.colour.g * fade, spark.colour.b * fade);
      live += 1;
    }
    this.sparkGeometry.setDrawRange(0, live);
    position.needsUpdate = true;
    colour.needsUpdate = true;
  }

  /** Everything flying or lying about, for tests and for the timing gate. */
  get active(): number {
    return this.pieces.filter((piece) => piece.alive).length;
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.sparkGeometry.dispose();
    (this.sparkPoints.material as THREE.Material).dispose();
    this.dot.dispose();
  }
}
