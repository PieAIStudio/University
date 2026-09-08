/**
 * Procedural domain globe and atmospheric cloud geometry.
 *
 * Implements V5 Decision M:
 * - Domain globe with strict radius 1.0, SphereGeometry 64x32 (<5000 tris),
 *   continuous 3D low-frequency procedural vertex coloring (deep/soft ocean blue,
 *   grey-green continents, creamy shorelines, zero seam between hemispheres).
 * - Meteorological arc cloud bands at radius ~1.045, low-poly smooth rounded cloud clusters,
 *   single merged draw call (<=7000 tris), strictly outside the globe (r > 1.0).
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";

export const DOMAIN_GLOBE_RADIUS = 1.0;
export const DOMAIN_CLOUD_RADIUS = 1.045;
export const DOMAIN_GLOBE_TRIANGLES_MAX = 5000;
export const DOMAIN_CLOUD_TRIANGLES_MAX = 7000;

/** FNV-1a hash to 32-bit unsigned integer. */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG stream in [0, 1). */
function createRng(seed: string): () => number {
  let a = hashString(seed) || 0x12345678;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 3D Ken Perlin improved noise for seamless C^2 continuous evaluation
 * across spherical coordinates without UV seams or polar artifacts.
 */
class PerlinNoise3D {
  private readonly p: Uint8Array = new Uint8Array(512);

  constructor(rng: () => number) {
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = perm[i]!;
      perm[i] = perm[j]!;
      perm[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255]!;
    }
  }

  private grad(hashVal: number, x: number, y: number, z: number): number {
    const h = hashVal & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  public noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const u = x - Math.floor(x);
    const v = y - Math.floor(y);
    const w = z - Math.floor(z);

    const fx = this.fade(u);
    const fy = this.fade(v);
    const fz = this.fade(w);

    const A = this.p[X]! + Y;
    const AA = this.p[A]! + Z;
    const AB = this.p[A + 1]! + Z;
    const B = this.p[X + 1]! + Y;
    const BA = this.p[B]! + Z;
    const BB = this.p[B + 1]! + Z;

    return this.lerp(
      fz,
      this.lerp(
        fy,
        this.lerp(fx, this.grad(this.p[AA]!, u, v, w), this.grad(this.p[BA]!, u - 1, v, w)),
        this.lerp(fx, this.grad(this.p[AB]!, u, v - 1, w), this.grad(this.p[BB]!, u - 1, v - 1, w)),
      ),
      this.lerp(
        fy,
        this.lerp(
          fx,
          this.grad(this.p[AA + 1]!, u, v, w - 1),
          this.grad(this.p[BA + 1]!, u - 1, v, w - 1),
        ),
        this.lerp(
          fx,
          this.grad(this.p[AB + 1]!, u, v - 1, w - 1),
          this.grad(this.p[BB + 1]!, u - 1, v - 1, w - 1),
        ),
      ),
    );
  }
}

// Muted, painterly color stops
const COLOR_DEEP_OCEAN = new THREE.Color(0.18, 0.35, 0.54);
const COLOR_SHALLOW_OCEAN = new THREE.Color(0.28, 0.48, 0.62);
const COLOR_CREAM_SHORE = new THREE.Color(0.88, 0.84, 0.72);
const COLOR_CONTINENT = new THREE.Color(0.38, 0.5, 0.38);
const COLOR_HIGHLAND = new THREE.Color(0.29, 0.4, 0.3);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleGlobeColor(v: number, target: THREE.Color): void {
  if (v < -0.02) {
    target.copy(COLOR_DEEP_OCEAN).lerp(COLOR_SHALLOW_OCEAN, smoothstep(-0.45, -0.02, v));
  } else if (v < 0.015) {
    target.copy(COLOR_SHALLOW_OCEAN).lerp(COLOR_CREAM_SHORE, smoothstep(-0.02, 0.015, v));
  } else if (v < 0.045) {
    target.copy(COLOR_CREAM_SHORE).lerp(COLOR_CONTINENT, smoothstep(0.015, 0.045, v));
  } else {
    target.copy(COLOR_CONTINENT).lerp(COLOR_HIGHLAND, smoothstep(0.045, 0.38, v));
  }
}

/**
 * Creates the domain globe geometry:
 * - Strict radius 1.0, SphereGeometry 64x32 (3968 tris, <5000 budget).
 * - Smooth vertex normals.
 * - Vertex colors driven by continuous 3D low-frequency noise (no hemisphere seam, no latitude stripes).
 */
function domainColorSampler(
  seed: string,
): (x: number, y: number, z: number, target: THREE.Color) => void {
  const rng = createRng(`globe:${seed}`);
  const perlin = new PerlinNoise3D(rng);
  const ox = rng() * 100,
    oy = rng() * 100,
    oz = rng() * 100;
  return (x, y, z, target) => {
    const n =
      perlin.noise(x * 1.35 + ox, y * 1.35 + oy, z * 1.35 + oz) * 0.72 +
      perlin.noise(x * 2.8 + ox + 31.7, y * 2.8 + oy + 47.3, z * 2.8 + oz + 19.1) * 0.22 +
      perlin.noise(x * 5.6 + ox + 67.2, y * 5.6 + oy + 89.4, z * 5.6 + oz + 41.5) * 0.06;
    sampleGlobeColor(n, target);
  };
}

