/**
 * Small scenes of Kenney props that make the island read as a landscape
 * (R59-08, owner 2026-09-23: 「door 的东西还是太少」).
 *
 * The reference's density is not one more kind of prop scattered evenly; it
 * is little groups that each say something — a woodpile by a stump, a ring of
 * mushrooms at a wood's edge, a short fence along the road with flowers at its
 * foot. The island already has trees, rocks, a camp and flowers; these fill the
 * ground between them with the Nature Kit models the repository already ships
 * for the world map (`/kenney/grid/nature`, CC0), in one batched draw.
 *
 * Planned last, with the wildflowers: every group keeps off the road, the
 * lesson stones, the learning nodes and everything already standing, and the
 * wildflowers then keep off the groups. Nothing here moves anything.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { createIslandHeightSampler } from "./island-geometry.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { hash } from "./random.js";

const NATURE = "/kenney/grid/nature";
/** Every model a vignette may use, with the height it is drawn at (world units). */
export const VIGNETTE_MODELS = {
  logStack: { src: `${NATURE}/log_stack.glb`, height: 0.62 },
  log: { src: `${NATURE}/log.glb`, height: 0.3 },
  stump: { src: `${NATURE}/stump_oldTall.glb`, height: 0.7 },
  mushroomRed: { src: `${NATURE}/mushroom_redGroup.glb`, height: 0.42 },
  mushroomTall: { src: `${NATURE}/mushroom_redTall.glb`, height: 0.5 },
  mushroomTan: { src: `${NATURE}/mushroom_tanGroup.glb`, height: 0.4 },
  flowerPurple: { src: `${NATURE}/flower_purpleA.glb`, height: 0.42 },
  flowerRed: { src: `${NATURE}/flower_redA.glb`, height: 0.46 },
  flowerYellow: { src: `${NATURE}/flower_yellowA.glb`, height: 0.36 },
  grass: { src: `${NATURE}/grass_large.glb`, height: 0.4 },
  leafs: { src: `${NATURE}/grass_leafsLarge.glb`, height: 0.26 },
  bush: { src: `${NATURE}/plant_bushSmall.glb`, height: 0.42 },
  fence: { src: `${NATURE}/fence_simple.glb`, height: 0.55 },
  pumpkin: { src: `${NATURE}/crop_pumpkin.glb`, height: 0.42 },
} as const;
export type VignetteModel = keyof typeof VIGNETTE_MODELS;

export interface VignetteProp {
  readonly model: VignetteModel;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly turn: number;
  /** Multiplies the model's drawn height. */
  readonly scale: number;
}
export interface Vignette {
  readonly kind: "woodpile" | "mushrooms" | "flowers" | "fence" | "patch";
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly props: readonly VignetteProp[];
}

/** Local layouts, in the group's frame (+x along its turn): model, offset, turn, scale. */
const LAYOUTS: Readonly<
  Record<
    Exclude<Vignette["kind"], "fence">,
    readonly (readonly [VignetteModel, number, number, number, number])[]
  >
> = {
  woodpile: [
    ["logStack", 0, 0, 0, 1],
    ["stump", 0.6, 0.3, 0.4, 1],
    ["log", -0.45, 0.35, 1.3, 1],
    ["mushroomTan", 0.45, -0.32, 0.7, 0.9],
    ["leafs", -0.25, -0.4, 0.2, 1],
  ],
  mushrooms: [
    ["mushroomRed", 0, 0, 0, 1],
    ["mushroomTall", 0.35, 0.2, 1.1, 1],
    ["mushroomRed", -0.3, 0.3, 2.3, 0.8],
    ["leafs", 0.1, -0.35, 0.5, 1],
  ],
  flowers: [
    ["flowerPurple", 0, 0, 0, 1],
    ["flowerYellow", 0.28, 0.12, 1, 1],
    ["flowerRed", -0.22, 0.24, 2, 1],
    ["flowerPurple", 0.12, -0.28, 3, 0.9],
    ["grass", -0.35, -0.2, 0.6, 1],
  ],
  patch: [
    ["bush", 0, 0, 0, 1],
    ["grass", 0.4, 0.15, 1.2, 1],
    ["pumpkin", -0.35, 0.3, 0.3, 1],
    ["leafs", 0.1, -0.4, 2, 1],
  ],
};
const RADIUS: Readonly<Record<Vignette["kind"], number>> = {
  woodpile: 0.85,
  mushrooms: 0.6,
  flowers: 0.6,
  patch: 0.75,
  fence: 0.4,
};

/** The most groups an island takes; each is a handful of props. */
export const VIGNETTE_LIMIT = 70;
const CELL = 2.4;
/** A fence stands in every so many gaps between lesson stones. */
const FENCE_GAPS = 3;

