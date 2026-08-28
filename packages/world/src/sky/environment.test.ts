import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORLD_ENVIRONMENT_STOPS,
  estimateEnvironmentTextureMemory,
  skyEnvironmentKey,
  WORLD_ENVIRONMENT,
} from "./environment.js";

describe("world environment", () => {
  it("uses one small deterministic capture key", () => {
    expect(WORLD_ENVIRONMENT.cubeSize).toBe(64);
    expect(skyEnvironmentKey(DEFAULT_WORLD_ENVIRONMENT_STOPS)).toBe("2e7fd4:8ec8ea:f2d4b0");
    expect(skyEnvironmentKey({ ...DEFAULT_WORLD_ENVIRONMENT_STOPS })).toBe(
      skyEnvironmentKey(DEFAULT_WORLD_ENVIRONMENT_STOPS),
    );
  });

  it("keeps the one retained PMREM inside the declared mobile texture budget", () => {
    expect(estimateEnvironmentTextureMemory()).toEqual({
      persistent: 688_128,
      generationPeak: 1_572_864,
      atlasWidth: 336,
      atlasHeight: 256,
    });
    expect(WORLD_ENVIRONMENT.intensity).toBeGreaterThan(0);
    expect(WORLD_ENVIRONMENT.intensity).toBeLessThan(1);
  });

  it("captures and filters in linear space without taking background ownership", () => {
    const source = readFileSync(new URL("./environment.ts", import.meta.url), "utf8");
    expect(source).toMatch(/WebGLCubeRenderTarget/);
    expect(source).toMatch(/CubeCamera/);
    expect(source).toMatch(/PMREMGenerator/);
    expect(source).toMatch(/HalfFloatType/);
    expect(source).toMatch(/LinearSRGBColorSpace/);
    expect(source).toMatch(/NoToneMapping/);
    expect(source.replaceAll("LinearSRGBColorSpace", "")).not.toMatch(/SRGBColorSpace/);
    expect(source).not.toMatch(/scene\.background\s*=/);
    expect(source).not.toMatch(/Math\.random|Date\.now/);
  });
});
