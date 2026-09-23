import { expect, it } from "vitest";
import * as THREE from "three";
import { courseSpringMaterialDetail } from "./course-spring-material.js";

const compile = (water: "still" | "fall", uniforms?: { uSpringFlowTime: { value: number } }) => {
  const d = courseSpringMaterialDetail(water, uniforms);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as THREE.WebGLProgramParametersWithUniforms;
  d.onBeforeCompile(shader);
  return { d, shader };
};

it("moves the water only in the fragment shader, on the existing Standard surface", () => {
  for (const water of ["still", "fall"] as const) {
    const { d, shader } = compile(water);
    expect(shader.vertexShader).toContain("vSpringFlow=springFlow");
    expect(shader.vertexShader).not.toContain("transformed +=");
    expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)).toHaveLength(1);
    expect(shader.uniforms.uSpringFlowTime).toBe(d.uniforms.uSpringFlowTime);
  }
});

it("ripples and foams the still water, streaks and thins the fall", () => {
  const still = compile("still").shader.fragmentShader;
  expect(still).toContain("normal=normalize(normal+springTilt");
  expect(still).toContain("springFoam");
  const fall = compile("fall").shader.fragmentShader;
  expect(fall).toContain("diffuseColor.a*=");
  expect(fall).toContain("springStreak");
});

it("shares one clock between the pond and the fall", () => {
  const still = courseSpringMaterialDetail("still");
  const fall = courseSpringMaterialDetail("fall", still.uniforms);
  expect(fall.uniforms.uSpringFlowTime).toBe(still.uniforms.uSpringFlowTime);
  expect(fall.customProgramCacheKey()).not.toBe(still.customProgramCacheKey());
});
