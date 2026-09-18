import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { describe, expect, it } from "vitest";

import {
  createMiniatureAsset,
  miniatureAssetBounds,
  type MiniatureAssetKind,
} from "./miniature-assets.js";

const KINDS = [
  "fir",
  "broadleaf",
  "blossom",
  "autumn",
  "stone",
  "crystal",
  "ruin",
  "windmill",
  "gate",
  "fence",
  "flowers",
  "grass",
  "fern",
  "leafy",
  "mushroom",
  "snowpeak",
] as const satisfies readonly MiniatureAssetKind[];

const TALL_KINDS = new Set<MiniatureAssetKind>([
  "fir",
  "broadleaf",
  "blossom",
  "autumn",
  "crystal",
  "ruin",
  "windmill",
  "gate",
  "snowpeak",
]);

const EXPECTED_TRIANGLES = {
  fir: 408,
  broadleaf: 292,
  blossom: 272,
  autumn: 252,
  stone: 80,
  crystal: 80,
  ruin: 264,
  windmill: 508,
  gate: 160,
  fence: 160,
  flowers: 248,
  grass: 80,
  fern: 24,
  leafy: 32,
  mushroom: 48,
  snowpeak: 52,
} as const satisfies Record<MiniatureAssetKind, number>;

const EXPECTED_BOUNDS = {
  fir: { radius: 0.335, height: 1 },
  broadleaf: { radius: 0.407368, height: 1 },
  blossom: { radius: 0.418343, height: 1 },
  autumn: { radius: 0.425053, height: 1 },
  stone: { radius: 0.47034, height: 0.5 },
  crystal: { radius: 0.305916, height: 1 },
  ruin: { radius: 0.356118, height: 1 },
  windmill: { radius: 0.526925, height: 1 },
  gate: { radius: 0.383371, height: 1 },
  fence: { radius: 0.521889, height: 0.450997 },
  flowers: { radius: 0.262902, height: 0.185773 },
  grass: { radius: 0.15997, height: 0.2418 },
  fern: { radius: 0.36, height: 0.3 },
  leafy: { radius: 0.38, height: 0.34 },
  mushroom: { radius: 0.28, height: 0.31 },
  snowpeak: { radius: 0.467222, height: 1 },
} as const satisfies Record<
  MiniatureAssetKind,
  { readonly radius: number; readonly height: number }
>;

interface GeometryMetrics {
  readonly triangles: number;
  readonly radius: number;
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly minY: number;
  readonly maxY: number;
}

