import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createGlobeMaterial } from "./globe-material.js";
import { createDomainSurfaceTexture } from "./globe-geometry.js";

describe("one opaque globe material with a shared land/water mask", () => {
  it("bakes both land and water into the existing texture without another sampler", () => {
    const texture = createDomainSurfaceTexture("ai-games", "lagoon");
    const pixels = texture.image.data as Uint8Array;
    let land = 0;
    let water = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 255) land++;
      if (pixels[i] === 0) water++;
    }
    expect(land).toBeGreaterThan(10000);
    expect(water).toBeGreaterThan(10000);
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    texture.dispose();
  });

  it("shares the animated uniform and preserves the installed stock shader chunks", () => {
    const texture = new THREE.Texture();
    const time = { value: 0 };
    const material = createGlobeMaterial(texture, time);
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(
      shader as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );
    expect(shader.uniforms).toHaveProperty("uGlobeTime", time);
    expect(shader.vertexShader).toContain("vGlobeSurface = position");
    expect(shader.fragmentShader).toContain("float land = sampledDiffuseColor.a");
    expect(shader.fragmentShader).toContain("diffuseColor.a = opacity");
    expect(shader.fragmentShader).toContain("#include <tonemapping_fragment>");
    expect(shader.fragmentShader).toContain("#include <colorspace_fragment>");
    expect(material.transparent).toBe(false);
    expect(material.map).toBe(texture);
    expect(material.customProgramCacheKey()).toBe("university-globe-land-mask-v1");
    time.value = 12;
    expect((shader.uniforms as Record<string, { value: number }>).uGlobeTime!.value).toBe(12);
    material.dispose();
    texture.dispose();
  });
});
