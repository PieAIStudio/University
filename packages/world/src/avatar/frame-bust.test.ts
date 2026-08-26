import * as THREE from "three";
import {
  buildAvatar,
  randomRecipe,
  type AvatarBounds,
  type AvatarRecipe,
} from "@pieai/swimmer-avatar-kit";
import { describe, expect, it } from "vitest";

import { BUST_PADDING, BUST_SLICE, frameBust } from "./frame-bust.js";

/** The guest bunny, as the kit actually builds it. Measured, not invented. */
const BUNNY = { w: 1.1046, h: 1.434, maxY: 1.434 } as const;

const halfViewAt = (distance: number, fov: number) => distance * Math.tan((fov * Math.PI) / 360);

const FRAME_RECIPE_CASES = [
  { name: "long ears", seed: "frame-probe-323", species: "bunny", part: "crest", style: "bunny" },
  {
    name: "high hairstyle",
    seed: "frame-probe-495",
    species: "humanoid",
    part: "hair",
    style: "hime",
  },
  { name: "accessory", seed: "frame-probe-184", species: "humanoid", part: "hat", style: "flower" },
  { name: "ordinary", seed: "frame-probe-475", species: "bear", part: "hair", style: "bald" },
] as const;

/** Avoid the kit's optional canvas-backed shirt print in this node-only test. */
function withoutPrint(recipe: AvatarRecipe): AvatarRecipe {
  const params = recipe.parts.frame?.params;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    (params as { motif?: string }).motif = "none";
  }
  return recipe;
}

function partStyle(recipe: AvatarRecipe, part: string): string | undefined {
  const params = recipe.parts[part]?.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return undefined;
  return (params as { style?: string }).style;
}

/** Ask the pinned kit for the real bounds instead of inventing test dimensions. */
function boundsFor(seed: string): { recipe: AvatarRecipe; bounds: AvatarBounds } {
  const recipe = withoutPrint(randomRecipe(seed));
  const materials = new Set<THREE.Material>();
  const avatar = buildAvatar(recipe, {
    materialFor: (_finish, color) => {
      const material = new THREE.MeshBasicMaterial({ color });
      materials.add(material);
      return material;
    },
  });
  const bounds = avatar.bounds;
  avatar.dispose();
  for (const material of materials) material.dispose();
  return { recipe, bounds };
}

describe("frameBust", () => {
  /*
    The bug this exists for. The first version fitted the height of the slice
    and ignored the width, so on a square canvas the shot was 0.71 across
    against a body 1.10 across — the camera sat inside the creature's shoulder
    and the avatar rendered as a wall of colour.
  */
  it("contains the creature's width, not just the slice's height", () => {
    const fov = 26;
    const { distance } = frameBust(BUNNY, fov);
    expect(halfViewAt(distance, fov) * 2).toBeGreaterThan(BUNNY.w);
  });

  it("leaves air rather than touching the edge", () => {
    const fov = 26;
    const { distance } = frameBust(BUNNY, fov);
    const tight = frameBust(BUNNY, fov).distance / BUST_PADDING;
    expect(distance / tight).toBeGreaterThanOrEqual(1.18);
    expect(distance / tight).toBeLessThanOrEqual(1.22);
  });

  it("aims at the top of the creature, not its middle", () => {
    const { centreY } = frameBust(BUNNY, 26);
    expect(centreY).toBeGreaterThan(BUNNY.h / 2);
    expect(centreY).toBeLessThan(BUNNY.maxY);
  });

  /*
    Nine species differ in height by about a factor of two, which is why this
    is computed rather than pinned. A slime and a bunny have to both arrive
    filling the same circle.
  */
  it("gives short and tall creatures the same apparent size", () => {
    const fov = 26;
    const slime = { w: 1.2, h: 0.8, maxY: 0.8 };
    const tall = { w: 1.2, h: 2.4, maxY: 2.4 };
    const fill = (b: typeof slime) => {
      const { distance } = frameBust(b, fov);
      return Math.max(b.h * 0.7, b.w) / (halfViewAt(distance, fov) * 2);
    };
    expect(fill(slime)).toBeCloseTo(fill(tall), 5);
  });

  it("survives a degenerate build without dividing by zero", () => {
    const { distance } = frameBust({ w: 0, h: 0, maxY: 0 }, 26);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(0);
  });

  it.each(FRAME_RECIPE_CASES)(
    "keeps the $name recipe inside the bust",
    ({ seed, species, part, style }) => {
      const { recipe, bounds } = boundsFor(seed);
      expect(recipe.species).toBe(species);
      expect(partStyle(recipe, part)).toBe(style);

      const fov = 26;
      const { centreY, distance } = frameBust(bounds, fov);
      const halfView = halfViewAt(distance, fov);
      const slice = Math.max(bounds.h * BUST_SLICE, 0.01);

      expect(centreY + halfView).toBeGreaterThan(bounds.maxY);
      expect(centreY - halfView).toBeLessThan(bounds.maxY - slice);
    },
  );
});
