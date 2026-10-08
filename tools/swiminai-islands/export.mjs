#!/usr/bin/env node
/**
 * Offline SwimInAI island export.
 *
 * This is deliberately a development-time bridge. It imports the University's
 * serialisable island blueprint and Three.js geometry adapter, then writes
 * portable GLBs and plain JSON for SwimInAI-Website. No runtime package or
 * network access is required by the generated website assets.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "../../packages/world/node_modules/three/build/three.module.js";
import { GLTFExporter } from "../../packages/world/node_modules/three/examples/jsm/exporters/GLTFExporter.js";
import { mergeBufferGeometries } from "../../packages/world/node_modules/three-stdlib/utils/BufferGeometryUtils.js";
import { buildIslandGeometry } from "../../packages/world/src/island/island-geometry.ts";
import {
  miniatureLayoutFor,
  miniatureMetrics,
} from "../../packages/world/src/island/miniature-layout.ts";
import { createMiniatureAsset } from "../../packages/world/src/island/miniature-assets.ts";
import { planRemoteIslandProps } from "../../packages/world/src/island/remote-props.ts";
import {
  islandBlueprint,
  sampleIslandSurface,
} from "../../packages/world/src/island/island-blueprint.ts";
import { recipeById } from "../../packages/world/src/island/kenney-recipes.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_DIR = resolve(ROOT, "tools/swiminai-islands/generated");
const SCHEMA_VERSION = 1;
const GENERATOR_VERSION = "swiminai-islands-v2";
const WORLD_DETAIL_RADIUS = 3.2;
const CENTER_DETAIL_RADIUS = 3.2;
const LESSON_COUNT = 12;

// GLTFExporter uses FileReader to turn a Blob into a GLB. Node 24 has Blob but
// intentionally has no DOM FileReader, so provide the smallest async adapter.
if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const ISLANDS = [
  {
    id: "break",
    displayName: "BREAK",
    seed: "swiminai/plan-0002/break-v1",
    recipeId: "R06-forest-fortress",
    routeArchetype: "switchback",
    portalColor: 0xff8a45,
    groundTint: 0xc88d61,
    themeAssets: ["gate", "fence", "stone"],
  },
  {
    id: "uni",
    displayName: "University",
    seed: "swiminai/plan-0002/university-v1",
    recipeId: "R01-forest-academy",
    routeArchetype: "horseshoe",
    portalColor: 0x5fe0c8,
    groundTint: 0xc7dca1,
    themeAssets: ["gate", "flowers", "fence"],
  },
  {
    id: "dir",
    displayName: "Directing",
    seed: "swiminai/plan-0002/directing-v1",
    recipeId: "R07-training-arena",
    routeArchetype: "serpentine",
    portalColor: 0xffc266,
    groundTint: 0xc09ad9,
    themeAssets: ["gate", "windmill", "fence"],
  },
  {
    id: "party",
    displayName: "SWIMMER PARTY",
    seed: "swiminai/plan-0002/swimmer-party-v1",
    recipeId: "R12-garden-sports",
    routeArchetype: "arc",
    portalColor: 0xff66c8,
    groundTint: 0xe9b5cf,
    themeAssets: ["blossom", "flowers", "crystal"],
  },
];

const CENTER = {
  id: "center",
  displayName: "Swim In AI",
  seed: "swiminai/plan-0002/center-v1",
  recipeId: "R01-forest-academy",
  routeArchetype: "loop-around-hill",
  portalColor: 0x5fe0c8,
  groundTint: 0xd2dfad,
};

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

function vectorJson(vector) {
  return pointJson(vector);
}

function normalize(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function recipeSelection(recipeId) {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown island recipe: ${recipeId}`);
  return {
    naturalBasePackId: recipe.base.packId,
    accentPackIds: [...recipe.accentPackIds],
    recipeId: recipe.id,
  };
}

function buildBlueprint(spec) {
  const lessonIds = Array.from(
    { length: LESSON_COUNT },
    (_, index) => `${spec.id}-lesson-${String(index + 1).padStart(2, "0")}`,
  );
  return islandBlueprint({
    studyId: "swiminai",
    courseId: `plan-0002-${spec.id}`,
    lessonCount: LESSON_COUNT,
    lessonIds,
    seed: spec.seed,
    routeArchetype: spec.routeArchetype,
    themeSelection: recipeSelection(spec.recipeId),
    checkpointGaps: [3, 7],
  });
}

function scaledSurfacePoint(blueprint, shape, x, z, yOffset = 0) {
  const surface = sampleIslandSurface(blueprint, x, z);
  return new THREE.Vector3(x * shape.scale, (surface.y + yOffset) * shape.scale, z * shape.scale);
}

function marker(name, position, userData = {}) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.copy(position);
  node.userData = { marker: true, ...userData };
  return node;
}

function createPortalSurface(name, position, radius, color, height = radius * 1.65) {
  // PlaneGeometry is deliberately vertical: its local +Z normal faces the
  // camera-facing +Z direction used by SwimInAI. The old cylinder was created
  // at the origin and was horizontal, so every portal was visually misplaced.
  const geometry = new THREE.PlaneGeometry(radius * 1.55, height, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.32,
    roughness: 0.28,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.userData = { semantic: "portal-surface", marker: true };
  return mesh;
}

function portalFrameGeometry(center, radius, height) {
  const parts = [];
  const post = (x) => {
    const geometry = new THREE.BoxGeometry(radius * 0.16, height, radius * 0.16);
    geometry.translate(center.x + x, center.y, center.z - 0.06);
    parts.push(geometry);
  };
  post(-radius * 0.7);
  post(radius * 0.7);
  const top = new THREE.BoxGeometry(radius * 1.55, radius * 0.16, radius * 0.16);
  top.translate(center.x, center.y + height * 0.5, center.z - 0.06);
  parts.push(top);
  const merged = mergeBufferGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("Portal frame parts must merge");
  return merged;
}

function portalNames(id) {
  if (id === "uni") {
    return {
      surface: "portal_uni_surface",
      marker: "portal_uni",
      front: "portal_uni_front",
      aliases: ["portal_university", "portal_university_front"],
    };
  }
  if (id === "party") {
    return {
      surface: "portal_swimmerparty_surface",
      marker: "portal_swimmerparty",
      front: "portal_swimmerparty_front",
      aliases: ["portal_party", "portal_party_front"],
    };
  }
  return {
    surface: `portal_${id}_surface`,
    marker: `portal_${id}`,
    front: `portal_${id}_front`,
    aliases: [],
  };
}

function bridgeToken(id) {
  if (id === "uni") return "university";
  if (id === "dir") return "directing";
  if (id === "party") return "swimmerparty";
  return id;
}

function addPortal(root, blueprint, shape, spec, localPosition, localFront) {
  const names = portalNames(spec.id);
  const scale = shape.scale;
  const ground = scaledSurfacePoint(blueprint, shape, localPosition.x, localPosition.z, 0.02);
  const height = 1.55 * scale;
  const position = ground.clone().add(new THREE.Vector3(0, height * 0.5, 0));
  const frontGround = scaledSurfacePoint(blueprint, shape, localFront.x, localFront.z, 0.02);
  const front = frontGround.clone().add(new THREE.Vector3(0, 0.3 * scale, 0));
  const surface = createPortalSurface(
    names.surface,
    position,
    1.12 * scale,
    spec.portalColor,
    height,
  );
  root.add(surface);
  const frame = new THREE.Mesh(
    portalFrameGeometry(position, 1.12 * scale, height),
    new THREE.MeshStandardMaterial({
      color: spec.portalColor,
      emissive: spec.portalColor,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.1,
    }),
  );
  frame.name = `portal_${spec.id}_frame`;
  frame.userData = { semantic: "portal-frame", portalId: spec.id };
  root.add(frame);
  root.add(marker(names.marker, position, { kind: "portal", portalId: spec.id }));
  root.add(marker(names.front, front, { kind: "portal-front", portalId: spec.id }));
  for (const alias of names.aliases) {
    if (alias.endsWith("_surface")) {
      const aliasSurface = createPortalSurface(alias, position, 1.08 * scale, spec.portalColor);
      aliasSurface.visible = false;
      root.add(aliasSurface);
    } else {
      root.add(marker(alias, position, { kind: "portal-alias", portalId: spec.id }));
    }
  }
  return {
    marker: names.marker,
    front: names.front,
    surface: names.surface,
    position,
    bottom: ground,
    frontPosition: front,
    frame,
  };
}

function addSunAndCommonMarkers(root, blueprint, shape, includeSpawn = true) {
  const first = blueprint.nodes[0] ?? blueprint.geometryNodes[0];
  const last = blueprint.nodes[blueprint.nodes.length - 1] ?? blueprint.geometryNodes.at(-1);
  if (!first || !last) throw new Error("Island blueprint has no route nodes");
  const before = blueprint.centerline[Math.max(0, blueprint.centerline.length - 3)] ?? last;
  const after = blueprint.centerline.at(-1) ?? last;
  const tangent = normalize(after.x - before.x, after.z - before.z);
  const spawnPoint = {
    x: first.x - tangent.x * 0.9,
    z: first.z - tangent.z * 0.9,
  };
  const portalPoint = {
    x: last.x + tangent.x * 1.3,
    z: last.z + tangent.z * 1.3,
  };
  const frontPoint = {
    x: last.x - tangent.x * 1.35,
    z: last.z - tangent.z * 1.35,
  };
  const spawn = scaledSurfacePoint(blueprint, shape, spawnPoint.x, spawnPoint.z, 0.3);
  const hub = scaledSurfacePoint(blueprint, shape, blueprint.hero.x, blueprint.hero.z, 0.35);
  if (includeSpawn) root.add(marker("spawn", spawn, { kind: "spawn" }));
  root.add(marker("hub", hub, { kind: "hub" }));
  root.add(
    marker("sign_anchor", hub.clone().add(new THREE.Vector3(0, 0.3 * shape.scale, 0)), {
      kind: "sign",
    }),
  );
  root.add(marker("sun_dir", new THREE.Vector3(0.42, 0.84, -0.34), { kind: "direction" }));
  return {
    spawn,
    hub,
    portalPoint,
    frontPoint,
    portalPosition: scaledSurfacePoint(blueprint, shape, portalPoint.x, portalPoint.z, 0.22),
    frontPosition: scaledSurfacePoint(blueprint, shape, frontPoint.x, frontPoint.z, 0.22),
  };
}

function createTerrainRoot(blueprint, spec, detail, targetRadius, terrainName) {
  const shape = buildIslandGeometry(blueprint, detail, targetRadius);
  const root = new THREE.Group();
  root.name = `${spec.id}_island`;
  root.userData = {
    source: "@pieai/university-world",
    generator: "islandBlueprint + buildIslandGeometry",
    detail,
    seed: spec.seed,
    recipeId: spec.recipeId,
  };
  const material = new THREE.MeshStandardMaterial({
    color: spec.groundTint,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrain = new THREE.Mesh(shape.terrain, material);
  terrain.name = terrainName;
  terrain.userData = {
    semantic: "ground",
    source: "buildIslandGeometry",
    counts: shape.counts,
  };
  root.add(terrain);
  return { root, shape };
}

function applyPropTransform(geometry, position, scale, rotationY) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    position,
    new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotationY),
    new THREE.Vector3(scale, scale, scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function themeAssetPlacements(blueprint, shape, spec, offset = new THREE.Vector3()) {
  if (!spec.themeAssets) return [];
  const points = [
    [-0.42, -0.2],
    [0.38, -0.18],
    [0.08, 0.32],
  ];
  return spec.themeAssets.map((asset, index) => {
    const [nx, nz] = points[index % points.length];
    const x = nx * blueprint.bounds.maxHalf;
    const z = nz * blueprint.bounds.maxHalf;
    const ground = sampleIslandSurface(blueprint, x, z);
    return {
      asset,
      position: new THREE.Vector3(
        offset.x + x * shape.scale,
        offset.y + ground.y * shape.scale,
        offset.z + z * shape.scale,
      ),
      scale: (asset === "windmill" ? 0.68 : 0.48) * shape.scale,
      rotationY: index * 1.1,
      kind: "theme",
    };
  });
}

function createDecorations(blueprint, shape, spec, offset = new THREE.Vector3()) {
  const props = planRemoteIslandProps({
    blueprint,
    islandPosition: offset,
    islandRadius: blueprint.bounds.maxHalf,
    scale: shape.scale,
    islandId: spec.id,
  });
  const placements = [
    ...props
      .filter((prop) => prop.kind !== "accent")
      .map((prop) => ({
        asset: prop.asset,
        position: prop.position,
        scale: prop.scale,
        rotationY: prop.rotationY,
        kind: prop.kind,
      })),
    ...themeAssetPlacements(blueprint, shape, spec, offset),
  ];
  const parts = [];
  const blockers = [];
  const assets = [];
  for (const [index, placement] of placements.entries()) {
    const geometry = applyPropTransform(
      createMiniatureAsset(placement.asset),
      placement.position,
      placement.scale,
      placement.rotationY,
    );
    parts.push(geometry);
    const metrics = miniatureMetrics(placement.asset);
    const id = `${spec.id}-${placement.kind}-${String(index + 1).padStart(2, "0")}`;
    blockers.push({
      id,
      kind: placement.kind,
      x: round(placement.position.x),
      z: round(placement.position.z),
      r: round(metrics.radius * placement.scale),
    });
    assets.push({
      id,
      asset: placement.asset,
      kind: placement.kind,
      position: pointJson(placement.position),
      scale: round(placement.scale),
      triangles: metrics.triangles,
      source: "packages/world/src/island/miniature-assets.ts",
    });
  }
  const geometry = parts.length ? mergeBufferGeometries(parts) : new THREE.BufferGeometry();
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`${spec.id}: miniature decoration merge failed`);
  return {
    geometry,
    blockers,
    assets,
    triangles: assets.reduce((total, asset) => total + asset.triangles, 0),
    styleId: miniatureLayoutFor(blueprint).styleId,
  };
}

function addDecorationMesh(root, decorations) {
  if (!decorations.geometry.index || decorations.geometry.index.count === 0) return null;
  const mesh = new THREE.Mesh(
    decorations.geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }),
  );
  mesh.name = "remote_props";
  mesh.userData = {
    semantic: "dressing",
    styleId: decorations.styleId,
    triangles: decorations.triangles,
  };
  root.add(mesh);
  return mesh;
}

function sourceAssetCredits(spec, decorations) {
  return {
    recipeId: spec.recipeId,
    recipeSource: "packages/world/src/island/kenney-recipes.ts",
    dressingSource: "packages/world/src/island/miniature-layout.ts + remote-props.ts",
    miniatureSource: "packages/world/src/island/miniature-assets.ts",
    donor: "Kenney CC0 (existing checked-in miniature/rock-shape selections)",
    styleId: decorations.styleId,
    assetIds: [...new Set(decorations.assets.map((asset) => asset.asset))],
  };
}

function buildStandaloneIsland(spec) {
  const blueprint = buildBlueprint(spec);
  const { root, shape } = createTerrainRoot(blueprint, spec, "course", undefined, "ground");
  const common = addSunAndCommonMarkers(root, blueprint, shape);
  const decorations = createDecorations(blueprint, shape, spec);
  addDecorationMesh(root, decorations);
  const portalLocal = { x: 0, z: blueprint.bounds.halfZ * 0.78 };
  const frontLocal = { x: 0, z: blueprint.bounds.halfZ * 0.98 };
  const portal = addPortal(root, blueprint, shape, spec, portalLocal, frontLocal);
  const bridgeStart = scaledSurfacePoint(blueprint, shape, 0, -blueprint.bounds.halfZ * 0.5, 0.14);
  const bridge = addBridge(
    root,
    bridgeToken(spec.id),
    bridgeStart,
    portal.frontPosition,
    spec.portalColor,
  );
  root.updateMatrixWorld(true);
  const nav = {
    ...makeNavJson(spec, blueprint, shape, common, portal, [], decorations.blockers),
    bridges: {
      [bridgeToken(spec.id)]: bridge.map(vectorJson),
    },
    dressing: decorations.assets,
    sourceAssetCredits: sourceAssetCredits(spec, decorations),
  };
  return { root, blueprint, shape, nav };
}

function makeNavJson(spec, blueprint, shape, common, portal, lessonNodes, decorationBlockers) {
  const outline = blueprint.outline.map((point) => ({
    x: round(point.x * shape.scale),
    z: round(point.z * shape.scale),
  }));
  const centerline = blueprint.centerline.map((point) =>
    pointJson({
      x: point.x * shape.scale,
      y: point.y * shape.scale,
      z: point.z * shape.scale,
    }),
  );
  const blockers = [...decorationBlockers];
  blockers.push({
    id: "hub",
    kind: "hub",
    x: common.hub.x,
    z: common.hub.z,
    r: round(blueprint.hero.radius * shape.scale),
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR_VERSION,
    islandId: spec.id,
    displayName: spec.displayName,
    seed: spec.seed,
    theme: {
      recipeId: spec.recipeId,
      selection: recipeSelection(spec.recipeId),
    },
    detail: "course",
    scale: round(shape.scale),
    bounds: {
      halfX: round(shape.bounds.halfX),
      halfZ: round(shape.bounds.halfZ),
      depth: round(shape.bounds.depth),
    },
    markers: {
      spawn: vectorJson(common.spawn),
      hub: vectorJson(common.hub),
      portal: vectorJson(portal.position),
      surfaceBottom: vectorJson(portal.bottom),
      surfaceCenter: vectorJson(portal.position),
      front: vectorJson(portal.frontPosition),
      names: {
        surface: portal.surface,
        portal: portal.marker,
        front: portal.front,
      },
    },
    route: {
      semantic: blueprint.route.semantic,
      archetype: blueprint.route.archetype,
      roadWidth: round(blueprint.route.roadWidth * shape.scale),
      shoulderWidth: round(blueprint.route.shoulderWidth * shape.scale),
      nodeRadius: round(blueprint.route.nodeRadius * shape.scale),
      centerline,
    },
    walkableOutline: outline,
    lessonNodes,
    blockers,
    obstacleSource: "baked miniature dressing envelopes and the hub; no synthetic lesson blockers",
  };
}

function bridgePoints(start, end, count = 7) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push(
      new THREE.Vector3(
        THREE.MathUtils.lerp(start.x, end.x, t),
        THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * 0.35,
        THREE.MathUtils.lerp(start.z, end.z, t),
      ),
    );
  }
  return points;
}

function addBridge(root, id, start, end, color) {
  const points = bridgePoints(start, end);
  points.forEach((point, index) => {
    root.add(
      marker(`bridge_${id}_${String(index).padStart(2, "0")}`, point, {
        kind: "bridge",
        bridgeId: id,
        index,
      }),
    );
  });
  const parts = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    const geometry = new THREE.BoxGeometry(length, 0.18, 0.72);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      direction.normalize(),
    );
    geometry.applyMatrix4(
      new THREE.Matrix4().compose(
        from.clone().lerp(to, 0.5),
        quaternion,
        new THREE.Vector3(1, 1, 1),
      ),
    );
    parts.push(geometry);
  }
  const geometry = mergeBufferGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`Bridge ${id} geometry must merge`);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.08 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `bridge_${id}`;
  mesh.userData = { semantic: "bridge", bridgeId: id };
  root.add(mesh);
  return points;
}

function sceneStats(root) {
  let meshes = 0;
  let triangles = 0;
  const categories = {};
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const count =
      (object.geometry.index?.count ?? object.geometry.getAttribute("position")?.count ?? 0) / 3;
    triangles += count;
    const category =
      object.userData.semantic ?? (object.name.startsWith("ground") ? "terrain" : "other");
    categories[category] = (categories[category] ?? 0) + count;
  });
  return {
    staticDraws: meshes,
    triangles,
    trianglesRounded: Math.round(triangles),
    byCategory: Object.fromEntries(
      Object.entries(categories).map(([key, value]) => [key, Math.round(value)]),
    ),
  };
}

function buildMergedWorld() {
  const centerBlueprint = buildBlueprint(CENTER);
  const center = createTerrainRoot(
    centerBlueprint,
    CENTER,
    "world",
    CENTER_DETAIL_RADIUS,
    "ground",
  );
  const world = new THREE.Group();
  world.name = "swiminai_world";
  world.userData = {
    source: "@pieai/university-world",
    generator: "islandBlueprint + buildIslandGeometry",
    schemaVersion: SCHEMA_VERSION,
  };
  world.add(center.root);
  const centerCommon = addSunAndCommonMarkers(center.root, centerBlueprint, center.shape);
  const centerDecorations = createDecorations(centerBlueprint, center.shape, CENTER);
  const decorationParts = [centerDecorations.geometry];
  const allBlockers = [...centerDecorations.blockers];
  const islandEntries = [];
  const bridges = [];

  for (const spec of ISLANDS) {
    const blueprint = buildBlueprint(spec);
    const product = createTerrainRoot(
      blueprint,
      spec,
      "world",
      WORLD_DETAIL_RADIUS,
      `ground_${spec.id}`,
    );
    const offset = PRODUCT_OFFSETS[spec.id];
    const offsetVector = new THREE.Vector3(offset.x, offset.y, offset.z);
    product.root.position.copy(offsetVector);
    const common = addSunAndCommonMarkers(product.root, blueprint, product.shape, false);
    const decorations = createDecorations(blueprint, product.shape, spec, offsetVector);
    decorationParts.push(decorations.geometry);
    allBlockers.push(...decorations.blockers);

    // Product islands own the canonical portals. The center island only owns
    // the spawn/hub anchors, so a click always lands on the island it names.
    const portalLocal = { x: 0, z: blueprint.bounds.halfZ * 0.78 };
    const frontLocal = { x: 0, z: blueprint.bounds.halfZ * 0.98 };
    const portal = addPortal(product.root, blueprint, product.shape, spec, portalLocal, frontLocal);
    const portalWorld = portal.position.clone().add(offsetVector);
    const bottomWorld = portal.bottom.clone().add(offsetVector);
    const frontWorld = portal.frontPosition.clone().add(offsetVector);
    const localHub = product.root.getObjectByName("hub");
    if (localHub) localHub.name = `hub_${spec.id}`;
    const localSign = product.root.getObjectByName("sign_anchor");
    if (localSign) localSign.name = `sign_anchor_${spec.id}`;
    const localSun = product.root.getObjectByName("sun_dir");
    if (localSun) localSun.name = `sun_dir_${spec.id}`;
    world.add(product.root);

    const direction = normalize(offset.x, offset.z);
    const centerPoint = scaledSurfacePoint(
      centerBlueprint,
      center.shape,
      direction.x * centerBlueprint.bounds.halfX * 0.68,
      direction.z * centerBlueprint.bounds.halfZ * 0.68,
      0.14,
    );
    const productPoint = scaledSurfacePoint(
      blueprint,
      product.shape,
      -direction.x * blueprint.bounds.halfX * 0.68,
      -direction.z * blueprint.bounds.halfZ * 0.68,
      0.14,
    ).add(offsetVector);
    const bridgeId = bridgeToken(spec.id);
    const points = addBridge(world, bridgeId, centerPoint, productPoint, spec.portalColor);
    const bridge = {
      id: spec.id,
      markerPrefix: `bridge_${bridgeId}_`,
      points: points.map(vectorJson),
      from: pointJson(centerPoint),
      to: pointJson(productPoint),
    };
    bridges.push(bridge);

    const outline = blueprint.outline.map((point) => ({
      x: round(point.x * product.shape.scale + offset.x),
      z: round(point.z * product.shape.scale + offset.z),
    }));
    const blockers = decorations.blockers.map((blocker) => ({ ...blocker }));
    const portalBlocker = {
      id: `${spec.id}-portal`,
      kind: "portal",
      x: round(portalWorld.x),
      z: round(portalWorld.z),
      r: round(0.9 * product.shape.scale),
    };
    blockers.push(portalBlocker);
    allBlockers.push(portalBlocker);
    islandEntries.push({
      id: spec.id,
      displayName: spec.displayName,
      seed: spec.seed,
      recipeId: spec.recipeId,
      offset,
      detail: "world",
      scale: round(product.shape.scale),
      bounds: {
        halfX: round(product.shape.bounds.halfX),
        halfZ: round(product.shape.bounds.halfZ),
        depth: round(product.shape.bounds.depth),
      },
      groundNode: `ground_${spec.id}`,
      portal: {
        surface: portal.surface,
        marker: portal.marker,
        front: portal.front,
        position: pointJson(portalWorld),
        surfaceCenter: pointJson(portalWorld),
        surfaceBottom: pointJson(bottomWorld),
        frontPosition: pointJson(frontWorld),
        facing: "+z",
      },
      localMarkers: { hub: pointJson(common.hub.clone().add(offsetVector)) },
      walkableOutline: outline,
      blockers,
      dressing: decorations.assets,
      sourceAssetCredits: sourceAssetCredits(spec, decorations),
    });
  }

  const mergedProps = mergeBufferGeometries(decorationParts);
  decorationParts.forEach((part) => part.dispose());
  if (!mergedProps) throw new Error("Merged remote props must share attributes");
  const propsMesh = new THREE.Mesh(
    mergedProps,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }),
  );
  propsMesh.name = "remote_props";
  propsMesh.userData = {
    semantic: "dressing",
    islands: [CENTER.id, ...ISLANDS.map((spec) => spec.id)],
  };
  world.add(propsMesh);

  allBlockers.push({
    id: "center-hub",
    kind: "hub",
    x: round(centerCommon.hub.x),
    z: round(centerCommon.hub.z),
    r: round(CENTER_DETAIL_RADIUS * 0.28),
  });
  const mergedMarkers = {
    spawn: pointJson(centerCommon.spawn),
    hub: pointJson(centerCommon.hub),
    portals: Object.fromEntries(islandEntries.map((entry) => [entry.id, entry.portal.position])),
    fronts: Object.fromEntries(
      islandEntries.map((entry) => [entry.id, entry.portal.frontPosition]),
    ),
    bridges: Object.fromEntries(bridges.map((bridge) => [bridge.id, bridge.points])),
    sign: pointJson(
      centerCommon.hub.clone().add(new THREE.Vector3(0, 0.3 * center.shape.scale, 0)),
    ),
    sunDir: vectorJson(new THREE.Vector3(0.42, 0.84, -0.34)),
    nodeNames: {
      ground: "ground",
      surfaces: Object.fromEntries(islandEntries.map((entry) => [entry.id, entry.portal.surface])),
      portals: Object.fromEntries(islandEntries.map((entry) => [entry.id, entry.portal.marker])),
      fronts: Object.fromEntries(islandEntries.map((entry) => [entry.id, entry.portal.front])),
      bridges: Object.fromEntries(bridges.map((bridge) => [bridge.id, bridge.markerPrefix])),
      sign: "sign_anchor",
      sun: "sun_dir",
    },
  };
  const mergedNav = {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR_VERSION,
    worldId: "swiminai-world",
    center: {
      seed: CENTER.seed,
      recipeId: CENTER.recipeId,
      scale: round(center.shape.scale),
      groundNode: "ground",
      spawn: pointJson(centerCommon.spawn),
      hub: pointJson(centerCommon.hub),
      walkableOutline: centerBlueprint.outline.map((point) => ({
        x: round(point.x * center.shape.scale),
        z: round(point.z * center.shape.scale),
      })),
      sourceAssetCredits: sourceAssetCredits(CENTER, centerDecorations),
    },
    islands: islandEntries,
    bridges,
    blockers: allBlockers,
    sourceAssetCredits: Object.fromEntries(
      islandEntries.map((entry) => [entry.id, entry.sourceAssetCredits]),
    ),
    obstacleSource:
      "baked miniature dressing envelopes and the center hub; no synthetic lesson blockers",
    stats: sceneStats(world),
  };
  world.updateMatrixWorld(true);
  return { root: world, markers: mergedMarkers, nav: mergedNav };
}
async function exportGlb(root, outputPath) {
  const exporter = new GLTFExporter();
  const data = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: false,
    trs: false,
  });
  const bytes = Buffer.from(data);
  await writeFile(outputPath, bytes);
  return bytes;
}

function glbNodeNames(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Exporter did not write a GLB");
  const names = new Set();
  const duplicates = new Set();
  let offset = 12;
  while (offset < bytes.byteLength) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      const json = JSON.parse(bytes.toString("utf8", offset + 8, offset + 8 + length).trim());
      for (const node of json.nodes ?? []) {
        if (typeof node.name !== "string") continue;
        if (names.has(node.name)) duplicates.add(node.name);
        names.add(node.name);
      }
    }
    offset += 8 + length;
  }
  return { names, duplicates };
}

function assertGlbContract(bytes, requiredNames, requiredPrefixes, label) {
  const { names, duplicates } = glbNodeNames(bytes);
  const canonicalDuplicates = [...duplicates].filter(
    (name) => name.startsWith("portal_") || name.startsWith("bridge_"),
  );
  if (canonicalDuplicates.length > 0) {
    throw new Error(`${label} has duplicate canonical nodes: ${canonicalDuplicates.join(", ")}`);
  }
  for (const name of requiredNames) {
    if (!names.has(name)) throw new Error(`${label} is missing GLB node ${name}`);
  }
  for (const prefix of requiredPrefixes) {
    if (![...names].some((name) => name.startsWith(prefix))) {
      throw new Error(`${label} is missing GLB node prefix ${prefix}`);
    }
  }
}

async function writeJson(outputPath, value) {
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function generatedAtFor(outputDir, existingRecord) {
  if (process.env.SOURCE_DATE_EPOCH) {
    return new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString();
  }
  if (existingRecord?.generatedAt) return existingRecord.generatedAt;
  return new Date().toISOString();
}

function sourceCommitFor(existingRecord) {
  return process.env.UNIVERSITY_COMMIT ?? existingRecord?.universityCommit ?? "working-tree";
}

async function readExistingRecord(outputDir) {
  try {
    return JSON.parse(await readFile(join(outputDir, "export-record.json"), "utf8"));
  } catch {
    return null;
  }
}

async function generate(outputDir, existingRecord = null) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (const spec of ISLANDS) {
    const standalone = buildStandaloneIsland(spec);
    const glbPath = join(outputDir, `${spec.id}.glb`);
    const markersPath = join(outputDir, `${spec.id}.markers.json`);
    const navPath = join(outputDir, `${spec.id}.nav.json`);
    const statsPath = join(outputDir, `${spec.id}.stats.json`);
    const standaloneGlb = await exportGlb(standalone.root, glbPath);
    const standaloneNames = portalNames(spec.id);
    assertGlbContract(
      standaloneGlb,
      [
        "ground",
        "spawn",
        "hub",
        standaloneNames.surface,
        standaloneNames.marker,
        standaloneNames.front,
      ],
      [`bridge_${bridgeToken(spec.id)}_`],
      `${spec.id}.glb`,
    );
    await writeJson(markersPath, {
      schemaVersion: SCHEMA_VERSION,
      generator: GENERATOR_VERSION,
      islandId: spec.id,
      displayName: spec.displayName,
      seed: spec.seed,
      recipeId: spec.recipeId,
      nodes: standalone.nav.markers,
      bridges: standalone.nav.bridges,
    });
    await writeJson(navPath, standalone.nav);
    await writeJson(statsPath, {
      schemaVersion: SCHEMA_VERSION,
      generator: GENERATOR_VERSION,
      islandId: spec.id,
      displayName: spec.displayName,
      stats: sceneStats(standalone.root),
      sourceAssetCredits: standalone.nav.sourceAssetCredits,
    });
    files.push(glbPath, markersPath, navPath, statsPath);
  }

  const merged = buildMergedWorld();
  const mergedGlbPath = join(outputDir, "swimmer-world.glb");
  const mergedMarkersPath = join(outputDir, "swimmer-world.markers.json");
  const mergedNavPath = join(outputDir, "swimmer-world.nav.json");
  const mergedStatsPath = join(outputDir, "swimmer-world.stats.json");
  const mergedGlb = await exportGlb(merged.root, mergedGlbPath);
  assertGlbContract(
    mergedGlb,
    [
      "ground",
      "spawn",
      "hub",
      "portal_break_surface",
      "portal_uni_surface",
      "portal_dir_surface",
      "portal_swimmerparty_surface",
      "portal_break",
      "portal_uni",
      "portal_dir",
      "portal_swimmerparty",
      "portal_break_front",
      "portal_uni_front",
      "portal_dir_front",
      "portal_swimmerparty_front",
      "sign_anchor",
      "sun_dir",
    ],
    ["bridge_break_", "bridge_university_", "bridge_directing_", "bridge_swimmerparty_"],
    "swimmer-world.glb",
  );
  await writeJson(mergedMarkersPath, {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR_VERSION,
    worldId: "swiminai-world",
    nodes: merged.markers,
  });
  await writeJson(mergedNavPath, merged.nav);
  await writeJson(mergedStatsPath, {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR_VERSION,
    worldId: "swiminai-world",
    stats: merged.nav.stats,
  });
  files.push(mergedGlbPath, mergedMarkersPath, mergedNavPath, mergedStatsPath);

  const assetRecords = [];
  for (const path of files.sort()) {
    const bytes = await readFile(path);
    assetRecords.push({
      path: path.slice(outputDir.length + 1),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
  }
  const record = {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR_VERSION,
    generatedAt: generatedAtFor(outputDir, existingRecord),
    universityCommit: sourceCommitFor(existingRecord),
    source: {
      blueprint: "packages/world/src/island/island-blueprint.ts",
      geometry: "packages/world/src/island/island-geometry.ts",
      detail: "course for standalone islands; world for merged world",
      decoration: "omitted intentionally; markers/nav remain deterministic and extensible",
    },
    islands: ISLANDS.map(({ id, displayName, seed, recipeId, routeArchetype }) => ({
      id,
      displayName,
      seed,
      recipeId,
      routeArchetype,
    })),
    files: assetRecords,
  };
  await writeJson(join(outputDir, "export-record.json"), record);
  return record;
}

async function compareDirectories(expectedDir, actualDir) {
  const [expected, actual] = await Promise.all([readdir(expectedDir), readdir(actualDir)]);
  const names = [...new Set([...expected, ...actual])].sort();
  const differences = [];
  for (const name of names) {
    if (name === "export-record.json") continue;
    const [a, b] = await Promise.all([
      readFile(join(expectedDir, name)).catch(() => null),
      readFile(join(actualDir, name)).catch(() => null),
    ]);
    if (!a || !b || !a.equals(b)) differences.push(name);
  }
  return differences;
}

async function main() {
  const check = process.argv.includes("--check");
  if (check) {
    const existingRecord = await readExistingRecord(OUTPUT_DIR);
    if (!existingRecord) throw new Error(`Missing ${join(OUTPUT_DIR, "export-record.json")}`);
    const temporary = await mkdtemp(join(tmpdir(), "university-swiminai-islands-"));
    try {
      await generate(temporary, existingRecord);
      const differences = await compareDirectories(OUTPUT_DIR, temporary);
      if (differences.length > 0) {
        throw new Error(`Generated island export differs: ${differences.join(", ")}`);
      }
      console.log(`SwimInAI island export is reproducible (${existingRecord.generatedAt}).`);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    return;
  }
  const existingRecord = await readExistingRecord(OUTPUT_DIR);
  const record = await generate(OUTPUT_DIR, existingRecord);
  console.log(`Wrote ${record.files.length} deterministic assets to ${OUTPUT_DIR}`);
  for (const file of record.files) console.log(`${file.path}  sha256=${file.sha256}`);
}

await main();
