import { useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { hashStr } from "./rng.js";
import {
  buildGloss,
  ensureGParams,
  GPARTS,
  newGRecipe,
  rerollGPart,
  type GRecipe,
  type GlossBuilt,
} from "./gloss/grig.js";
import { createGlossFace, type GlossLife } from "./gloss/gface.js";
import { makeMaterialFactory, studioEnv } from "./gloss/gmedia.js";
import { GSPECIES, GSPECIES_IDS } from "./gloss/gspecies.js";
import { PALETTES as GLOSS_PALETTES } from "./gloss/gpalette.js";

export interface AvatarRecipe {
  seed: number;
  species: string | null;
  body: string | null;
  stance: string | null;
  palette: string | null;
  colorIx: number | null;
  material: string | null;
  parts: Record<string, { params?: unknown; rr?: number }>;
}

export const SPECIES: readonly { id: string; label: string }[] = GSPECIES_IDS.map((id) => ({
  id,
  label: GSPECIES[id]?.label ?? id,
}));

export const PALETTES: readonly { id: string; label: string }[] = GLOSS_PALETTES.map((palette) => ({
  id: palette.id,
  label: palette.label,
}));

export const PARTS: readonly { id: string; label: string }[] = GPARTS.map((part) => ({
  id: part.id,
  label: part.label,
}));

function cloneRecipe(recipe: AvatarRecipe): AvatarRecipe {
  return structuredClone(recipe);
}

function seedToInt(seed?: string): number {
  if (seed === undefined || seed === "") return (Math.random() * 1e9) | 0;
  if (/^\d+$/.test(seed)) return Number(seed) >>> 0;
  return hashStr(seed);
}

export function fillRecipe(recipe: AvatarRecipe): AvatarRecipe {
  const next = cloneRecipe(recipe);
  ensureGParams(next as GRecipe);
  return next;
}

export function randomRecipe(seed?: string): AvatarRecipe {
  const recipe = newGRecipe(seedToInt(seed)) as AvatarRecipe;
  ensureGParams(recipe as GRecipe);
  return recipe;
}

export function rerollPart(recipe: AvatarRecipe, partId: string): AvatarRecipe {
  const next = cloneRecipe(recipe);
  rerollGPart(next as GRecipe, partId);
  return next;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

const envByRenderer = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

function envFor(renderer: THREE.WebGLRenderer): THREE.Texture {
  const cached = envByRenderer.get(renderer);
  if (cached) return cached;
  const env = studioEnv(renderer);
  envByRenderer.set(renderer, env);
  return env;
}

export function Avatar({
  recipe,
  gaze = true,
  scale = 1,
  position = [0, 0, 0],
  onBuilt,
}: {
  recipe: AvatarRecipe;
  gaze?: boolean;
  scale?: number;
  position?: [number, number, number];
  onBuilt?: (stats: { meshes: number; verts: number; buildMs: number }) => void;
}): JSX.Element {
  const { gl } = useThree();
  const env = useMemo(() => envFor(gl), [gl]);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const builtRef = useRef<GlossBuilt | null>(null);
  const lifeRef = useRef<GlossLife | null>(null);
  const elapsedRef = useRef(0);
  const onBuiltRef = useRef(onBuilt);
  onBuiltRef.current = onBuilt;

  useLayoutEffect(() => {
    const materialFor = makeMaterialFactory(env);
    const built = buildGloss(cloneRecipe(recipe) as GRecipe, { materialFor });
    builtRef.current = built;
    lifeRef.current = createGlossFace(built, { gaze });
    elapsedRef.current = 0;
    setGroup(built.group);
    onBuiltRef.current?.(built.stats);
    return () => {
      lifeRef.current = null;
      builtRef.current = null;
      setGroup(null);
      disposeObject(built.group);
    };
  }, [recipe, env, gaze]);

  useFrame((_, dt) => {
    const built = builtRef.current;
    const life = lifeRef.current;
    if (!built || !life) return;
    elapsedRef.current += dt;
    const t = elapsedRef.current;
    const head = life.update(t, dt);
    const breath = 1 + Math.sin(t * 1.8) * 0.007;
    built.group.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    built.head.position.set(head.x, Number(built.head.userData.restY) + head.y, 0);
    built.head.rotation.set(head.pitch, head.yaw, head.rot);
  });

  return (
    <group scale={scale} position={position}>
      {group ? <primitive object={group} dispose={null} /> : null}
    </group>
  );
}
