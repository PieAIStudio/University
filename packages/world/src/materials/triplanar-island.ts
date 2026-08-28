/**
 * Independent triplanar terrain material spike.
 *
 * Research source, read but not copied: elemental-serenity
 * @ 6b8cebefa0ee10e1bdd081dd342a01b3fe753e09,
 * src/Shaders/Chunks/ground/ground.fragment_color_chunk.glsl. The donor's
 * density/path/height/AO maps are deliberately rejected here: this material
 * has no UV contract and keeps route and slope masks deterministic in shader.
 *
 * This module owns one ShaderMaterial only. It does not import the island
 * blueprint, geometry, dressing, sky, Stage or kit. The demo can therefore
 * measure the projection cost without changing the product renderer.
 */
import * as THREE from "three";

export type IslandTriplanarProjection = "full" | "hybrid";
export type IslandTriplanarMaterialMode = "single" | "multi";

export interface IslandTriplanarTextures {
  readonly grass: THREE.Texture;
  readonly route: THREE.Texture;
  readonly rock: THREE.Texture;
  readonly detail: THREE.Texture;
}

export interface IslandTriplanarMaterialOptions {
  readonly textures: IslandTriplanarTextures;
  readonly useTextures?: boolean;
  readonly materialMode?: IslandTriplanarMaterialMode;
  readonly projection?: IslandTriplanarProjection;
  readonly textureScale?: number;
  readonly hybridTopNormal?: number;
}

export interface IslandTriplanarUniforms {
  readonly [uniform: string]: THREE.IUniform;
  readonly uGrassMap: { value: THREE.Texture };
  readonly uRouteMap: { value: THREE.Texture };
  readonly uRockMap: { value: THREE.Texture };
  readonly uDetailMap: { value: THREE.Texture };
  readonly uUseTextures: { value: number };
  readonly uMaterialMode: { value: number };
  readonly uProjectionMode: { value: number };
  readonly uTextureScale: { value: number };
  readonly uHybridTopNormal: { value: number };
  readonly uGrassFallback: { value: THREE.Color };
  readonly uRouteFallback: { value: THREE.Color };
  readonly uRockFallback: { value: THREE.Color };
  readonly uDetailAmount: { value: number };
}

export const ISLAND_TEXTURE_MAX_ANISOTROPY = 4;

export function configureIslandTexture(
  texture: THREE.Texture,
  renderer: THREE.WebGLRenderer,
  colorTexture: boolean,
): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(
    ISLAND_TEXTURE_MAX_ANISOTROPY,
    renderer.capabilities.getMaxAnisotropy(),
  );
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function configureIslandTextureSet(
  textures: IslandTriplanarTextures,
  renderer: THREE.WebGLRenderer,
): IslandTriplanarTextures {
  configureIslandTexture(textures.grass, renderer, true);
  configureIslandTexture(textures.route, renderer, true);
  configureIslandTexture(textures.rock, renderer, true);
  configureIslandTexture(textures.detail, renderer, false);
  return textures;
}

