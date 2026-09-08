import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createDomainSurfaceTexture,
  createDomainGlobeGeometry,
  createDomainCloudGeometry,
  DOMAIN_GLOBE_RADIUS,
  DOMAIN_CLOUD_RADIUS,
  DOMAIN_GLOBE_TRIANGLES_MAX,
  DOMAIN_CLOUD_TRIANGLES_MAX,
} from "./globe-geometry.js";

function getTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const pos = geometry.getAttribute("position");
  return pos ? pos.count / 3 : 0;
}

function assertFiniteAttributes(geometry: THREE.BufferGeometry) {
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.getAttribute(name);
    expect(attr).toBeDefined();
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < attr.itemSize; c++) {
        const val = attr.getComponent(i, c);
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
      }
    }
  }
}

describe("Domain Globe Geometry", () => {
  const TEST_SEED = "programming-foundation";

  it("produces strictly finite values across all attributes", () => {
    const globe = createDomainGlobeGeometry(TEST_SEED);
    assertFiniteAttributes(globe);
    expect(globe.getAttribute("position")).toBeDefined();
    expect(globe.getAttribute("normal")).toBeDefined();
    expect(globe.getAttribute("color")).toBeDefined();
  });

  it("maintains strict true spherical radius 1.0 without bumpy displacement", () => {
    const globe = createDomainGlobeGeometry(TEST_SEED);
    const pos = globe.getAttribute("position");
    expect(pos).toBeDefined();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, y, z);
      expect(r).toBeCloseTo(DOMAIN_GLOBE_RADIUS, 5);
    }
  });

  it("meets triangle budget (< 5000 triangles)", () => {
    const globe = createDomainGlobeGeometry(TEST_SEED);
    const triangles = getTriangleCount(globe);
    expect(triangles).toBeLessThan(DOMAIN_GLOBE_TRIANGLES_MAX);
    // SphereGeometry(1, 64, 32) yields exactly 3968 triangles
    expect(triangles).toBe(3968);
  });

  it("is deterministic for identical seeds", () => {
    const g1 = createDomainGlobeGeometry("seed-alpha");
    const g2 = createDomainGlobeGeometry("seed-alpha");

    const c1 = g1.getAttribute("color").array;
    const c2 = g2.getAttribute("color").array;
    expect(c1).toEqual(c2);
  });

  it("varies with different seeds", () => {
    const g1 = createDomainGlobeGeometry("seed-alpha");
    const g2 = createDomainGlobeGeometry("seed-beta");

    const c1 = g1.getAttribute("color").array;
    const c2 = g2.getAttribute("color").array;
    expect(c1).not.toEqual(c2);
  });

  it("is seamless across the antimeridian and avoids latitude stripes", () => {
    const globe = createDomainGlobeGeometry(TEST_SEED);
    const pos = globe.getAttribute("position");
    const color = globe.getAttribute("color");

    // Check seam continuity: vertex at u=0 vs u=1 at same latitude ring
    // SphereGeometry 64x32 has 65 vertices per row (0..64)
    for (let lat = 0; lat <= 32; lat++) {
      const idx0 = lat * 65;
      const idx1 = lat * 65 + 64;
      const d = Math.hypot(
        pos.getX(idx0) - pos.getX(idx1),
        pos.getY(idx0) - pos.getY(idx1),
        pos.getZ(idx0) - pos.getZ(idx1),
      );
      expect(d).toBeLessThan(1e-6);

      const colorDiff = Math.hypot(
        color.getX(idx0) - color.getX(idx1),
        color.getY(idx0) - color.getY(idx1),
        color.getZ(idx0) - color.getZ(idx1),
      );
      expect(colorDiff).toBeLessThan(1e-5);
    }

    // Check color variance across different longitudes at the equator (latitude ring 16)
    const eqColors: number[] = [];
    for (let lon = 0; lon < 64; lon += 8) {
      const idx = 16 * 65 + lon;
      eqColors.push(color.getX(idx));
    }
    const allSame = eqColors.every((c) => Math.abs(c - eqColors[0]!) < 1e-4);
    expect(allSame).toBe(false);
  });
});

describe("Domain Cloud Geometry", () => {
  const TEST_SEED = "weather-system-01";

  it("produces finite values and valid position and normal attributes", () => {
    const cloud = createDomainCloudGeometry(TEST_SEED);
    assertFiniteAttributes(cloud);
    expect(cloud.getAttribute("position")).toBeDefined();
    expect(cloud.getAttribute("normal")).toBeDefined();
  });

  it("merges into a single geometry within triangle budget (<= 7000 tris)", () => {
    const cloud = createDomainCloudGeometry(TEST_SEED);
    const triangles = getTriangleCount(cloud);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(DOMAIN_CLOUD_TRIANGLES_MAX);
  });

  it("places all vertices strictly outside the globe (r > 1.0)", () => {
    const cloud = createDomainCloudGeometry(TEST_SEED);
    const pos = cloud.getAttribute("position");
    expect(pos).toBeDefined();

    let minR = Infinity;
    let maxR = -Infinity;
    let sumR = 0;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, y, z);
      expect(r).toBeGreaterThan(1.0);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      sumR += r;
    }

    const avgR = sumR / pos.count;
    // Every vertex is strictly outside the globe
    expect(minR).toBeGreaterThan(1.01);
    // Average radius is aligned with meteorological layer (~1.045)
    expect(avgR).toBeCloseTo(DOMAIN_CLOUD_RADIUS, 1);
    expect(avgR).toBeGreaterThan(1.03);
    expect(avgR).toBeLessThan(1.07);
  });

  it("is deterministic for identical seeds", () => {
    const c1 = createDomainCloudGeometry("cloud-seed-xyz");
    const c2 = createDomainCloudGeometry("cloud-seed-xyz");

    const p1 = c1.getAttribute("position").array;
    const p2 = c2.getAttribute("position").array;
    expect(p1).toEqual(p2);
  });

  it("varies with different seeds", () => {
    const c1 = createDomainCloudGeometry("cloud-seed-xyz");
    const c2 = createDomainCloudGeometry("cloud-seed-abc");

    const p1 = c1.getAttribute("position").array;
    const p2 = c2.getAttribute("position").array;
    expect(p1).not.toEqual(p2);
  });
});

it("keeps cloud lobes outward wound after their tangent-space transform", () => {
  const geometry = createDomainCloudGeometry("programming");
  const p = geometry.getAttribute("position");
  let signedVolume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i),
      ay = p.getY(i),
      az = p.getZ(i);
    const bx = p.getX(i + 1),
      by = p.getY(i + 1),
      bz = p.getZ(i + 1);
    const cx = p.getX(i + 2),
      cy = p.getY(i + 2),
      cz = p.getZ(i + 2);
    signedVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  expect(signedVolume).toBeGreaterThan(0);
  geometry.dispose();
});

describe("domain surface texture", () => {
  it("stays within 2 MiB per domain and uses the shared linear colour pipeline", () => {
    const first = createDomainSurfaceTexture("programming");
    const second = createDomainSurfaceTexture("programming");
    expect(first.image.data).not.toBeNull();
    expect(first.image.data!.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(first.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(first.wrapS).toBe(THREE.RepeatWrapping);
    expect(first.image.data).toEqual(second.image.data);
    first.dispose();
    second.dispose();
  });
});
