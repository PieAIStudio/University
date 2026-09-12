import { expect, it } from "vitest";
import * as THREE from "three";
import { courseSpringMaterialDetail } from "./course-spring-material.js";
it("carries filtered descending foam on the existing Standard surface without moving vertices or owning output", () => {
  const d = courseSpringMaterialDetail();
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as THREE.WebGLProgramParametersWithUniforms;
  d.onBeforeCompile(shader);
  expect(shader.vertexShader).toContain("vSpringFlow=springFlow");
  expect(shader.vertexShader).not.toContain("transformed +=");
  expect(shader.fragmentShader).toContain("fwidth(springPhase)");
  expect(shader.fragmentShader).toContain("roughnessFactor=mix");
  expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
  expect(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)).toHaveLength(1);
  expect(shader.uniforms.uSpringFlowTime).toBe(d.uniforms.uSpringFlowTime);
});
