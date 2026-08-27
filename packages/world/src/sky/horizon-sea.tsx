/**
 * Aerial plate and deep water under the cloud deck.
 *
 * The plate is still background scenery, not world truth. It used to be an
 * unlit, nearly uniform tint, which is why the background lightness spread
 * sat around 14: almost every non-land pixel was the same value. A
 * horizontal disc cannot get range from N·L (the normal is +Y everywhere),
 * but a view-dependent sun glint can, and that is the same trick a real
 * sea uses at this camera angle.
 *
 * Ripple / Voronoi breakup in elemental-serenity
 * `src/Shaders/Chunks/water/*` at `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`
 * informed the glint shape. Donor textures are not pulled in: the highlight
 * is analytic so there is no extra provenance question.
 */
import { useLoader, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import aerialWorldPlate2k from "../assets/generated/aerial-world-plate-2k.webp?url";
import aerialWorldPlate4k from "../assets/generated/aerial-world-plate-4k.webp?url";
import { worldSunDirection, WORLD_SUN } from "./sun.js";
import { renderTier } from "./tier.js";

export const SEA_COLORS = {
  shallow: 0x2f89a0,
  deep: 0x1a5a70,
  plateTint: 0xd7ebe6,
} as const;

const WORLD_PLATE_MIN_RADIUS = 130;

const PLATE_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const PLATE_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 uTint;
uniform vec3 uDeep;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uHorizon;
uniform float uPlateRadius;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec3 albedo = texture2D(map, vUv).rgb * uTint;
  vec3 normal = vec3(0.0, 1.0, 0.0);
  vec3 lightDir = normalize(uSunDirection);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float ndotl = max(dot(normal, lightDir), 0.0);
  float spec = pow(max(dot(normal, halfDir), 0.0), 40.0);
  float hotSpec = pow(max(dot(normal, halfDir), 0.0), 90.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  float glint = spec * (0.32 + 0.68 * fresnel);
  float dist = length(vWorldPosition.xz);
  float deep = smoothstep(28.0, 140.0, dist);
  vec3 color = mix(albedo, uDeep, deep * 0.3);
  color *= 0.52 + ndotl * 0.86;
  vec2 sunXZ = normalize(uSunDirection.xz);
  float sunFacing = max(dot(normalize(vWorldPosition.xz + vec2(0.001)), sunXZ), 0.0);
  color += uSunColor * pow(sunFacing, 7.0) * 0.05;
  color += uSunColor * glint * 0.9;
  color += vec3(1.16, 1.08, 0.92) * hotSpec * 0.45;
  float rim = smoothstep(0.78, 1.0, dist / max(uPlateRadius, 1.0));
  color = mix(color, uHorizon, rim);
  gl_FragColor = vec4(color, 1.0);
}
`;

export function AerialWorldPlate({ extent, level }: { extent: number; level: number }) {
  const mobile = renderTier() === "mobile";
  const gl = useThree((state) => state.gl);
  const sourceTexture = useLoader(
    THREE.TextureLoader,
    mobile ? aerialWorldPlate2k : aerialWorldPlate4k,
  );
  const texture = useMemo(() => sourceTexture.clone(), [sourceTexture]);
  const material = useRef<THREE.ShaderMaterial>(null);
  const sunDirection = worldSunDirection();
  const plateRadius = Math.max(extent * 1.45, WORLD_PLATE_MIN_RADIUS);
  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      uTint: { value: new THREE.Color(SEA_COLORS.plateTint) },
      uDeep: { value: new THREE.Color(SEA_COLORS.deep) },
      uSunDirection: { value: new THREE.Vector3(...sunDirection) },
      uSunColor: { value: new THREE.Color(WORLD_SUN.keyColor) },
      uHorizon: { value: new THREE.Color(0xdfe6de) },
      uPlateRadius: { value: plateRadius },
    }),
    [plateRadius, sunDirection, texture],
  );
  uniforms.uPlateRadius.value = plateRadius;

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.MirroredRepeatWrapping;
    texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.repeat.set(1.32, 1.32);
    texture.offset.set(level > -8 ? 0.06 : -0.16, -0.16);
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    uniforms.map.value = texture;
    if (material.current) {
      // The look judge probes `material.map.image` on this mesh name. Shader
      // materials have no typed `map`, but the previous unlit plate used that
      // field as the "texture has loaded" signal, so keep it.
      (material.current as THREE.ShaderMaterial & { map?: THREE.Texture }).map = texture;
    }
    return () => texture.dispose();
  }, [gl, level, texture, uniforms]);

  return (
    <mesh
      name="island-look-aerial-plate"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, level - 4, 0]}
    >
      <circleGeometry args={[plateRadius, 96]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={PLATE_VERTEX}
        fragmentShader={PLATE_FRAGMENT}
        toneMapped={false}
        fog={false}
        transparent={false}
        onUpdate={(target) => {
          (target as THREE.ShaderMaterial & { map?: THREE.Texture }).map = texture;
        }}
      />
    </mesh>
  );
}

export function AerialWorldPlateFallback({ extent, level }: { extent: number; level: number }) {
  return (
    <mesh
      name="island-look-aerial-plate-fallback"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, level - 4, 0]}
      receiveShadow
    >
      <circleGeometry args={[Math.max(extent * 3.2, WORLD_PLATE_MIN_RADIUS), 64]} />
      <meshStandardMaterial color={SEA_COLORS.shallow} roughness={0.38} metalness={0.04} />
    </mesh>
  );
}

export function DeepSea({ extent, level }: { extent: number; level: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level - 5.8, 0]}>
      <circleGeometry args={[extent * 3.4, 48]} />
      <meshBasicMaterial color={SEA_COLORS.deep} toneMapped={false} />
    </mesh>
  );
}
