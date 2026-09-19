import * as THREE from "three";
import type { PropId } from "./catalog.js";

/** Object-locked, material-aware finish. Keeps the original palette and flat
 * geometry. One correlated field drives pigment, roughness and shallow relief;
 * actual baked visibility owns cavities. Neither feature is a screen filter.
 * Research: Adobe Smart Materials mesh-awareness; Three metallic/roughness PBR.
 * Not a claim of measured material parameters or automatic material recognition.
 */
export function addCraftedDetail(material: THREE.MeshStandardMaterial, id: PropId): void {
  if (material.transparent || material.opacity < 1) return;
  const hook = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  const nature = id.startsWith("rock") ? 1 : id === "fir" || id === "broadleaf" ? 2 : 0;
  material.onBeforeCompile = (shader, renderer) => {
    hook.call(material, shader, renderer);
    const anchor = "#include <lights_physical_fragment>";
    if (!shader.fragmentShader.includes(anchor))
      throw new Error("Crafted finish requires physical material chunks");
    shader.uniforms.uCraftKind = { value: nature };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float grainAxis;\nvarying float vGrainAxis;\nvarying vec3 vCraftPoint;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvCraftPoint=position;vGrainAxis=grainAxis;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 vCraftPoint;
      varying float vGrainAxis;
      uniform float uCraftKind;
      float craftHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float craftNoise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(craftHash(i),craftHash(i+vec3(1,0,0)),f.x),mix(craftHash(i+vec3(0,1,0)),craftHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(craftHash(i+vec3(0,0,1)),craftHash(i+vec3(1,0,1)),f.x),mix(craftHash(i+vec3(0,1,1)),craftHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `,
      )
      .replace(
        anchor,
        `
      // Color families are the authored Kenney/University palette, not arbitrary recoloring.
      float craftGreen=step(0.5,uCraftKind)*smoothstep(0.01,0.09,diffuseColor.g-max(diffuseColor.r,diffuseColor.b));
      float craftWood=(1.0-step(0.5,uCraftKind))*smoothstep(0.02,0.14,diffuseColor.r-diffuseColor.b)*(1.0-craftGreen);
      if(uCraftKind>1.5) craftWood=(1.0-craftGreen);
      float craftMineral=step(0.5,uCraftKind)*(1.0-step(1.5,uCraftKind))*(1.0-craftGreen);
      float craftPaint=max(0.0,1.0-craftGreen-craftWood-craftMineral);
      vec3 cp=vCraftPoint;
      float footprint=max(length(dFdx(cp)),length(dFdy(cp)));
      float grainFade=1.0-smoothstep(0.012,0.045,footprint);
      float mineral=craftNoise(cp*24.0)*0.65+craftNoise(cp*57.0)*0.35;
      vec3 timberPoint=vGrainAxis>1.5?cp.xzy:vGrainAxis>0.5?cp:cp.yxz;
      float longGrain=craftNoise(timberPoint*vec3(45.0,3.0,40.0));
      float growth=sin((timberPoint.x+timberPoint.z*0.65)*56.0+craftNoise(timberPoint*vec3(3,1,3))*8.0)*0.5+0.5;
      float timber=longGrain*0.7+growth*0.3;
      float foliage=craftNoise(cp*8.0);
      float field=craftWood*timber+craftMineral*mineral+craftGreen*foliage+craftPaint*mineral;
      float toneAmount=craftWood*0.22+craftMineral*0.18+craftGreen*0.12+craftPaint*0.08;
      diffuseColor.rgb *= 1.0+(field-0.5)*toneAmount*grainFade;
      // A convex-edge mask is baked from actual adjacent faces, not a rim-light
      // or screenshot outline. Slightly exposed pigment suggests careful finishing.
      float polishedEdge=texture2D(uPropVisibility,vVisibilityUv).g;
      diffuseColor.rgb=mix(diffuseColor.rgb,min(vec3(1.0),diffuseColor.rgb*1.32+vec3(0.012)),polishedEdge*0.6*(1.0-craftGreen));
      roughnessFactor=mix(roughnessFactor,clamp(craftWood*0.58+craftMineral*0.78+craftGreen*0.72+craftPaint*0.4+(field-0.5)*0.18,0.28,0.96),0.9);
      // Model-space shallow relief; derivatives suppress detail below a pixel.
      float relief=(field-0.5)*(craftWood*0.0025+craftMineral*0.003+craftGreen*0.0008+craftPaint*0.0005)*grainFade;
      vec3 sigmaX=dFdx(-vViewPosition), sigmaY=dFdy(-vViewPosition);
      vec3 R1=cross(sigmaY,normal), R2=cross(normal,sigmaX);
      float det=dot(sigmaX,R1);
      if(abs(det)>0.00000001) normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*R1+dFdy(relief)*R2));
      ${anchor}
    `,
      );
  };
  material.customProgramCacheKey = () => `${key}/crafted-pbr-v1/${nature}`;
}
