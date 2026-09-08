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
  DOMAIN_CLOUD_SEGMENTS,
} from "./globe-geometry.js";
import { CLOUD_VOLUME_CONTRACT, createCloudVolumeGeometry } from "../sky/cloud-volume.js";

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
  it("leaves real region directions clear and can omit all decoration without inventing a layer", () => {
    const original = createDomainCloudGeometry("region-clearance");
    const positions = original.getAttribute("position");
    const perBank = positions.count / 7;
    const protectedDirections = Array.from({ length: 7 }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(positions, i * perBank).normalize(),
    );
    const partial = createDomainCloudGeometry("region-clearance", protectedDirections.slice(0, 1));
    const empty = createDomainCloudGeometry("region-clearance", protectedDirections);
    try {
      expect(partial.userData.cloudBankCount).toBeLessThan(7);
      expect(partial.index!.count).toBeLessThan(original.index!.count);
      const vertices = partial.getAttribute("position");
      for (let i = 0; i < vertices.count; i += perBank) {
        const centre = new THREE.Vector3().fromBufferAttribute(vertices, i).normalize();
        expect(centre.dot(protectedDirections[0]!)).toBeLessThanOrEqual(Math.cos(0.48) + 1e-6);
      }
      expect(empty.userData.cloudBankCount).toBe(0);
      expect(empty.index?.count ?? 0).toBe(0);
    } finally {
      original.dispose();
      partial.dispose();
      empty.dispose();
    }
  });
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
    expect(triangles).toBe(1680);
    expect(cloud.groups).toHaveLength(0);
    expect(cloud.userData.cloudBankCount).toBe(7);
    expect(cloud.userData.cloudVolume).toEqual(CLOUD_VOLUME_CONTRACT);
    cloud.dispose();
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

it("keeps every cloud bank outward wound after its tangent-space transform", () => {
  const geometry = createDomainCloudGeometry("programming");
  const p = geometry.getAttribute("position");
  const indices = geometry.index!;
  const source = createCloudVolumeGeometry(
    DOMAIN_CLOUD_SEGMENTS.width,
    DOMAIN_CLOUD_SEGMENTS.height,
  );
  const bankIndexCount = source.index!.count;
  const bankVertexCount = source.getAttribute("position").count;
  expect(p.count).toBe(bankVertexCount * 7);
  for (let bank = 0; bank < 7; bank += 1) {
    let signedVolume = 0;
    for (let i = bank * bankIndexCount; i < (bank + 1) * bankIndexCount; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 2));
      signedVolume += a.dot(b.cross(c));
    }
    expect(signedVolume).toBeGreaterThan(0);
  }
  source.dispose();
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
