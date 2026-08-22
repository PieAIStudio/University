import type { GlossBuilt } from "./grig.js";

export const GLOSS_FACES: readonly string[];

export interface GlossHead {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  rot: number;
}

export interface GlossLife {
  head: GlossHead;
  face: () => string;
  setFace: (id: string) => void;
  update: (t: number, dt: number) => GlossHead;
}

export function createGlossFace(built: GlossBuilt, opts?: { gaze?: boolean }): GlossLife;
