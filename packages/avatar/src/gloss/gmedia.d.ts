import type { Material, Scene, Texture, WebGLRenderer } from "three";

export function studioEnv(renderer: WebGLRenderer): Texture;

export function makeMaterialFactory(
  env: Texture,
): (
  finish: string,
  color: string,
  shell?: boolean,
  print?: { key: string; tex: Texture } | null,
) => Material;

export function dressScene(
  scene: Scene,
  renderer: WebGLRenderer,
  opts?: {
    span?: number;
    pool?: number;
    shadows?: boolean | "wall";
    wallZ?: number;
  },
): { key: unknown; floor: unknown; wall?: unknown };

export const MATERIALS: readonly { id: string; label: string }[];
export const MATERIAL_IDS: readonly string[];
export const MATERIAL_WEIGHTS: readonly [string, number][];
