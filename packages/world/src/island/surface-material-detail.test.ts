import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createIslandSurfaceMaterialAdapter } from "./island-surface-style.js";
import {
  createSurfaceMaterialDetail,
  prepareSurfaceDetailCoordinates,
  SURFACE_DETAIL_SIZE,
  surfaceSwatchData,
} from "./surface-material-detail.js";

describe("shared miniature-world surface swatch", () => {
  it("generates deterministic, bounded scalar channels with related wear and roughness", () => {
    const data = surfaceSwatchData();
    expect(data).toEqual(surfaceSwatchData());
    expect(data.byteLength).toBe(128 * 128 * 4);
    let min = 255,
      max = 0,
      largestBorderStep = 0;
    for (let i = 0; i < data.length; i += 4) {
      const height = data[i]! / 255;
      expect(Math.abs(data[i + 1]! / 255 - (0.96 - height * 0.12))).toBeLessThan(0.004);
      expect(Math.abs(data[i + 2]! / 255 - (0.76 + height * 0.24))).toBeLessThan(0.004);
      expect(data[i + 3]).toBe(255);
      min = Math.min(min, data[i]!);
      max = Math.max(max, data[i]!);
    }
    for (let i = 0; i < SURFACE_DETAIL_SIZE; i++) {
      largestBorderStep = Math.max(
        largestBorderStep,
        Math.abs(data[i * 128 * 4]! - data[(i * 128 + 127) * 4]!),
        Math.abs(data[i * 4]! - data[(127 * 128 + i) * 4]!),
      );
    }
    expect(largestBorderStep).toBeLessThan(12);
    expect(min).toBeGreaterThan(30);
    expect(max).toBeLessThan(225);
    expect(() => surfaceSwatchData(0)).toThrow(RangeError);
  });

  it("shares one data texture, keeps mip filtering, and releases only the last owner", () => {
    const terrain = createSurfaceMaterialDetail("terrain");
    const stone = createSurfaceMaterialDetail("stone");
    terrain.activate();
    stone.activate();
    const texture = terrain.uniforms.uSurfaceSwatch.value!;
    const disposed = vi.fn();
    texture.addEventListener("dispose", disposed);
    expect(stone.uniforms.uSurfaceSwatch.value).toBe(texture);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.generateMipmaps).toBe(true);
    terrain.dispose();
    terrain.dispose();
    expect(disposed).not.toHaveBeenCalled();
    stone.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("adds stable coordinates without changing geometry, topology or normals", () => {
    const geometry = new THREE.BoxGeometry(4, 2, 3);
    const positions = geometry.attributes.position!.array.slice();
    const normals = geometry.attributes.normal!.array.slice();
    const indices = geometry.index!.array.slice();
    prepareSurfaceDetailCoordinates(geometry);
    const coordinates = geometry.getAttribute("surfaceCoordinate");
    prepareSurfaceDetailCoordinates(geometry);
    expect(geometry.getAttribute("surfaceCoordinate")).toBe(coordinates);
    expect(coordinates.array).toEqual(positions);
    expect(geometry.attributes.position!.array).toEqual(positions);
    expect(geometry.attributes.normal!.array).toEqual(normals);
    expect(geometry.index!.array).toEqual(indices);
    geometry.dispose();
  });

  it("extends the installed Standard shader and existing style without displacement or output conversion", () => {
    for (const enabled of [true, false]) {
      const shader = {
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
        uniforms: {},
      } as THREE.WebGLProgramParametersWithUniforms;
      const original = createIslandSurfaceMaterialAdapter("terrain", "diorama", enabled);
      const detail = createSurfaceMaterialDetail("terrain");
      try {
        original.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);
        detail.onBeforeCompile(shader);
        expect(shader.fragmentShader).toContain("#include <tonemapping_fragment>");
        expect(shader.fragmentShader).toContain("#include <colorspace_fragment>");
        expect(shader.fragmentShader).toContain("dFdx(surfaceRelief)");
        expect(shader.fragmentShader).toContain("surfaceFootprint");
        expect(shader.vertexShader).not.toContain("transformed +=");
        expect(shader.uniforms.uSurfaceDetailMode).toBe(detail.uniforms.uSurfaceDetailMode);
        detail.uniforms.uSurfaceDetailMode.value = 0;
        expect(detail.customProgramCacheKey()).toBe("university-surface-swatch-v3/swatch");
      } finally {
        detail.dispose();
      }
    }
  });

  it("keeps the canonical material coordinates when preview geometry is pre-scaled", () => {
    const original = new THREE.BoxGeometry(4, 2, 3);
    const scaled = original.clone().scale(0.35, 0.35, 0.35);
    try {
      const before = scaled.attributes.position!.array.slice();
      prepareSurfaceDetailCoordinates(original);
      prepareSurfaceDetailCoordinates(scaled, 0.35);
      const a = original.getAttribute("surfaceCoordinate"),
        b = scaled.getAttribute("surfaceCoordinate");
      for (let i = 0; i < a.count; i++) {
        expect(b.getX(i)).toBeCloseTo(a.getX(i), 6);
        expect(b.getY(i)).toBeCloseTo(a.getY(i), 6);
        expect(b.getZ(i)).toBeCloseTo(a.getZ(i), 6);
      }
      expect(scaled.attributes.position!.array).toEqual(before);
      expect(() => prepareSurfaceDetailCoordinates(original, 0)).toThrow(RangeError);
    } finally {
      original.dispose();
      scaled.dispose();
    }
  });
});