/** One CPU bake per mounted domain: 2 MiB, no per-frame noise or remote textures. */
export function createDomainSurfaceTexture(seed: string): THREE.DataTexture {
  const width = 1024,
    height = 512;
  const pixels = new Uint8Array(width * height * 4);
  const sample = domainColorSampler(seed);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const theta = (1 - (y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width) * Math.PI * 2;
      sample(
        -Math.cos(phi) * Math.sin(theta),
        Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        color,
      );
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(color.r * 255);
      pixels[offset + 1] = Math.round(color.g * 255);
      pixels[offset + 2] = Math.round(color.b * 255);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createDomainGlobeGeometry(seed: string): THREE.BufferGeometry {
  const sample = domainColorSampler(seed);
  const globe = new THREE.SphereGeometry(DOMAIN_GLOBE_RADIUS, 64, 32);
  const pos = globe.attributes.position;
  if (!pos) throw new Error("Globe missing position attribute");

  const colors = new Float32Array(pos.count * 3);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    sample(x, y, z, tmpColor);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  globe.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return globe;
}

/**
 * Creates the domain cloud geometry:
 * - Single merged geometry from low-poly rounded puffs (Icosahedron detail 1).
 * - Organized in meteorological arc bands around radius ~1.045.
 * - Triangles guaranteed <= 7000.
 * - Every vertex is strictly outside the globe (r > 1.0).
 * - Returns position and normal attributes.
 */
export function createDomainCloudGeometry(seed: string): THREE.BufferGeometry {
  const rng = createRng(`cloud:${seed}`);
  const puffs: THREE.BufferGeometry[] = [];

  const bandCount = 3;
  const longitudeOrigin = rng() * Math.PI * 2;
  for (let b = 0; b < bandCount; b++) {
    const latitude = -0.46 + b * 0.46;
    const arcLength = 1.6 + rng() * 0.8;
    // Stagger longitudes so one accidental seed cannot hide every band behind the sphere.
    const arcStart = longitudeOrigin + (b * Math.PI * 2) / bandCount;
    // Seven overlapping clusters read as an arc at orbital scale, rather
    // than five isolated flat dashes. Even 4 lobes each stay below 7,000 tris.
    const clusterCount = 7;

    for (let c = 0; c < clusterCount; c++) {
      const t = c / (clusterCount - 1);
      const angle = arcStart + t * arcLength;
      const wobble = Math.sin(t * Math.PI) * 0.12 * (rng() - 0.5);

      const lat = latitude + Math.sin(t * Math.PI) * 0.14 + wobble;
      const clusterDir = new THREE.Vector3(
        Math.cos(angle) * Math.cos(lat),
        Math.sin(lat),
        Math.sin(angle) * Math.cos(lat),
      );

      // 3 to 4 rounded puffs per cluster (80 tris each)
      const puffCount = 3 + Math.floor(rng() * 2);
      for (let p = 0; p < puffCount; p++) {
        const baseRadius = 0.038 + rng() * 0.022;
        const puffGeom = new THREE.IcosahedronGeometry(baseRadius, 1);
        puffGeom.deleteAttribute("uv");

        const radial = clusterDir.clone();
        const t1Ref =
          Math.abs(radial.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const t1 = new THREE.Vector3().crossVectors(radial, t1Ref).normalize();
        const t2 = new THREE.Vector3().crossVectors(radial, t1).normalize();

        const offsetT1 = (p - (puffCount - 1) / 2) * 0.055 + (rng() - 0.5) * 0.012;
        const offsetT2 = (rng() - 0.5) * 0.026;
        const offsetR = (rng() - 0.5) * 0.006;

        const puffPos = radial
          .clone()
          .multiplyScalar(DOMAIN_CLOUD_RADIUS + offsetR)
          .addScaledVector(t1, offsetT1)
          .addScaledVector(t2, offsetT2);

        // Flatten slightly along radial direction, spread along tangent plane
        const puffRadial = puffPos.clone().normalize();
        const puffT1Ref =
          Math.abs(puffRadial.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const puffT1 = new THREE.Vector3().crossVectors(puffRadial, puffT1Ref).normalize();
        const puffT2 = new THREE.Vector3().crossVectors(puffT1, puffRadial).normalize();

        const rotMatrix = new THREE.Matrix4().makeBasis(puffT1, puffRadial, puffT2);
        const scaleMatrix = new THREE.Matrix4().makeScale(1.4, 0.55, 0.9);
        const transMatrix = new THREE.Matrix4().makeTranslation(puffPos.x, puffPos.y, puffPos.z);

        const transform = transMatrix.multiply(rotMatrix).multiply(scaleMatrix);
        puffGeom.applyMatrix4(transform);

        // Guard: ensure every vertex is strictly outside the globe (r >= 1.018 > 1.0)
        const pAttr = puffGeom.attributes.position;
        if (pAttr) {
          for (let vi = 0; vi < pAttr.count; vi++) {
            const vx = pAttr.getX(vi);
            const vy = pAttr.getY(vi);
            const vz = pAttr.getZ(vi);
            const r = Math.hypot(vx, vy, vz);
            if (r < 1.018) {
              const scale = 1.018 / r;
              pAttr.setXYZ(vi, vx * scale, vy * scale, vz * scale);
            }
          }
          pAttr.needsUpdate = true;
        }

        puffs.push(puffGeom);
      }
    }
  }

  const merged = mergeBufferGeometries(puffs, false);
  for (const g of puffs) {
    g.dispose();
  }

  if (!merged) {
    throw new Error("Failed to merge cloud band geometries");
  }

  if (merged.getAttribute("uv")) {
    merged.deleteAttribute("uv");
  }
  // Preserve the transformed smooth puff normals; recomputing this non-indexed
  // mesh would turn the thin cloudlets into faceted rocks.
  return merged;
}
