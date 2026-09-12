/**
 * A cached composition in island-radius units. The remote terrain's own
 * triangles supply every footprint; no course field, model load or second
 * height function. Transforming/choosing an island never rerolls its garden.
 */
import { pointInsideOutline, type IslandBlueprint } from "./island-blueprint.js";
import { islandTerrainFootprintRange, sampleIslandTerrainTop } from "./island-geometry.js";
import { createMiniatureAsset, type MiniatureAssetKind } from "./miniature-assets.js";
import { miniatureStyleFor } from "./miniature-style.js";
import { seeded } from "./random.js";

export interface MiniatureProp {
  readonly asset: MiniatureAssetKind;
  readonly role: "tree" | "landmark" | "accent";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly turn: number;
  readonly radius: number;
  readonly supportRadius: number;
  readonly groundRange: readonly [number, number];
}

export interface MiniaturePool {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly radius: number;
  readonly cascade: boolean;
}

export interface MiniatureLayout {
  readonly styleId: string;
  readonly props: readonly MiniatureProp[];
  readonly pool: MiniaturePool | null;
  readonly triangles: number;
}

export interface MiniatureAssetMetrics {
  readonly triangles: number;
  readonly radius: number;
  readonly supportRadius: number;
  readonly height: number;
}

// Bounded by the thirteen declared asset kinds; only numbers, never GPU buffers.
const assetMetrics = new Map<MiniatureAssetKind, MiniatureAssetMetrics>();
export function miniatureMetrics(kind: MiniatureAssetKind): MiniatureAssetMetrics {
  const cached = assetMetrics.get(kind);
  if (cached) return cached;
  const geometry = createMiniatureAsset(kind);
  try {
    const positions = geometry.getAttribute("position");
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    let radius = 0,
      supportRadius = 0;
    for (let i = 0; i < positions.count; i++) {
      const distance = Math.hypot(positions.getX(i), positions.getZ(i));
      radius = Math.max(radius, distance);
      if (positions.getY(i) <= box.min.y + 0.025) supportRadius = Math.max(supportRadius, distance);
    }
    const result = {
      triangles: (geometry.index?.count ?? positions.count) / 3,
      radius,
      supportRadius: Math.max(0.025, supportRadius),
      height: box.max.y - box.min.y,
    };
    assetMetrics.set(kind, result);
    return result;
  } finally {
    geometry.dispose();
  }
}

const cache = new WeakMap<IslandBlueprint, MiniatureLayout>();
const perimeter = (x: number, z: number, radius: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    return { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius };
  });

