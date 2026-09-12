import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { buildRemoteIslandBatch, getOrCreateRemoteBaseGeometry } from "./remote-island-field.js";
import {
  createMiniatureSurfaceAtlas,
  miniatureAtlasDimensions,
  miniatureSurfaceTile,
} from "./miniature-surface-atlas.js";

const blueprint = () =>
  islandBlueprint({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonCount: 41,
    themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
  });

describe("bounded miniature ground texture", () => {
  it("keeps the 53-course colour atlas within 4 MiB base storage and one sampler", () => {
    for (const count of [0, 1, 31, 53, 256, 1000]) {
      const d = miniatureAtlasDimensions(count);
      expect(d.width).toBeLessThanOrEqual(2048);
      expect(d.height).toBeLessThanOrEqual(2048);
      expect(d.columns * d.rows).toBeGreaterThanOrEqual(count + 1);
      expect(d.padding).toBeGreaterThan(0);
    }
    const d = miniatureAtlasDimensions(53);
    expect(d.width * d.height * 4).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("bakes finite opaque modulation from original terrain and caches it independent of scale", () => {
    const bp = blueprint();
    const small = getOrCreateRemoteBaseGeometry(bp, 2);
    const large = getOrCreateRemoteBaseGeometry(bp, 4);
    const a = miniatureSurfaceTile(bp, small);
    expect(miniatureSurfaceTile(bp, large)).toBe(a);
    let min = 255,
      max = 0,
      tinted = 0,
      invalidAlpha = 0;
    for (let i = 0; i < a.length; i += 4) {
      min = Math.min(min, a[i]!);
      max = Math.max(max, a[i]!);
      if (a[i] !== a[i + 1]) tinted++;
      if (a[i + 3] !== 255) invalidAlpha++;
    }
    expect(invalidAlpha).toBe(0);
    expect(min).toBeGreaterThan(40);
    expect(max - min).toBeGreaterThan(60);
    expect(tinted).toBeGreaterThan(1000);
  });

  it("adds only UVs to the actual batch and reuses a tile for duplicated identity", () => {
    const bp = blueprint();
    const islands = [
      { id: "a", blueprint: bp, radius: 2, position: new THREE.Vector3(-5, 0, 0) },
      {
        id: "b",
        blueprint: bp,
        radius: 4,
        scale: 1.2,
        lift: 3,
        position: new THREE.Vector3(8, 1, 0),
      },
    ];
    const batch = buildRemoteIslandBatch(islands);
    const originalPositions = batch.geometry.getAttribute("position").array.slice();
    const originalIndices = batch.geometry.index!.array.slice();
    const atlas = createMiniatureSurfaceAtlas(islands, batch);
    try {
      expect(atlas.info.tiles).toBe(1);
      expect(atlas.info.samplers).toBe(1);
      expect(atlas.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
      expect(atlas.texture.generateMipmaps).toBe(true);
      expect(batch.geometry.getAttribute("position").array).toEqual(originalPositions);
      expect(batch.geometry.index!.array).toEqual(originalIndices);
      const uv = batch.geometry.getAttribute("uv");
      expect(uv.count).toBe(batch.geometry.getAttribute("position").count);
      expect(Array.from(uv.array).every((x) => Number.isFinite(x) && x > 0 && x < 1)).toBe(true);
      const base = getOrCreateRemoteBaseGeometry(bp, 2);
      for (const index of [0, 32, 128]) {
        expect(uv.getX(index)).toBeCloseTo(uv.getX(index + base.vertexCount), 6);
        expect(uv.getY(index)).toBeCloseTo(uv.getY(index + base.vertexCount), 6);
      }
      const neutral = base.vertexCount - 1;
      expect(uv.getX(neutral)).toBe((atlas.info.cellSize * 0.5) / atlas.info.width);
      expect(uv.getY(neutral)).toBe((atlas.info.cellSize * 0.5) / atlas.info.height);
      expect(batch.islandIndexForFace(base.triangleCount)).toBe(1);
    } finally {
      atlas.dispose();
      batch.dispose();
    }
  });
});
