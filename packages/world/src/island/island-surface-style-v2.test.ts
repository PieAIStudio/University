import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  createIslandSurfaceMaterialAdapter,
  islandSurfaceMaterialCacheKey,
  islandSurfaceStyleFromSearch,
  ISLAND_SURFACE_STYLE_PRESETS,
  ISLAND_SURFACE_STYLE_SHADER_MARKER,
  parseIslandSurfaceStyle,
  resolveIslandSurfaceStyle,
} from "./island-surface-style-v2.js";

function stockShaderFixture(): THREE.WebGLProgramParametersWithUniforms {
  return {
    uniforms: {},
    vertexShader: `
#include <common>
void main() {
  vec3 transformed = position;
  vec3 transformedNormal = normal;
  #include <project_vertex>
}`,
    fragmentShader: `
#include <common>
void main() {
  vec4 diffuseColor = vec4(1.0);
  #include <color_fragment>
  gl_FragColor = diffuseColor;
}`,
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
}

describe("Island V2 surface style", () => {
  it("accepts only the four named styles", () => {
    expect(parseIslandSurfaceStyle(" Elemental ")).toBe("elemental");
    expect(parseIslandSurfaceStyle("mossy")).toBe("mossy");
    expect(parseIslandSurfaceStyle("arbitrary-glsl")).toBeNull();
    expect(parseIslandSurfaceStyle(3)).toBeNull();
  });

  it("honours URL styles only in explicit debug mode", () => {
    expect(islandSurfaceStyleFromSearch("?islandStyle=desert")).toBe("diorama");
    expect(islandSurfaceStyleFromSearch("?mode=debug&islandStyle=desert")).toBe("desert");
    expect(resolveIslandSurfaceStyle("?mode=debug&islandStyle=mossy")).toBe("mossy");
    expect(resolveIslandSurfaceStyle("")).toBe("diorama");
  });

  it("injects declarations outside main and colour work inside main", () => {
    const time = { value: 12 };
    const adapter = createIslandSurfaceMaterialAdapter("terrain", "elemental", true, time);
    const shader = stockShaderFixture();

    adapter.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);

    expect(shader.fragmentShader.indexOf(ISLAND_SURFACE_STYLE_SHADER_MARKER)).toBeLessThan(
      shader.fragmentShader.indexOf("void main"),
    );
    expect(shader.vertexShader.indexOf(ISLAND_SURFACE_STYLE_SHADER_MARKER)).toBeLessThan(
      shader.vertexShader.indexOf("void main"),
    );
    expect(shader.fragmentShader).toContain("universityIslandStyleNoise");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = mix");
    expect(shader.vertexShader).toContain("vIslandStyleWorldPosition");
    expect(shader.vertexShader).toContain("normalize(objectNormal).y");
    expect(shader.vertexShader).not.toContain("normalize(transformedNormal).y");
    expect(shader.uniforms.uIslandStyleTime).toBe(time);
  });

  it("uses three value roles while keeping the existing vertex colour as base", () => {
    const adapter = createIslandSurfaceMaterialAdapter("terrain", "elemental", true);
    const shader = stockShaderFixture();

    adapter.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);

    expect(shader.fragmentShader).toContain("float islandStyleGrassLayer");
    expect(shader.fragmentShader).toContain("float islandStyleSoilLayer");
    expect(shader.fragmentShader).toContain("float islandStyleSlopeLayer");
    expect(shader.fragmentShader).toContain(
      "diffuseColor.rgb = mix(diffuseColor.rgb, islandStyleColour",
    );
    expect(ISLAND_SURFACE_STYLE_PRESETS.elemental.tint[1]).toBeLessThan(0.65);
    expect(ISLAND_SURFACE_STYLE_PRESETS.elemental.strength.terrain).toBeLessThan(0.78);
  });

  it("switches uniforms without compiling a new shader variant", () => {
    const adapter = createIslandSurfaceMaterialAdapter("terrain", "diorama");
    const key = adapter.customProgramCacheKey();

    expect(adapter.setStyle("diorama")).toBe(false);
    expect(adapter.setStyle("desert")).toBe(true);
    expect(adapter.style).toBe("desert");
    expect(adapter.uniforms.uIslandStyleVariant.value).toBe(3);
    expect(adapter.uniforms.uIslandStyleStrength.value).toBeGreaterThan(0);
    expect(adapter.customProgramCacheKey()).toBe(key);
    expect(key).toBe(islandSurfaceMaterialCacheKey("terrain"));
  });

  it("fails closed when Three shader chunks are unavailable", () => {
    const adapter = createIslandSurfaceMaterialAdapter("terrain", "mossy");
    const shader = {
      uniforms: {},
      vertexShader: "void main() {}",
      fragmentShader: "void main() {}",
    } as unknown as THREE.WebGLProgramParametersWithUniforms;

    adapter.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);

    expect(shader.vertexShader).toBe("void main() {}");
    expect(shader.fragmentShader).toBe("void main() {}");
  });
});
