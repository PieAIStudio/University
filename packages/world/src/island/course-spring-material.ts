import * as THREE from "three";
/** One StandardMaterial extension, not another water pass. Vertices stay put:
 * the same falling curtain carries soft descending foam and its matte response.
 * Surface coordinates belong to the spring; the camera cannot move the flow.
 */
export function courseSpringMaterialDetail() {
  const uniforms = { uSpringFlowTime: { value: 0 } };
  return {
    uniforms,
    customProgramCacheKey: () => "course-spring-flow-v1",
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec2 springFlow;\nvarying vec2 vSpringFlow;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSpringFlow=springFlow;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vSpringFlow;\nuniform float uSpringFlowTime;",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float springFall=step(0.0,vSpringFlow.y);
          float springPhase=vSpringFlow.y*28.0-uSpringFlowTime*2.1+vSpringFlow.x*2.8;
          float springResolved=1.0-smoothstep(0.45,1.4,fwidth(springPhase));
          float springFoam=springFall*springResolved*smoothstep(0.35,0.96,sin(springPhase));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.85,0.97,0.94),springFoam*0.34);
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,0.82,springFoam*0.5);
        `,
        );
    },
  };
}