const VERTEX_SHADER = /* glsl */ `
varying vec3 vIslandWorldPosition;
varying vec3 vIslandWorldNormal;
varying float vIslandHeight;

void main() {
  vec4 islandWorldPosition = modelMatrix * vec4(position, 1.0);
  vIslandWorldPosition = islandWorldPosition.xyz;
  vIslandWorldNormal = normalize(mat3(modelMatrix) * normal);
  vIslandHeight = position.y;
  gl_Position = projectionMatrix * viewMatrix * islandWorldPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uGrassMap;
uniform sampler2D uRouteMap;
uniform sampler2D uRockMap;
uniform sampler2D uDetailMap;
uniform float uUseTextures;
uniform float uMaterialMode;
uniform float uProjectionMode;
uniform float uTextureScale;
uniform float uHybridTopNormal;
uniform vec3 uGrassFallback;
uniform vec3 uRouteFallback;
uniform vec3 uRockFallback;
uniform float uDetailAmount;

varying vec3 vIslandWorldPosition;
varying vec3 vIslandWorldNormal;
varying float vIslandHeight;

vec3 islandProjectionWeights(vec3 normal) {
  vec3 weights = abs(normal);
  weights *= weights;
  return weights / max(dot(weights, vec3(1.0)), 0.0001);
}

vec4 islandTriplanar(sampler2D map, vec3 position, vec3 normal) {
  vec3 weights = islandProjectionWeights(normal);
  vec4 top = texture2D(map, position.xz * uTextureScale);
  if (uProjectionMode > 0.5 && abs(normal.y) >= uHybridTopNormal) {
    return top;
  }
  vec4 sideX = texture2D(map, position.yz * uTextureScale);
  vec4 sideZ = texture2D(map, position.xy * uTextureScale);
  return sideX * weights.x + top * weights.y + sideZ * weights.z;
}

vec3 islandSample(vec3 fallback, sampler2D map, vec3 position, vec3 normal) {
  if (uUseTextures < 0.5) {
    return fallback;
  }
  return islandTriplanar(map, position, normal).rgb;
}

vec3 islandGrade(vec3 linearColor) {
  float luma = dot(linearColor, vec3(0.2126, 0.7152, 0.0722));
  vec3 shaped = mix(vec3(luma), linearColor, 1.045);
  // A restrained warm highlight / cool shadow split keeps this demo in the
  // same readable diorama family as the product without another post pass.
  shaped *= mix(vec3(0.97, 1.00, 1.03), vec3(1.04, 1.015, 0.95), smoothstep(0.32, 0.85, luma));
  return max(shaped, vec3(0.0));
}

void main() {
  vec3 normal = normalize(vIslandWorldNormal);
  vec3 grass = islandSample(uGrassFallback, uGrassMap, vIslandWorldPosition, normal);

  float topness = smoothstep(0.30, 0.86, abs(normal.y));
  float rockMask = 1.0 - topness;
  float routeCenter = 0.72 * sin(vIslandWorldPosition.x * 0.34);
  routeCenter += 0.28 * sin(vIslandWorldPosition.x * 0.77 + 0.8);
  float routeMask = 1.0 - smoothstep(0.18, 0.44, abs(vIslandWorldPosition.z - routeCenter));
  routeMask *= smoothstep(0.50, 0.86, abs(normal.y));
  routeMask *= smoothstep(-0.5, 1.2, vIslandHeight);

  vec3 albedo = grass;
  if (uMaterialMode > 0.5) {
    vec3 route = islandSample(uRouteFallback, uRouteMap, vIslandWorldPosition, normal);
    vec3 rock = islandSample(uRockFallback, uRockMap, vIslandWorldPosition, normal);
    albedo = mix(albedo, route, routeMask);
    albedo = mix(albedo, rock, rockMask * (1.0 - routeMask));
  }

  if (uUseTextures > 0.5) {
    float detail = islandTriplanar(uDetailMap, vIslandWorldPosition, normal).r;
    albedo *= 1.0 + (detail - 0.5) * uDetailAmount;
  }

  vec3 lightDirection = normalize(vec3(-0.52, 0.82, 0.42));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float hemisphere = normal.y * 0.5 + 0.5;
  float light = 0.58 + diffuse * 0.30 + hemisphere * 0.12;
  vec3 linearColor = albedo * light;
  gl_FragColor = vec4(islandGrade(linearColor), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function projectionValue(projection: IslandTriplanarProjection): number {
  return projection === "hybrid" ? 1 : 0;
}

function materialModeValue(mode: IslandTriplanarMaterialMode): number {
  return mode === "multi" ? 1 : 0;
}

export function createIslandTriplanarMaterial(
  options: IslandTriplanarMaterialOptions,
): THREE.ShaderMaterial {
  const uniforms: IslandTriplanarUniforms = {
    uGrassMap: { value: options.textures.grass },
    uRouteMap: { value: options.textures.route },
    uRockMap: { value: options.textures.rock },
    uDetailMap: { value: options.textures.detail },
    uUseTextures: { value: options.useTextures === false ? 0 : 1 },
    uMaterialMode: { value: materialModeValue(options.materialMode ?? "multi") },
    uProjectionMode: { value: projectionValue(options.projection ?? "hybrid") },
    uTextureScale: { value: options.textureScale ?? 0.17 },
    uHybridTopNormal: { value: options.hybridTopNormal ?? 0.78 },
    uGrassFallback: { value: new THREE.Color(0.46, 0.67, 0.24) },
    uRouteFallback: { value: new THREE.Color(0.84, 0.74, 0.53) },
    uRockFallback: { value: new THREE.Color(0.48, 0.28, 0.17) },
    uDetailAmount: { value: 0.08 },
  };

  const material = new THREE.ShaderMaterial({
    name: "UniversityIslandTriplanarDemo",
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    lights: false,
    fog: false,
    toneMapped: true,
    side: THREE.FrontSide,
  });
  material.userData.islandTriplanarUniforms = uniforms;
  material.userData.islandTriplanarShader = {
    projection: options.projection ?? "hybrid",
    materialMode: options.materialMode ?? "multi",
  };
  return material;
}

export function setIslandTriplanarMaterialState(
  material: THREE.ShaderMaterial,
  state: {
    readonly useTextures?: boolean;
    readonly materialMode?: IslandTriplanarMaterialMode;
    readonly projection?: IslandTriplanarProjection;
  },
): void {
  const uniforms = material.userData.islandTriplanarUniforms as IslandTriplanarUniforms | undefined;
  if (!uniforms) {
    throw new Error("Material was not created by createIslandTriplanarMaterial");
  }
  if (state.useTextures !== undefined) {
    uniforms.uUseTextures.value = state.useTextures ? 1 : 0;
  }
  if (state.materialMode !== undefined) {
    uniforms.uMaterialMode.value = materialModeValue(state.materialMode);
  }
  if (state.projection !== undefined) {
    uniforms.uProjectionMode.value = projectionValue(state.projection);
  }
}

export function getIslandTriplanarUniforms(
  material: THREE.ShaderMaterial,
): IslandTriplanarUniforms {
  const uniforms = material.userData.islandTriplanarUniforms as IslandTriplanarUniforms | undefined;
  if (!uniforms) {
    throw new Error("Material was not created by createIslandTriplanarMaterial");
  }
  return uniforms;
}