export function planCourseVignettes(
  blueprint: IslandBlueprint,
  occupied: readonly (IslandPoint & { readonly radius: number })[],
  exclusions: readonly (IslandPoint & { readonly radius: number })[] = [],
): readonly Vignette[] {
  const field = islandFieldFor(blueprint);
  const clearance = islandRouteClearance(blueprint);
  const ground = createIslandHeightSampler(blueprint);
  const vignettes: Vignette[] = [];
  try {
    const taken = (x: number, z: number, r: number, stoneGap = 0.5) =>
      occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + r) ||
      exclusions.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + r) ||
      vignettes.some((v) => Math.hypot(v.x - x, v.z - z) < v.radius + r + 0.6) ||
      blueprint.nodes.some(
        (n) => Math.hypot(n.x - x, n.z - z) < blueprint.route.nodeRadius + r + stoneGap,
      );
    const level = (x: number, z: number, r: number) => {
      const centre = ground.heightAt(x, z);
      if (!centre.inside) return null;
      for (let step = 0; step < 6; step += 1) {
        const a = (step / 6) * Math.PI * 2;
        const rim = ground.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
        if (!rim.inside || Math.abs(rim.y - centre.y) > 0.3) return null;
      }
      return centre.y;
    };
    const place = (
      kind: Vignette["kind"],
      x: number,
      z: number,
      turn: number,
      layout: readonly (readonly [VignetteModel, number, number, number, number])[],
    ): boolean => {
      const radius = RADIUS[kind];
      if (level(x, z, radius) === null || taken(x, z, radius)) return false;
      const cos = Math.cos(turn),
        sin = Math.sin(turn);
      const props = layout.flatMap(([model, lx, lz, t, scale]) => {
        const px = x + lx * cos - lz * sin,
          pz = z + lx * sin + lz * cos;
        const h = ground.heightAt(px, pz);
        return h.inside ? [{ model, x: px, y: h.y, z: pz, turn: turn + t, scale }] : [];
      });
      vignettes.push({ kind, x, z, radius, props });
      return true;
    };

    // Short fences along the road: two or three rails on the verge halfway
    // between two lesson stones, turned with the road, every few gaps.
    const line = blueprint.centerline;
    const nodes = blueprint.nodes;
    for (
      let gap = 1 + Math.floor(hash(`${blueprint.seed}/fence/start`) * FENCE_GAPS);
      gap < nodes.length - 1 && vignettes.length < VIGNETTE_LIMIT;
      gap += FENCE_GAPS
    ) {
      const t = (nodes[gap]!.t + nodes[gap + 1]!.t) / 2;
      const k = Math.max(
        1,
        line.findIndex((p) => p.t >= t),
      );
      const a = line[k - 1]!,
        b = line[k]!;
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const tx = (b.x - a.x) / length,
        tz = (b.z - a.z) / length;
      const side = hash(`${blueprint.seed}/fence/${gap}/side`) < 0.5 ? -1 : 1;
      const offset = clearance + 0.55;
      const cx = b.x - tz * offset * side,
        cz = b.z + tx * offset * side;
      const turn = Math.atan2(tz, tx);
      const rails = 2 + Math.floor(hash(`${blueprint.seed}/fence/${gap}/n`) * 2);
      const layout: [VignetteModel, number, number, number, number][] = [];
      const span = 1.02;
      for (let r = 0; r < rails; r += 1)
        layout.push(["fence", (r - (rails - 1) / 2) * span, 0, 0, 1]);
      layout.push(["flowerYellow", -0.4, 0.35 * side, 0.5, 0.9]);
      layout.push(["grass", 0.6, 0.3 * side, 1.1, 0.9]);
      // Each rail keeps its own ground clear, not one circle round the run.
      const rail = (r: number) => ({
        x: cx + Math.cos(turn) * (r - (rails - 1) / 2) * span,
        z: cz + Math.sin(turn) * (r - (rails - 1) / 2) * span,
      });
      const blocked = Array.from({ length: rails }, (_, r) => rail(r)).some(
        (p) =>
          distanceToIslandRoute(blueprint, p) < clearance + 0.25 ||
          level(p.x, p.z, 0.3) === null ||
          taken(p.x, p.z, RADIUS.fence, 0.2),
      );
      if (blocked) continue;
      vignettes.push({
        kind: "fence",
        x: cx,
        z: cz,
        radius: (rails * span) / 2,
        props: layout.flatMap(([model, lx, lz, t, scale]) => {
          const px = cx + lx * Math.cos(turn) - lz * Math.sin(turn),
            pz = cz + lx * Math.sin(turn) + lz * Math.cos(turn);
          const h = ground.heightAt(px, pz);
          return h.inside ? [{ model, x: px, y: h.y, z: pz, turn: turn + t, scale }] : [];
        }),
      });
    }

    // Groups in the open: a grid of candidates, each taking the kind its
    // ground asks for — woodpiles and mushrooms near the woods, flowers and
    // patches in open meadow.
    for (let x = -blueprint.bounds.halfX; x <= blueprint.bounds.halfX; x += CELL)
      for (let z = -blueprint.bounds.halfZ; z <= blueprint.bounds.halfZ; z += CELL) {
        if (vignettes.length >= VIGNETTE_LIMIT) break;
        const key = `${blueprint.seed}/vignette/${Math.round(x * 10)}/${Math.round(z * 10)}`;
        if (hash(key) > 0.6) continue;
        const cx = x + (hash(`${key}/x`) - 0.5) * CELL * 0.7;
        const cz = z + (hash(`${key}/z`) - 0.5) * CELL * 0.7;
        const s = sampleIslandField(field, cx, cz);
        if (!s.inside || s.rock > 0.35 || s.shore > 0.93) continue;
        if (distanceToIslandRoute(blueprint, { x: cx, z: cz }) < clearance + 0.8) continue;
        const woods = occupied.filter((p) => Math.hypot(p.x - cx, p.z - cz) < 3).length;
        const pick = hash(`${key}/kind`);
        const kind: Exclude<Vignette["kind"], "fence"> =
          woods >= 3
            ? pick < 0.5
              ? "mushrooms"
              : "woodpile"
            : pick < 0.45
              ? "flowers"
              : pick < 0.75
                ? "patch"
                : "woodpile";
        place(kind, cx, cz, hash(`${key}/turn`) * Math.PI * 2, LAYOUTS[kind]);
      }
  } finally {
    ground.dispose();
  }
  return vignettes;
}