function geometryMetrics(geometry: THREE.BufferGeometry): GeometryMetrics {
  const position = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  let radius = 0;
  for (let index = 0; index < position.count; index += 1)
    radius = Math.max(radius, Math.hypot(position.getX(index), position.getZ(index)));
  return {
    triangles: (geometry.getIndex()?.count ?? position.count) / 3,
    radius,
    height: box.max.y - box.min.y,
    width: box.max.x - box.min.x,
    depth: box.max.z - box.min.z,
    minY: box.min.y,
    maxY: box.max.y,
  };
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

describe("R44 miniature asset geometry", () => {
  it.each(KINDS)("%s is indexed, finite, vertex-coloured and batch-compatible", (kind) => {
    const geometry = createMiniatureAsset(kind);
    try {
      const index = geometry.getIndex();
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      const color = geometry.getAttribute("color");

      expect(index).not.toBeNull();
      expect(Object.keys(geometry.attributes).sort()).toEqual(["color", "normal", "position"]);
      expect(geometry.getAttribute("uv")).toBeUndefined();
      expect(geometry.groups).toHaveLength(0);
      expect(position.itemSize).toBe(3);
      expect(normal.itemSize).toBe(3);
      expect(color.itemSize).toBe(3);
      expect(position.count).toBeGreaterThan(0);
      expect(normal.count).toBe(position.count);
      expect(color.count).toBe(position.count);

      for (const attribute of [position, normal, color]) {
        for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
      }
      for (const value of index!.array) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(position.count);
      }
      for (let vertex = 0; vertex < normal.count; vertex += 1) {
        const length = Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
        expect(Number.isFinite(length), `normal ${vertex}`).toBe(true);
        expect(length, `normal ${vertex}`).toBeGreaterThan(0.98);
        expect(length, `normal ${vertex}`).toBeLessThan(1.02);
      }
      for (const value of color.array) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }

      const metrics = geometryMetrics(geometry);
      expect(metrics.triangles).toBe(EXPECTED_TRIANGLES[kind]);
      expect({ radius: rounded(metrics.radius), height: rounded(metrics.height) }).toEqual(
        EXPECTED_BOUNDS[kind],
      );
      expect(metrics.triangles).toBeLessThanOrEqual(600);
      expect(metrics.minY).toBe(0);
      expect(metrics.radius).toBeLessThanOrEqual(0.7);
      if (TALL_KINDS.has(kind)) {
        expect(metrics.maxY).toBe(1);
        expect(metrics.height).toBe(1);
      }
    } finally {
      geometry.dispose();
    }
  });

  it("keeps three-tier fir and bevelled crown assemblies within their measured art budgets", () => {
    for (const kind of ["fir", "broadleaf", "blossom", "autumn"] as const) {
      const geometry = createMiniatureAsset(kind);
      try {
        expect(geometry.index!.count / 3).toBeGreaterThanOrEqual(100);
        expect(geometry.index!.count / 3).toBeLessThanOrEqual(kind === "fir" ? 420 : 300);
      } finally {
        geometry.dispose();
      }
    }
  });

  it("keeps the strict small-accent budgets", () => {
    expect(EXPECTED_TRIANGLES.stone).toBeLessThanOrEqual(80);
    expect(EXPECTED_TRIANGLES.flowers).toBeLessThanOrEqual(260);
    expect(EXPECTED_TRIANGLES.grass).toBeLessThanOrEqual(90);
  });

  it("keeps low accents compact with role-appropriate proportions", () => {
    const ratios: Record<"stone" | "fence" | "flowers" | "grass", readonly [number, number]> = {
      stone: [0.2, 0.8],
      fence: [0.25, 0.8],
      // Meadow flowers sit in leaves rather than above long bare stalks;
      // grass is a low fan. These are art proportions, not grounding margins.
      flowers: [0.3, 0.65],
      grass: [0.7, 1.3],
    };
    for (const kind of Object.keys(ratios) as Array<keyof typeof ratios>) {
      const geometry = createMiniatureAsset(kind);
      try {
        const metrics = geometryMetrics(geometry);
        const maximumDimension = Math.max(metrics.width, metrics.height, metrics.depth);
        const horizontalSpan = Math.max(metrics.width, metrics.depth);
        expect(maximumDimension, kind).toBeLessThanOrEqual(1.4);
        expect(metrics.height / horizontalSpan, kind).toBeGreaterThanOrEqual(ratios[kind][0]);
        expect(metrics.height / horizontalSpan, kind).toBeLessThanOrEqual(ratios[kind][1]);
      } finally {
        geometry.dispose();
      }
    }
  });

  it("stores authored swatches as THREE.Color linear working values", () => {
    const geometry = createMiniatureAsset("fir");
    try {
      const colors = geometry.getAttribute("color");
      const expectedBark = new THREE.Color().setHex(0x765038, THREE.SRGBColorSpace);
      let foundBark = false;
      for (let index = 0; index < colors.count; index += 1) {
        if (
          Math.abs(colors.getX(index) - expectedBark.r) < 1e-6 &&
          Math.abs(colors.getY(index) - expectedBark.g) < 1e-6 &&
          Math.abs(colors.getZ(index) - expectedBark.b) < 1e-6
        ) {
          foundBark = true;
          break;
        }
      }
      expect(foundBark).toBe(true);
      expect(expectedBark.r).toBeLessThan(0x76 / 255);
    } finally {
      geometry.dispose();
    }
  });

  it("merges every kind through the production batching utility", () => {
    const geometries = KINDS.map((kind) => createMiniatureAsset(kind));
    let merged: THREE.BufferGeometry | null = null;
    try {
      merged = mergeBufferGeometries(geometries, false);
      expect(merged).not.toBeNull();
      expect(merged!.getIndex()).not.toBeNull();
      expect(Object.keys(merged!.attributes).sort()).toEqual(["color", "normal", "position"]);
      expect(merged!.groups).toHaveLength(0);
      expect(merged!.getIndex()!.count / 3).toBe(
        Object.values(EXPECTED_TRIANGLES).reduce((sum, count) => sum + count, 0),
      );
    } finally {
      merged?.dispose();
      for (const geometry of geometries) geometry.dispose();
    }
  });

  it("computes scalar bounds without sharing geometry resources", () => {
    for (const kind of KINDS) {
      const first = createMiniatureAsset(kind);
      const second = createMiniatureAsset(kind);
      try {
        expect(first).not.toBe(second);
        expect(first.getAttribute("position").array).not.toBe(
          second.getAttribute("position").array,
        );
        const metrics = geometryMetrics(first);
        const bounds = miniatureAssetBounds(kind);
        expect(bounds.radius).toBeCloseTo(metrics.radius, 9);
        expect(bounds.height).toBeCloseTo(metrics.height, 9);
      } finally {
        first.dispose();
        second.dispose();
      }
    }
  });

  it("reports exact per-kind triangle counts and rounded bounds", () => {
    const report: Record<string, { triangles: number; radius: number; height: number }> = {};
    for (const kind of KINDS) {
      const geometry = createMiniatureAsset(kind);
      try {
        const metrics = geometryMetrics(geometry);
        report[kind] = {
          triangles: metrics.triangles,
          radius: rounded(metrics.radius),
          height: rounded(metrics.height),
        };
      } finally {
        geometry.dispose();
      }
    }
    process.stdout.write(`[miniature assets] ${JSON.stringify(report)}\n`);
    for (const kind of KINDS)
      expect(report[kind]).toEqual({
        triangles: EXPECTED_TRIANGLES[kind],
        ...EXPECTED_BOUNDS[kind],
      });
  });
});
