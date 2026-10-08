#!/usr/bin/env node
/**
 * Development-only navigation receipt for the source SwimInAI renderer.
 *
 * This intentionally does not read the legacy GLB/nav export. It projects the
 * same blueprints, world terrain LOD, remote miniature props and pools that
 * RemoteIslandField consumes at runtime.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "../../packages/world/node_modules/three/build/three.module.js";
import {
  buildIslandGeometry,
  sampleIslandTerrainTop,
} from "../../packages/world/src/island/island-geometry.ts";
import {
  miniatureLayoutFor,
  miniatureMetrics,
} from "../../packages/world/src/island/miniature-layout.ts";
import { planRemoteIslandProps } from "../../packages/world/src/island/remote-props.ts";
import { CENTER, ISLANDS, buildRenderBlueprints } from "./blueprints.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = resolve(ROOT, "tools/swiminai-islands/render-dist/render-navigation.json");
const TARGET_RADIUS = 3.2;
const SCHEMA_VERSION = 1;
const GENERATOR = "swiminai-island-navigation-v1";
const PRODUCT_OFFSETS = {
  break: { x: -5.5, y: 0.35, z: -4.5 },
  uni: { x: 5.5, y: 0.45, z: -4.5 },
  dir: { x: -5.5, y: 0.65, z: 4.5 },
  party: { x: 5.5, y: 0.55, z: 4.5 },
};

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pointJson(point) {
  return { x: round(point.x), y: round(point.y), z: round(point.z) };
}

function normalize(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function bridgeToken(id) {
  if (id === "uni") return "university";
  if (id === "dir") return "directing";
  if (id === "party") return "swimmerparty";
  return id;
}

function bridgePoints(start, end, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return {
      x: round(THREE.MathUtils.lerp(start.x, end.x, t)),
      y: round(THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * 0.35),
      z: round(THREE.MathUtils.lerp(start.z, end.z, t)),
    };
  });
}

function renderShape(blueprint) {
  const shape = buildIslandGeometry(blueprint, "world", TARGET_RADIUS);
  const result = {
    scale: shape.scale,
    bounds: { ...shape.bounds },
    counts: { ...shape.counts },
  };
  shape.terrain.dispose();
  return result;
}

function terrainGround(blueprint, shape, position, localX, localZ, yLift = 0) {
  const sourceX = localX / shape.scale;
  const sourceZ = localZ / shape.scale;
  const sample = sampleIslandTerrainTop(blueprint, "world", sourceX, sourceZ);
  if (!sample.inside) throw new Error(`Navigation point is outside ${blueprint.courseId}`);
  return {
    x: position.x + localX,
    y: position.y + sample.y * shape.scale + yLift,
    z: position.z + localZ,
  };
}

function walkableOutline(blueprint, shape, position) {
  return blueprint.outline.map((point) => ({
    x: round(position.x + point.x * shape.scale),
    z: round(position.z + point.z * shape.scale),
  }));
}

function blockerForProp(islandId, prop, index) {
  const metrics = miniatureMetrics(prop.asset);
  return {
    id: `${islandId}-${prop.kind}-${String(index + 1).padStart(2, "0")}`,
    kind: prop.kind,
    asset: prop.asset,
    position: pointJson(prop.position),
    x: round(prop.position.x),
    z: round(prop.position.z),
    r: round(metrics.radius * prop.scale),
    supportRadius: round(metrics.supportRadius * prop.scale),
  };
}

function poolFor(blueprint, shape, position) {
  const pool = miniatureLayoutFor(blueprint).pool;
  if (!pool) return null;
  const radius = blueprint.bounds.maxHalf * shape.scale;
  const center = {
    x: position.x + pool.x * radius,
    y: position.y + pool.y * radius,
    z: position.z + pool.z * radius,
  };
  return {
    center: pointJson(center),
    radius: round(pool.radius * radius),
    bankRadius: round(pool.radius * radius * 1.12),
    cascade: pool.cascade,
  };
}

function navigationEntry(spec, blueprint, position, shape, isCenter) {
  const islandPosition = new THREE.Vector3(position.x, position.y, position.z);
  const props = planRemoteIslandProps({
    blueprint,
    islandPosition,
    islandRadius: blueprint.bounds.maxHalf,
    scale: shape.scale,
    islandId: spec.id,
  });
  const blockers = props.map((prop, index) => blockerForProp(spec.id, prop, index));
  const pool = poolFor(blueprint, shape, position);
  if (pool) {
    blockers.push({
      id: `${spec.id}-pool`,
      kind: "pool",
      x: pool.center.x,
      z: pool.center.z,
      r: pool.bankRadius,
    });
  }

  const hub = terrainGround(
    blueprint,
    shape,
    position,
    blueprint.hero.x * shape.scale,
    blueprint.hero.z * shape.scale,
    0.02,
  );
  if (isCenter) {
    blockers.push({
      id: "center-hub",
      kind: "hub",
      x: round(hub.x),
      z: round(hub.z),
      r: round(blueprint.hero.radius * shape.scale),
    });
  }

  const entry = {
    id: spec.id,
    displayName: spec.displayName,
    seed: spec.seed,
    recipeId: spec.recipeId,
    detail: "world",
    targetRadius: TARGET_RADIUS,
    scale: round(shape.scale),
    position: pointJson(position),
    bounds: {
      halfX: round(shape.bounds.halfX),
      halfZ: round(shape.bounds.halfZ),
      depth: round(shape.bounds.depth),
    },
    groundNode: isCenter ? "ground" : `ground_${spec.id}`,
    hub: pointJson(hub),
    walkableOutline: walkableOutline(blueprint, shape, position),
    blockers,
    pools: pool ? [pool] : [],
    propCount: props.length,
  };

  if (!isCenter) {
    const portalZ = shape.bounds.halfZ * 0.52;
    const frontZ = portalZ + 0.8;
    const bottom = terrainGround(blueprint, shape, position, 0, portalZ, 0.02);
    const frontGround = terrainGround(blueprint, shape, position, 0, frontZ);
    const surfaceCenter = { ...bottom, y: bottom.y + 1.15 };
    entry.portal = {
      local: { x: 0, z: round(portalZ) },
      surfaceBottom: pointJson(bottom),
      surfaceCenter: pointJson(surfaceCenter),
      position: pointJson(surfaceCenter),
      frontGround: pointJson(frontGround),
      frontPosition: pointJson(frontGround),
      names: {
        surface: `portal_${spec.id}_surface`,
        marker: `portal_${spec.id}`,
        front: `portal_${spec.id}_front`,
      },
    };
    entry.blockers.push({
      id: `${spec.id}-portal`,
      kind: "portal",
      x: round(bottom.x),
      z: round(bottom.z),
      r: round(0.9 * shape.scale),
    });
  }

  return entry;
}

function buildNavigation() {
  const source = buildRenderBlueprints();
  const centerShape = renderShape(source.center);
  const center = navigationEntry(CENTER, source.center, { x: 0, y: 0, z: 0 }, centerShape, true);
  const islands = ISLANDS.map((spec) => {
    const blueprint = source[spec.id];
    const shape = renderShape(blueprint);
    return {
      spec,
      blueprint,
      shape,
      entry: navigationEntry(spec, blueprint, PRODUCT_OFFSETS[spec.id], shape, false),
    };
  });
  const bridges = islands.map(({ spec, blueprint, shape, entry }) => {
    const direction = normalize(entry.position.x, entry.position.z);
    const centerLocal = {
      x: direction.x * centerShape.bounds.halfX * 0.68,
      z: direction.z * centerShape.bounds.halfZ * 0.68,
    };
    const productLocal = {
      x: -direction.x * shape.bounds.halfX * 0.68,
      z: -direction.z * shape.bounds.halfZ * 0.68,
    };
    const from = terrainGround(source.center, centerShape, center.position, centerLocal.x, centerLocal.z, 0.14);
    const to = terrainGround(blueprint, shape, entry.position, productLocal.x, productLocal.z, 0.14);
    return {
      id: spec.id,
      markerPrefix: `bridge_${bridgeToken(spec.id)}_`,
      from: pointJson(from),
      to: pointJson(to),
      points: bridgePoints(from, to),
    };
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR,
    detail: "world",
    targetRadius: TARGET_RADIUS,
    source: {
      blueprints: "tools/swiminai-islands/render-dist/render-blueprints.json",
      terrain: "packages/world/src/island/buildIslandGeometry + sampleIslandTerrainTop",
      dressing: "packages/world/src/island/planRemoteIslandProps",
      miniature: "packages/world/src/island/miniature-layout.ts + miniature-assets.ts",
    },
    center,
    islands: islands.map(({ entry }) => entry),
    bridges,
  };
}

const navigation = buildNavigation();
const contents = `${JSON.stringify(navigation, null, 2)}\n`;
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, contents, "utf8");
const hash = createHash("sha256").update(contents).digest("hex");
console.log(`Wrote ${OUTPUT} (${Buffer.byteLength(contents)} bytes, sha256=${hash})`);
