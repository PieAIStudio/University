/** Serializable output from the SAME globe and course-island generators. */
import * as THREE from "three";
import {
  buildAtmosphericIslands,
  planAtmosphericRegions,
  type PlanetRepresentativeLimit,
} from "./atmospheric-regions.js";
import { createDomainSurfaceTexture } from "./globe-geometry.js";
import type { PlanetStudy } from "./planet-copy.js";

export interface PreparedDomain {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly islands: null | {
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    readonly colors: Float32Array;
    readonly indices: Uint16Array | Uint32Array;
  };
  readonly preparationMs: { readonly texture: number; readonly islands: number };
}

/** Runs in a module worker. No new noise, LOD, seed or geometry implementation. */
export function prepareDomain(
  domainId: string,
  studies: readonly PlanetStudy[],
  limit: PlanetRepresentativeLimit = 5,
): PreparedDomain {
  const start = performance.now();
  const texture = createDomainSurfaceTexture(domainId);
  const textureDone = performance.now();
  const mesh = buildAtmosphericIslands(studies, planAtmosphericRegions(studies, limit));
  try {
    const position = mesh.getAttribute("position");
    const index = mesh.getIndex();
    return {
      pixels: texture.image.data as Uint8Array,
      width: texture.image.width,
      height: texture.image.height,
      islands:
        position && index
          ? {
              positions: position.array as Float32Array,
              normals: mesh.getAttribute("normal").array as Float32Array,
              colors: mesh.getAttribute("color").array as Float32Array,
              indices: index.array as Uint16Array | Uint32Array,
            }
          : null,
      preparationMs: { texture: textureDone - start, islands: performance.now() - textureDone },
    };
  } finally {
    texture.dispose();
    mesh.dispose();
  }
}

export function preparedDomainBuffers(packet: PreparedDomain): ArrayBuffer[] {
  return [
    packet.pixels,
    ...(packet.islands
      ? [
          packet.islands.positions,
          packet.islands.normals,
          packet.islands.colors,
          packet.islands.indices,
        ]
      : []),
  ].map((array) => array.buffer as ArrayBuffer);
}

/** GPU resources belong to the mounted viewport, never to the CPU cache. */
export function mountPreparedDomain(packet: PreparedDomain) {
  const texture = new THREE.DataTexture(
    packet.pixels,
    packet.width,
    packet.height,
    THREE.RGBAFormat,
  );
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const islands = new THREE.BufferGeometry();
  if (packet.islands) {
    islands.setAttribute("position", new THREE.BufferAttribute(packet.islands.positions, 3));
    islands.setAttribute("normal", new THREE.BufferAttribute(packet.islands.normals, 3));
    islands.setAttribute("color", new THREE.BufferAttribute(packet.islands.colors, 3));
    islands.setIndex(new THREE.BufferAttribute(packet.islands.indices, 1));
    islands.computeBoundingSphere();
  }
  return {
    texture,
    islands,
    dispose() {
      texture.dispose();
      islands.dispose();
    },
  };
}
