/**
 * Procedural domain globe and atmospheric cloud geometry.
 *
 * Implements V5 Decision M:
 * - Domain globe with strict radius 1.0, SphereGeometry 64x32 (<5000 tris),
 *   continuous 3D low-frequency procedural vertex coloring (deep/soft ocean blue,
 *   grey-green continents, creamy shorelines, zero seam between hemispheres).
 * - Arc cloud banks at radius ~1.045, one continuous shallow source per cluster,
 *   single merged draw call (<=7000 tris), strictly outside the globe (r > 1.0).
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { CLOUD_TONES } from "../sky/cloud-material.js";
import { CLOUD_VOLUME_CONTRACT, createCloudVolumeGeometry } from "../sky/cloud-volume.js";
import { domainSurfacePalette, type DomainSurfaceStyle } from "./globe-style.js";

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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleGlobeColor(
  v: number,
  target: THREE.Color,
  palette: ReturnType<typeof domainSurfacePalette>,
): void {
  if (v < -0.02) {
    target.copy(palette.deep).lerp(palette.shallow, smoothstep(-0.45, -0.02, v));
  } else if (v < 0.015) {
    target.copy(palette.shallow).lerp(palette.shore, smoothstep(-0.02, 0.015, v));
  } else if (v < 0.045) {
    target.copy(palette.shore).lerp(palette.land, smoothstep(0.015, 0.045, v));
  } else {
    target.copy(palette.land).lerp(palette.highland, smoothstep(0.045, 0.38, v));
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
  style: DomainSurfaceStyle = "meadow",
): (x: number, y: number, z: number, target: THREE.Color) => number {
  const palette = domainSurfacePalette(style);
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
    sampleGlobeColor(n, target, palette);
    // Share the exact coastline with the material; never infer water from hue.
    return smoothstep(-0.04, 0.025, n);
  };
}

/** One CPU bake per mounted domain: 2 MiB, no per-frame noise or remote textures. */
export function createDomainSurfaceTexture(
  seed: string,
  style: DomainSurfaceStyle = "meadow",
): THREE.DataTexture {
  const width = 1024,
    height = 512;
  const pixels = new Uint8Array(width * height * 4);
  const sample = domainColorSampler(seed, style);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const theta = (1 - (y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width) * Math.PI * 2;
      const land = sample(
        -Math.cos(phi) * Math.sin(theta),
        Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        color,
      );
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(color.r * 255);
      pixels[offset + 1] = Math.round(color.g * 255);
      pixels[offset + 2] = Math.round(color.b * 255);
      pixels[offset + 3] = Math.round(land * 255);
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

export function createDomainGlobeGeometry(
  seed: string,
  style: DomainSurfaceStyle = "meadow",
): THREE.BufferGeometry {
  const sample = domainColorSampler(seed, style);
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

/** One shallow cloud bank per cluster, from the same source as the carrier.
 * A positive-determinant tangent basis places each bank outside the globe.
 * No sphere chain, per-frame rebuild, external texture or extra cloud draw.
 */
export const DOMAIN_CLOUD_SEGMENTS = { width: 24, height: 6 } as const;

export function createDomainCloudGeometry(
  seed: string,
  protectedDirections: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[] = [],
): THREE.BufferGeometry {
  const rng = createRng(`cloud:${seed}`);
  const banks: THREE.BufferGeometry[] = [];
  const source = createCloudVolumeGeometry(
    DOMAIN_CLOUD_SEGMENTS.width,
    DOMAIN_CLOUD_SEGMENTS.height,
  );
  const sourceColors = source.getAttribute("color");
  const tone = new THREE.Color(CLOUD_TONES.pearl);
  for (let index = 0; index < sourceColors.count; index += 1) {
    sourceColors.setXYZ(
      index,
      sourceColors.getX(index) * tone.r,
      sourceColors.getY(index) * tone.g,
      sourceColors.getZ(index) * tone.b,
    );
  }

  const clusterCount = 7;
  const longitudeOrigin = rng() * Math.PI * 2;
  // Seven separated banks, not seven beads on each of three latitude rows.
  // The first R38 screenshot still read as a necklace despite welded clouds.
  // Low-discrepancy positions keep broad quiet sky between whole silhouettes.
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const angle = longitudeOrigin + cluster * Math.PI * (3 - Math.sqrt(5));
    const lat = Math.asin(0.76 * (1 - (2 * (cluster + 0.5)) / clusterCount));
    const radial = new THREE.Vector3(
      Math.cos(angle) * Math.cos(lat),
      Math.sin(lat),
      Math.sin(angle) * Math.cos(lat),
    );
    // The region plan is canonical. Leave a cone wider than a whole bank plus
    // the representative islands; never conceal a learning destination with
    // decorative clouds. Selection does not regenerate this layout.
    if (
      protectedDirections.some((direction) => {
        const length = Math.hypot(direction.x, direction.y, direction.z);
        return length > 1e-8 && radial.dot(direction) / length > Math.cos(0.48);
      })
    )
      continue;
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3().crossVectors(tangent, radial).normalize();
    const basis = new THREE.Matrix4().makeBasis(tangent, radial, across);
    const scale = 0.13 + rng() * 0.055;
    // The source is already shallow. This radial flatten preserves the
    // established atmospheric layer; it does not flatten a chain of balls.
    const transform = new THREE.Matrix4()
      .makeTranslation(radial.clone().multiplyScalar(DOMAIN_CLOUD_RADIUS))
      .multiply(basis)
      .multiply(new THREE.Matrix4().makeRotationY((rng() - 0.5) * 0.34))
      .multiply(new THREE.Matrix4().makeScale(scale * 1.4, scale * 0.55, scale * 0.9));
    banks.push(source.clone().applyMatrix4(transform));
  }

  const merged = banks.length ? mergeBufferGeometries(banks, false) : new THREE.BufferGeometry();
  source.dispose();
  for (const bank of banks) bank.dispose();
  if (!merged) throw new Error("Failed to merge cloud bank geometries");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.userData.cloudVolume = CLOUD_VOLUME_CONTRACT;
  merged.userData.cloudBankCount = banks.length;
  return merged;
}
