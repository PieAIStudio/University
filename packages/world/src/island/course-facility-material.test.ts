import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { courseFacilityTreatment } from "./course-facility-material.js";

describe("bounded finish on the original facility materials", () => {
  it.each(["roof", "roof-gable", "stall", "stall-bench"])(
    "keeps %s source maps and PBR ownership",
    (asset) => {
      const source = new THREE.MeshStandardMaterial({
        map: new THREE.Texture(),
        roughness: 0.88,
        transparent: true,
        opacity: 0.7,
      });
      const owned = source.clone();
      const frame = new THREE.Matrix4().makeScale(2, 3, 4);
      const treatment = courseFacilityTreatment(`fantasy-town-kit/${asset}`)!;
      treatment(owned, frame);
      expect(courseFacilityTreatment(`fantasy-town-kit/${asset}`)).toBe(treatment);
      expect(owned.map).toBe(source.map);
      expect(owned.roughness).toBe(source.roughness);
      expect(owned.opacity).toBe(source.opacity);
      expect(owned.transparent).toBe(true);
      expect(source.userData.facilityCraft).toBeUndefined();
      const shader = {
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
        uniforms: {},
      } as THREE.WebGLProgramParametersWithUniforms;
      owned.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);
      expect(shader.fragmentShader).toContain("fwidth(");
      expect(shader.fragmentShader).toContain("#include <map_fragment>");
      expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
      expect(shader.vertexShader).not.toContain("transformed +=");
      expect(shader.uniforms.uFacilityModel!.value).not.toBe(frame);
      expect(shader.uniforms.uFacilityModel!.value).toEqual(frame);
      owned.dispose();
      source.map!.dispose();
      source.dispose();
    },
  );
  it("does not repaint plants, water, skin or another donor", () => {
    for (const key of [
      "nature-kit/rock_largeA",
      "elemental-serenity/tent",
      "fantasy-town-kit/fountain-round",
    ])
      expect(courseFacilityTreatment(key)).toBeUndefined();
  });
});
