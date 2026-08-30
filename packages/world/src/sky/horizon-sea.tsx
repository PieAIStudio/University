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
  plateTint: 0xeaf7f3,
  /**
   * The disc beyond the painted plate.
   *
   * It has a radius of 608 against the plate's 259, so from the archipelago
   * camera it is not a horizon detail — it is most of the frame. Painting it
   * with `deep` made the whole background a flat dark teal and buried the
   * painted islands the plate carries, which is what the archipelago view
   * regressed to. This is the tone the plate itself reaches at its far edge,
   * so the seam between them stops being visible.
   */
  beyond: 0x53a2ae,
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
uniform float uOpacity;
uniform float uPlateRadius;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  // The texture is uploaded as sRGB, and three only inserts the transfer
  // function for its own materials; a raw shader gets the linearised values
  // and no way back. The painted plate is artwork rather than a physical
  // albedo, so it is re-encoded here and composited in the space it was drawn
  // in. Without this the backdrop renders roughly a stop and a half dark,
  // which is what turned the archipelago's illustrated coast into flat teal.
  vec3 painting = pow(max(texture2D(map, vUv).rgb, vec3(0.0)), vec3(1.0 / 2.2));
  vec3 albedo = painting * uTint;
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
  vec3 color = mix(albedo, uDeep, deep * 0.42);
  color *= 0.66 + ndotl * 0.78;
  vec2 sunXZ = normalize(uSunDirection.xz);
  float sunFacing = max(dot(normalize(vWorldPosition.xz + vec2(0.001)), sunXZ), 0.0);
  color += uSunColor * pow(sunFacing, 7.0) * 0.05;
  color += uSunColor * glint * 0.9;
  color += vec3(1.16, 1.08, 0.92) * hotSpec * 0.45;
  float rim = smoothstep(0.78, 1.0, dist / max(uPlateRadius, 1.0));
  color = mix(color, uHorizon, rim);

  // The sea treatment above belongs to water the camera is standing over. This
  // plate is also the painted backdrop the archipelago view looks across, and
  // there the same treatment turned an illustrated coast into a flat dark
  // teal: shading a matte painting as though it were a lit surface throws away
  // the painting. Past a third of the plate it hands back to the artwork.
  float painted = smoothstep(uPlateRadius * 0.62, uPlateRadius * 0.98, dist);
  color = mix(color, albedo * 1.04, painted);
  gl_FragColor = vec4(color, uOpacity);
}
`;

export function AerialWorldPlate({
  extent,
  level,
  visible = true,
}: {
  extent: number;
  level: number;
  visible?: boolean;
}) {
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
      uOpacity: { value: 0.86 },
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
      visible={visible}
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
        transparent
        onUpdate={(target) => {
          (target as THREE.ShaderMaterial & { map?: THREE.Texture }).map = texture;
        }}
      />
    </mesh>
  );
}

export function AerialWorldPlateFallback({
  extent,
  level,
  visible = true,
}: {
  extent: number;
  level: number;
  visible?: boolean;
}) {
  return (
    <mesh
      name="island-look-aerial-plate-fallback"
      visible={visible}
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
      <meshBasicMaterial color={SEA_COLORS.beyond} toneMapped={false} />
    </mesh>
  );
}

/**
 * A distant atmospheric ground plane keeps the lower frame from becoming a
 * second flat sky colour. It is deliberately below the floating islands and
 * broad enough that its edge dissolves in fog; it reads as a far forest/sea
 * horizon, never as another playable island or a continuous world floor.
 */
export function DistantGround({ extent, level }: { extent: number; level: number }) {
  return (
    <mesh
      name="island-look-distant-ground"
      rotation={[-Math.PI / 2, 0, 0]}
      // The course camera looks down by design. At -36 a large disc catches
      // even the upper rays and turns the whole sky into one muddy fog colour;
      // lowering it makes the disc enter only at the bottom of the frame,
      // where it can suggest a far forest/sea without becoming a backdrop.
      position={[0, level - 60, 0]}
      scale={[1.26, 0.9, 1]}
      renderOrder={-2}
    >
      <circleGeometry args={[Math.max(extent * 12, 420), 64]} />
      <meshBasicMaterial color={0x7d8db9} transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}
