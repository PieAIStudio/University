import type { Group, Material, Mesh, Texture } from "three";

export interface GRecipe {
  seed: number;
  species: string | null;
  body: string | null;
  stance: string | null;
  palette: string | null;
  colorIx: number | null;
  material: string | null;
  parts: Record<string, { params?: unknown; rr?: number }>;
}

export type MaterialFor = (
  finish: string,
  color: string,
  shell?: boolean,
  print?: { key: string; tex: Texture } | null,
) => Material;

export interface GlossBuilt {
  group: Group;
  head: Group;
  face: Record<string, Mesh>;
  P: Record<string, unknown>;
  L: { s: number; H: number; W: number; cy: number };
  bounds: { w: number; h: number; cy: number; minY: number; maxY: number };
  stats: { buildMs: number; verts: number; meshes: number };
}

export const GPARTS: readonly { id: string; label: string }[];
export const GPART_BY_ID: Record<string, { id: string; label: string }>;
export const BODY_IDS: readonly string[];
export const STANCE_IDS: readonly string[];

export function newGRecipe(seed?: number): GRecipe;
export function ensureGParams(recipe: GRecipe): GRecipe;
export function rerollGPart(recipe: GRecipe, id: string): void;
export function buildGloss(recipe: GRecipe, opts?: { materialFor?: MaterialFor }): GlossBuilt;
