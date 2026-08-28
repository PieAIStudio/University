/**
 * Narrow skydome adapter.
 *
 * Colour stops stay this product's climates. The altitude falloff, sun disc
 * and horizon atmosphere are rewritten from elemental-serenity
 * `src/Shaders/Materials/skydome/*` at
 * `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`. Night, moon, stars, season
 * branching, a second renderer, and the donor's own tone mapping are
 * rejected: this mesh runs in the one Stage-owned loop, writes working-linear
 * colour, and lets the kit blit own ACES and the one sRGB encode.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { worldSunDirection, WORLD_SUN } from "./sun.js";

export type SkyDomeStops = {
  readonly zenith: number;
  readonly mid: number;
  readonly horizon: number;
};

/** Stable discovery keys used by Stage's environment owner. */
export const SKY_DOME_NAME = "world-skydome";
export const SKY_DOME_STOPS_KEY = "worldEnvironmentStops";

export const SKY_DOME_VERTEX_SHADER = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_DOME_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSunGlowColor;
uniform float uSunSize;
uniform float uSunGlowSize;
varying vec3 vDir;

void main() {
  vec3 direction = normalize(vDir);
  float altitude = direction.y;
  vec3 skyColor;
  if (altitude > 0.0) {
    float midFactor = smoothstep(0.0, 0.32, altitude);
    float zenithFactor = smoothstep(0.22, 0.92, altitude);
    skyColor = mix(uHorizon, uMid, midFactor);
    skyColor = mix(skyColor, uZenith, zenithFactor);
  } else {
    float nadirFactor = pow(clamp(-altitude, 0.0, 1.0), 0.5);
    skyColor = mix(uHorizon, uNadir, nadirFactor);
  }

  vec3 sunDir = normalize(uSunDirection);
  float sunDot = clamp(dot(direction, sunDir), -1.0, 1.0);
  float distFromSun = acos(sunDot);
  float outerGlow = smoothstep(uSunGlowSize * 2.2, 0.0, distFromSun);
  skyColor += uSunGlowColor * (outerGlow * outerGlow) * 0.38;
  float disc = smoothstep(uSunSize * 1.7, uSunSize * 0.5, distFromSun);
  skyColor += mix(uSunGlowColor, uSunColor, disc) * disc * 1.05;
  skyColor += vec3(1.1, 1.04, 0.9) * pow(disc, 2.6) * 0.7;
  float horizonBand = exp(-altitude * altitude * 36.0);
  float sunAzimuth = max(dot(normalize(direction.xz + vec2(0.0001)), normalize(sunDir.xz)), 0.0);
  skyColor += uSunGlowColor * horizonBand * pow(sunAzimuth, 8.0) * 0.16;

  float atmosphere = 1.0 - abs(altitude);
  atmosphere *= atmosphere;
  skyColor += vec3(0.5, 0.68, 1.0) * (atmosphere * 0.09);

  gl_FragColor = vec4(skyColor, 1.0);
}
`;

/** One shader/uniform implementation for both the visible dome and its IBL. */
export function createSkyDomeUniforms(stops: SkyDomeStops) {
  const sunDirection = worldSunDirection();
  return {
    uZenith: { value: new THREE.Color(stops.zenith) },
    uMid: { value: new THREE.Color(stops.mid) },
    uHorizon: { value: new THREE.Color(stops.horizon) },
    uNadir: { value: new THREE.Color(0x3a7f92) },
    uSunDirection: { value: new THREE.Vector3(...sunDirection) },
    uSunColor: { value: new THREE.Color(WORLD_SUN.keyColor) },
    uSunGlowColor: { value: new THREE.Color(0xffc56a) },
    uSunSize: { value: 0.032 },
    uSunGlowSize: { value: 0.11 },
  };
}

export function SkyDome({ stops }: { stops: SkyDomeStops }) {
  const mesh = useRef<THREE.Mesh>(null);
  const sunDirection = worldSunDirection();
  const uniforms = useMemo(
    () => createSkyDomeUniforms(stops),
    // Climate identity is the stops object; the sun is the shared world sun.
    [stops.horizon, stops.mid, stops.zenith, sunDirection],
  );
  uniforms.uZenith.value.setHex(stops.zenith);
  uniforms.uMid.value.setHex(stops.mid);
  uniforms.uHorizon.value.setHex(stops.horizon);
  uniforms.uSunDirection.value.set(...sunDirection);

  useFrame(({ camera }) => {
    if (islandLookFrozen()) return;
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh
      ref={mesh}
      name={SKY_DOME_NAME}
      userData={{ [SKY_DOME_STOPS_KEY]: stops }}
      frustumCulled={false}
      renderOrder={-1000}
    >
      <sphereGeometry args={[420, 32, 20]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={SKY_DOME_VERTEX_SHADER}
        fragmentShader={SKY_DOME_FRAGMENT_SHADER}
      />
    </mesh>
  );
}
