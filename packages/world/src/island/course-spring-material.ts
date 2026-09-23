import * as THREE from "three";

/**
 * The spring's water as two StandardMaterial extensions sharing one time
 * uniform (R59-07). Vertices never move: the flow is all in the fragment
 * shader, surface coordinates belong to the spring, and the camera cannot
 * move the flow. Under reduced motion the renderer holds the time at 0.
 *
 * - `still` (pond and stream): shallow teal at the bank to deep blue in the
 *   middle (`springFlow.x` = depth), a tilted normal from two slow ripple
 *   waves so the sun and the sky glint on it, a soft foam line that breathes
 *   at the bank, and on the stream ripples that run downstream
 *   (`springFlow.y` = distance along; negative on the pond).
 * - `fall`: a translucent sheet, light at the lip and bluer below, streaked
 *   by falling value noise, white where it leaves the lip, aerated and fading
 *   to nothing toward the bottom and the edges (`springFlow` = across, share
 *   of the drop). It lights itself a little: a waterfall in a cliff's shade
 *   still reads as white water.
 */
const NOISE = `
float springHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float springNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(springHash(i),springHash(i+vec2(1.0,0.0)),f.x),mix(springHash(i+vec2(0.0,1.0)),springHash(i+vec2(1.0,1.0)),f.x),f.y);}
`;

export type CourseSpringWater = "still" | "fall";

export function courseSpringMaterialDetail(
  water: CourseSpringWater = "still",
  uniforms = { uSpringFlowTime: { value: 0 } },
) {
  return {
    uniforms,
    customProgramCacheKey: () => `course-spring-${water}-v2`,
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec2 springFlow;\nvarying vec2 vSpringFlow;\nvarying vec3 vSpringWorld;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSpringFlow=springFlow;\nvSpringWorld=(modelMatrix*vec4(transformed,1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>\nvarying vec2 vSpringFlow;\nvarying vec3 vSpringWorld;\nuniform float uSpringFlowTime;\n${NOISE}`,
      );
      if (water === "still") {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          float springDepth=clamp(vSpringFlow.x,0.0,1.0);
          float springT=uSpringFlowTime;
          vec3 springShallow=vec3(0.44,0.80,0.78);
          vec3 springDeep=vec3(0.07,0.38,0.60);
          float springRun=step(0.0,vSpringFlow.y);
          vec3 springColour=mix(springShallow,springDeep,smoothstep(0.0,0.9,springDepth));
          float springStreak=springRun*smoothstep(0.62,0.95,springNoise(vec2(vSpringFlow.y*3.2-springT*2.6,vSpringWorld.x*2.1+vSpringWorld.z*2.1)));
          // A foam line at the pond's bank; a stream's edges only brighten a little.
          float springFoam=smoothstep(0.16,0.0,springDepth-0.035*sin(springT*1.4+vSpringWorld.x*3.0+vSpringWorld.z*2.0))*(1.0-springRun*0.7);
          springColour=mix(springColour,vec3(0.93,0.98,0.97),max(springFoam*0.75,springStreak*0.45));
          diffuseColor.rgb=springColour;
        `,
          )
          .replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
          {
            vec2 springP=vSpringWorld.xz;
            float springS=uSpringFlowTime;
            float springAlong=max(vSpringFlow.y,0.0);
            float dx=cos(springP.x*2.7+springS*0.9)*0.5+cos((springP.x+springP.y)*4.3-springS*1.3)*0.35+cos(springAlong*6.0-springS*3.2)*0.3*step(0.0,vSpringFlow.y);
            float dz=cos(springP.y*2.3-springS*0.8)*0.5+cos((springP.x-springP.y)*3.9+springS*1.1)*0.35;
            vec3 springTilt=(viewMatrix*vec4(dx,0.0,dz,0.0)).xyz;
            normal=normalize(normal+springTilt*0.16);
          }
        `,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,0.7,springFoam);
        `,
          );
      } else {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          float springLayer=step(2.0,vSpringFlow.x);
          float springAcross=vSpringFlow.x-springLayer*4.0;
          float springDrop=clamp(vSpringFlow.y,0.0,1.0);
          float springT=uSpringFlowTime;
          float springN=springNoise(vec2(springAcross*4.0+springLayer*7.3,springDrop*5.0-springT*1.8))*0.65
            +springNoise(vec2(springAcross*9.0+springLayer*3.1,springDrop*13.0-springT*3.1))*0.35;
          float springStreak=smoothstep(0.56,0.8,springN);
          // Cyan where it leaves the lip, a saturated blue body, white streaks.
          vec3 springColour=mix(vec3(0.5,0.86,0.94),vec3(0.12,0.5,0.84),smoothstep(0.0,0.4,springDrop));
          float springLip=smoothstep(0.1,0.0,springDrop);
          float springAir=smoothstep(0.55,1.0,springDrop);
          springColour=mix(springColour,vec3(0.97,1.0,1.0),max(springStreak*0.8,springLip*0.9));
          springColour=mix(springColour,vec3(0.9,0.96,1.0),springAir*0.45);
          float springEdge=1.0-smoothstep(0.55,1.0,abs(springAcross));
          float springFade=1.0-smoothstep(0.62,1.0,springDrop);
          diffuseColor.rgb=springColour;
          diffuseColor.a*=clamp((0.72+springStreak*0.25)*springEdge*springFade*(1.0-springLayer*0.35),0.0,1.0);
        `,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
          totalEmissiveRadiance+=diffuseColor.rgb*0.18;
        `,
          );
      }
    },
  };
}