export function miniatureLayoutFor(blueprint: IslandBlueprint): MiniatureLayout {
  const previous = cache.get(blueprint);
  if (previous) return previous;
  const style = miniatureStyleFor(blueprint);
  const random = seeded(`${blueprint.seed}/miniature-composition-v1`);
  const m = blueprint.bounds.maxHalf;
  const props: MiniatureProp[] = [];
  let pool: MiniaturePool | null = null;

  const rangeAt = (x: number, z: number, radius: number) => {
    const points = perimeter(x * m, z * m, radius * m);
    if (points.some((p) => !pointInsideOutline(p, blueprint.outline))) return null;
    const range = islandTerrainFootprintRange(blueprint, points, "world");
    return range ? { min: range.minY / m, max: range.maxY / m } : null;
  };

  const place = (
    asset: MiniatureAssetKind,
    role: MiniatureProp["role"],
    x: number,
    z: number,
    size: number,
    turn: number,
  ): boolean => {
    const metrics = miniatureMetrics(asset);
    const radius = metrics.radius * size;
    const supportRadius = metrics.supportRadius * size;
    // A canopy must remain over land; physical feet need complete triangle
    // coverage and bounded relief. Rounded crowns are not giant flat feet.
    if (!rangeAt(x, z, radius)) return false;
    if (role === "tree" && Math.hypot(x, z) < 0.26 + radius) return false;
    // The stable +Z approach has an open foreground, rather than a tall tree
    // on the avatar → island → caption axis. This is a shared composition
    // rule, never a view-dependent re-roll or a per-course position table.
    if (role === "tree" && z > -0.08 && Math.abs(x) < 0.23 + supportRadius) return false;
    if (
      role === "landmark" &&
      size * metrics.height > 0.35 &&
      Math.hypot(x, z) < 0.26 + supportRadius
    )
      return false;
    if (pool && Math.hypot(x - pool.x, z - pool.z) < pool.radius + supportRadius + 0.025)
      return false;
    if (
      props.some(
        (p) =>
          Math.hypot(x - p.x, z - p.z) <
          (role === "accent" ? supportRadius + p.supportRadius + 0.015 : radius + p.radius * 0.8),
      )
    )
      return false;
    const ground = rangeAt(x, z, supportRadius);
    if (!ground || ground.max - ground.min > (role === "tree" ? 0.035 : 0.05)) return false;
    props.push({
      asset,
      role,
      x,
      z,
      y: ground.min - 0.004,
      size,
      turn,
      radius,
      supportRadius,
      groundRange: [ground.min, ground.max],
    });
    return true;
  };

  // Water is only offered where a naturally shallow shoulder actually fits.
  // A pool is not a floating disc on the highest point of a sloping footprint.
  if (style.water) {
    for (const radius of [0.28, 0.23, 0.19, 0.15]) {
      if (pool) break;
      for (let i = 0; i < 64; i++) {
        const angle = i * 2.399963229728653;
        const distance = 0.22 + (i % 5) * 0.065;
        const x = Math.cos(angle) * distance,
          z = Math.sin(angle) * distance;
        const ground = rangeAt(x, z, radius * 1.12);
        if (ground && ground.max - ground.min < 0.045) {
          pool = { x, z, y: ground.max + 0.006, radius, cascade: style.water === "cascade" };
          break;
        }
      }
    }
  }

  // The focal assembly stands off-centre, leaving the learner's cloud clear.
  // Bounded local search, then omit: never force a half-supported building.
  // A themed miniature must still read as a windmill/gate/crystal at the
  // ordinary catalogue distance. Preserve the accepted fence/clearing scale;
  // give vertical landmarks a stronger hierarchy, using the unchanged
  // whole-footprint search and its smaller fallbacks when the larger body fails.
  const focalSize =
    style.focal === "fence"
      ? 0.45
      : style.focal === "crystal"
        ? 1.16
        : style.focal === "snowpeak"
          ? 1.15
          : 1.02;
  const preferred = { x: blueprint.hero.x / m, z: blueprint.hero.z / m };
  let focal = false;
  const originalSize = style.focal === "fence" ? 0.45 : style.focal === "snowpeak" ? 1.05 : 0.86;
  const focalSizes = [
    ...new Set(
      [focalSize, originalSize].flatMap((size) =>
        [1, 0.86, 0.74, 0.62, 0.55].map((shrink) => size * shrink),
      ),
    ),
  ].sort((a, b) => b - a);
  for (const size of focalSizes) {
    if (focal) break;
    for (let i = 0; i < 48; i++) {
      const angle = i * 2.399963229728653;
      const x =
        i === 0
          ? style.focal === "fence"
            ? -0.34
            : preferred.x * 0.7
          : Math.cos(angle) * (0.32 + (i % 6) * 0.075);
      const z =
        i === 0
          ? style.focal === "fence"
            ? 0.28
            : preferred.z * 0.7
          : Math.sin(angle) * (0.32 + (i % 6) * 0.075);
      if (place(style.focal, "landmark", x, z, size, 0.4)) {
        focal = true;
        break;
      }
    }
  }

  const treeCount =
    blueprint.lessonCount <= 5
      ? 2
      : style.id === "garden"
        ? 2
        : style.id === "blossom"
          ? 3
          : blueprint.lessonCount <= 12
            ? 3
            : 5;
  const groveTurn = random() * Math.PI * 2;
  for (let tree = 0; tree < treeCount; tree++) {
    const size = (tree % 3 === 0 ? 0.57 : 0.47) + random() * 0.07;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = groveTurn + tree * 1.8 + attempt * 2.399963229728653;
      const radius = 0.36 + (attempt % 5) * 0.065;
      if (
        place(
          style.tree,
          "tree",
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          size,
          random() * 6.28,
        )
      )
        break;
    }
  }

  // Small clustered companions connect tree/landmark groups; no uniform lawn
  // noise field, no per-course art table and no near-view grass generator.
  // Freeze the structural anchors before adding accents. A growing `props`
  // list made each successive flower chase another flower, producing a thin
  // random chain through the forecourt rather than a coherent garden edge.
  const structuralAnchors = props.filter((prop) => prop.role !== "accent");
  const accents: readonly (readonly [MiniatureAssetKind, number, number])[] = [
    ["stone", 3, 0.34],
    ["grass", 6, 0.32],
    ...(style.flowers ? [["flowers", 6, style.id === "garden" ? 0.52 : 0.46] as const] : []),
  ];
  for (const [asset, count, nominal] of accents) {
    for (let index = 0; index < count; index++) {
      const size =
        nominal *
        (asset === "stone" ? (index === 0 ? 1.7 : 0.72) + random() * 0.16 : 0.75 + random() * 0.5);
      for (let attempt = 0; attempt < 15; attempt++) {
        let angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * 0.8;
        let x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius;
        if (attempt < 9 && structuralAnchors.length) {
          const anchor =
            asset === "flowers" && index < 3
              ? structuralAnchors[0]!
              : structuralAnchors[index % structuralAnchors.length]!;
          // Give the low foreground its own drift. Tree companions face the
          // clearing, rather than disappearing behind the canopy silhouette.
          if (asset === "flowers")
            angle =
              (anchor.role === "tree" ? Math.atan2(-anchor.z, -anchor.x) : Math.PI / 2) +
              (random() - 0.5) * 2.4;
          const offset =
            (anchor.role === "tree" ? anchor.radius * 0.85 : anchor.supportRadius) +
            size * (0.48 + (index % 2) * 0.16) +
            0.045;
          x = anchor.x + Math.cos(angle) * offset;
          z = anchor.z + Math.sin(angle) * offset;
        }
        const ground = sampleIslandTerrainTop(blueprint, "world", x * m, z * m);
        if (!ground.inside || ground.radial > 0.9) continue;
        if (place(asset, "accent", x, z, size, random() * 6.28)) break;
      }
    }
  }
  const result: MiniatureLayout = {
    styleId: style.id,
    props,
    pool,
    triangles: props.reduce((sum, p) => sum + miniatureMetrics(p.asset).triangles, 0),
  };
  cache.set(blueprint, result);
  return result;
}
