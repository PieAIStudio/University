/**
 * Load the CC0 art kit once, draw it many times.
 *
 * A finished world puts something like five hundred trees, rocks and houses on
 * fifty-two islands. Five hundred `<primitive>` clones is five hundred draw
 * calls and a phone that drops to single-digit frames, so everything here goes
 * through `InstancedMesh`: one call per distinct mesh inside a model, however
 * many copies of it stand in the world.
 *
 * Two things are handled here that are easy to get wrong and invisible until
 * they bite:
 *
 *   - **Scale.** The kit is assembled from four different CC0 packs, and packs
 *     do not agree on what one unit means. A Quaternius pine and a KayKit house
 *     placed at scale 1 differ by a factor of ten. So every model is measured
 *     on load and normalised to unit height with its base at y=0, and callers
 *     then ask for the height they want in world units. Nobody hand-tunes a
 *     magic number per asset.
 *   - **Nested transforms.** A GLB is a tree, and a mesh three groups deep
 *     carries its parents' rotation. Baking `matrixWorld` at load time is what
 *     keeps a rotated door on its house once the house becomes an instance.
 */
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
// three-stdlib rather than three/examples: drei's GLTFLoader is the stdlib one,
// and `setKTX2Loader` will only accept the loader from the same package.
import { DRACOLoader, KTX2Loader } from "three-stdlib";

import manifest from "./kit.json";
import {
  cloneOwnedPartGeometry,
  disposeOwnedPartResources,
  type OwnedPartResources,
} from "./kit-resources.js";
import { hash } from "./island/random.js";

export type Role = keyof typeof manifest.assets;

const kit = manifest.assets as Record<Role, { src: string; license: string }>;

/**
 * Raise the donor's baked ambient occlusion into a range this scene can light.
 *
 * These packs carry per-vertex AO in `COLOR_0`, with values reaching 0.14. That
 * multiplies the material, so a tree crevice arrives at fourteen percent of its
 * colour — which under the donor's own bright unlit-ish setup reads as shading
 * and under a hemisphere light plus ACES reads as a black silhouette. This was
 * an hour of looking at black trees while every material property said white.
 *
 * Discarding the attribute is the easy fix and the wrong one: the bake is what
 * gives a flat-shaded canopy its interior depth. Compressing it into [0.55, 1]
 * keeps the shape it describes and drops the part that was never lighting
 * information in the first place.
 */
function lift(geometry: THREE.BufferGeometry) {
  const colour = geometry.attributes.color as THREE.BufferAttribute | undefined;
  if (!colour || geometry.userData.lifted) return;
  const floor = 0.55;
  const lifted = new Float32Array(colour.count * 3);
  for (let index = 0; index < colour.count; index += 1) {
    lifted[index * 3] = floor + (1 - floor) * colour.getX(index);
    lifted[index * 3 + 1] = floor + (1 - floor) * colour.getY(index);
    lifted[index * 3 + 2] = floor + (1 - floor) * colour.getZ(index);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(lifted, 3));
  geometry.userData.lifted = true;
}

/**
 * One palette for four donor packs.
 *
 * The nature models paint themselves from a shared texture atlas, and at this
 * camera a canopy is thirty pixels wide — the atlas is invisible, but it costs
 * a Basis transcoder, a compressed-texture upload path, and a whole class of
 * bug that presents as "the model did not load". The leaves here sampled black
 * from theirs for an hour before that was clear.
 *
 * So the kit is repainted on load from a table keyed by the material names the
 * artists already wrote — `Leaves`, `Bark_NormalTree`, `Rocks`, `Stone_Light`.
 * That is not a workaround dressed as a decision. Four CC0 packs by four
 * authors have four palettes, and a world assembled from them looks assembled
 * unless somebody picks the colours. Picking them here is how the archipelago
 * becomes one place, and it puts art direction in a file rather than in the
 * assets, which is where it can be argued with.
 *
 * A material whose name matches nothing keeps whatever colour it shipped with.
 */
const PAINT: readonly (readonly [RegExp, number])[] = [
  [/leaf|leaves|foliage|canopy|bush|fern|grass/i, 0x5f9e46],
  [/pine|conifer|spruce|fir/i, 0x437a4a],
  [/bark|trunk|branch|log|wood/i, 0x7a5a3c],
  [/rock|stone|cliff|boulder|gravel/i, 0x8c8a80],
  [/sand|dirt|soil|ground|earth/i, 0xbfa677],
  [/roof|tile|shingle/i, 0xa45b47],
  [/wall|plaster|stucco|straw|thatch/i, 0xd6c6a4],
  [/mushroom|flower|petal|bloom/i, 0xd0715f],
  [/fire|flame|ember|lamp|light|torch|lantern/i, 0xffb347],
  [/water|sea|wave/i, 0x2f89a0],
  [/metal|iron|steel|nail/i, 0x8f949c],
];

function repaint(source: THREE.Material, preserveMap = false): THREE.Material {
  const original = source as THREE.MeshStandardMaterial;
  if (preserveMap) {
    // Kenney's GLB packs intentionally share a tiny `colormap.png` per pack.
    // The old WOC kit is repainted because its donor atlas is not shipped with
    // the same material contract; throwing the Kenney map away would turn a
    // colourful accent pack into a grey block. Clone, rather than mutate, so
    // drei's cached GLTF remains safe for another projection.
    const painted = source.clone();
    if (painted instanceof THREE.MeshStandardMaterial) {
      painted.flatShading = true;
      painted.roughness = Math.max(0.72, painted.roughness);
      painted.side = THREE.DoubleSide;
      painted.needsUpdate = true;
    }
    return painted;
  }
  const match = PAINT.find(([pattern]) => pattern.test(original.name ?? ""));
  const painted = new THREE.MeshStandardMaterial({
    color: match ? match[1] : (original.color?.getHex() ?? 0xffffff),
    // The lifted bake from `lift` still multiplies through, which is what keeps
    // a flat-coloured canopy from looking like a sticker.
    vertexColors: original.vertexColors,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
    // Leaf cards are cut out of a quad by alpha in the donor's atlas. Without
    // the atlas there is nothing to cut, so the card has to be a solid
    // double-sided face instead of a discarded one.
    side: THREE.DoubleSide,
  });
  painted.name = original.name;
  return painted;
}

interface Part {
  /** The cached GLTF resources; PartField clones them after commit. */
  readonly sourceGeometry: THREE.BufferGeometry;
  readonly sourceMaterial: THREE.Material;
  readonly preserveMap: boolean;
  /** The mesh's own place inside the model, after normalisation. */
  readonly offset: THREE.Matrix4;
}

/**
 * Fourteen of the kit models carry KTX2/Basis textures, so a transcoder has to
 * exist before they will load at all.
 *
 * It is served from `/basis/`, copied out of three's own distribution by the
 * import script — never from a CDN, which the Web3D baseline rules out and
 * which would also mean the world silently fails to paint on a bad network.
 * Keeping the textures in KTX2 rather than unpacking them at build time is the
 * better trade anyway: Basis stays compressed *in GPU memory*, where a WebP
 * would have been expanded to raw RGBA on upload.
 *
 * One loader for the whole app, and module scope is what enforces that. Built
 * per-component it would be one transcoder download per model, which three
 * warns about and which is exactly the sort of waste that only shows up on the
 * slow connection you cannot reproduce. `detectSupport` needs the real renderer
 * — it asks this particular GPU which compressed formats it can actually take —
 * so the loader is created on first use inside the canvas, not at import time.
 */
let ktx2Loader: KTX2Loader | null = null;
// Elemental-Serenity's supplied GLBs use KHR_draco_mesh_compression. Keep the
// decoder on the same shared AssetField path as the existing KTX2 loader and
// serve its three small decoder files locally, so a donor never creates a
// second ad-hoc loading pipeline or reaches for a CDN at runtime.
const dracoLoader = new DRACOLoader().setDecoderPath("/draco/");

function useKtx2() {
  const gl = useThree((state) => state.gl);
  return useMemo(() => {
    ktx2Loader ??= new KTX2Loader().setTranscoderPath("/basis/");
    return ktx2Loader.detectSupport(gl);
  }, [gl]);
}

/**
 * Keep every compressed island GLB on the same decoder/transcoder path. The
 * foliage projection needs the raw scene to choose a donor trunk variant and
 * to sample the donor emitter, but it must not create a second loader stack.
 */
export function useIslandGLTF(src: string) {
  const ktx2 = useKtx2();
  return useGLTF(src, false, true, (loader) => {
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2);
  });
}

/**
 * `useGLTF` must be called unconditionally, so an empty library still needs a
 * stable list to suspend on. This is the one model already shipped for every
 * course, so it is never an extra fetch.
 */
const EMPTY_LIBRARY: readonly string[] = [];

/**
 * The one material every batched prop shares.
 *
 * Both batched fields use this rather than each building its own, because two
 * definitions of the prop material is two ways for the silhouette treatment to
 * drift — and because a single shared `customProgramCacheKey` is what keeps
 * three from compiling a second program for the same look.
 */
function createBatchedPropMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      [
        // A restrained reverse-fresnel darkens the silhouette edge just enough
        // to keep a small tree separate from a similarly coloured meadow tile.
        "float propEdge = smoothstep(0.02, 0.72, abs(normal.y));",
        "outgoingLight *= mix(0.88, 1.0, propEdge);",
        /*
         * A prop's shaded side keeps its own hue instead of becoming the fill's.
         *
         * The scene runs key:fill at 5.57:1 with a cool fill, which is right for
         * terrain: a hex top is a broad plane facing the sun, so the ratio reads
         * as warm light and cool shadow. A palm trunk is the opposite case —
         * from a 65° camera almost every pixel of a thin vertical prop is the
         * face turned *away* from a 24° sun. At one fifth intensity and a blue
         * tint, a warm brown lands on near-black, and the whole tree read as a
         * black stick against the meadow. That was not a colour bug; the swatch
         * was a perfectly good 0x8f6a45, and rendering the same mesh with a
         * white material proved it by coming back blue rather than black.
         *
         * The floor is a value step inside the object's own family rather than
         * a light: shadow stops at 32% of the prop's albedo, so the dark side of
         * a trunk stays brown and the dark side of a leaf stays green. Raising
         * the scene fill instead would have paid for one prop by flattening
         * every terrace on the island.
         */
        "outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.32);",
        "#include <opaque_fragment>",
      ].join("\n"),
    );
  };
  material.customProgramCacheKey = () => "hex-grid-batched-prop-v2";
  return material;
}

/**
 * Flatten a loaded scene to a list of instanceable parts, normalised to unit
 * height. Shared by the single-source and library loaders below so there is
 * exactly one definition of what "normalised" means.
 */
function partsFromScene(root: THREE.Object3D, preserveMap: boolean): Part[] {
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const height = size.y || 1;
  // Centre on X and Z, sit the base on y=0, then scale height to 1.
  const normalise = new THREE.Matrix4()
    .makeScale(1 / height, 1 / height, 1 / height)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));

  const parts: Part[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    parts.push({
      // Keep the loader's source geometry/material immutable. PartField
      // clones both only after the component commits, so a StrictMode render
      // that React abandons cannot strand GPU resources created in render.
      sourceGeometry: mesh.geometry,
      sourceMaterial: material,
      preserveMap,
      offset: new THREE.Matrix4().multiplyMatrices(normalise, mesh.matrixWorld),
    });
  });
  return parts;
}

function usePartsFromSource(src: string, preserveMap = false): readonly Part[] {
  const gltf = useIslandGLTF(src);
  return useMemo(() => partsFromScene(gltf.scene, preserveMap), [gltf, preserveMap]);
}

/**
 * Load a whole library of GLBs through the one loader stack.
 *
 * `useGLTF` accepts an array and suspends until all of them resolve, so this
 * stays a single hook call whatever the library's size — the hook order cannot
 * depend on how many biomes a course happens to use.
 */
function usePartsFromSources(sources: readonly string[]): ReadonlyMap<string, readonly Part[]> {
  const ktx2 = useKtx2();
  const list = sources.length > 0 ? sources : EMPTY_LIBRARY;
  const loaded = useGLTF(list as string[], false, true, (loader) => {
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2);
  });
  return useMemo(() => {
    const parts = new Map<string, readonly Part[]>();
    if (sources.length === 0) return parts;
    const scenes = Array.isArray(loaded) ? loaded : [loaded];
    sources.forEach((src, index) => {
      const scene = scenes[index]?.scene;
      if (scene) parts.set(src, partsFromScene(scene, false));
    });
    return parts;
  }, [loaded, sources]);
}

function useParts(role: Role): readonly Part[] {
  return usePartsFromSource(kit[role].src, false);
}

export interface Placement {
  readonly position: THREE.Vector3;
  /** Height in world units. The model is scaled to this, not to a factor. */
  readonly height: number;
  readonly turn: number;
  /** Horizontal scale. Defaults to `height` so a skinny silhouette can be fattened. */
  readonly width?: number;
}

/**
 * Every copy of one kit model in the scene, as a handful of draw calls.
 */
export function PropField({ role, at }: { role: Role; at: readonly Placement[] }) {
  const parts = useParts(role);
  return (
    <>
      {parts.map((part, index) => (
        <PartField key={`${role}-${index}`} part={part} at={at} />
      ))}
    </>
  );
}

/**
 * Render an explicitly curated external GLB through the same instancing and
 * normalisation path as the legacy kit.  Recipes pass one URL per asset and a
 * list of placements; they never create a new loader or a second scene
 * implementation.  `preserveMap` is the Kenney path, while the old kit keeps
 * its authored material repaint above.
 */
export function AssetField({
  src,
  at,
  preserveMap = true,
  castShadow = true,
}: {
  readonly src: string;
  readonly at: readonly Placement[];
  readonly preserveMap?: boolean;
  readonly castShadow?: boolean;
}) {
  const parts = usePartsFromSource(src, preserveMap);
  return (
    <>
      {parts.map((part, index) => (
        <PartField key={`${src}-${index}`} part={part} at={at} castShadow={castShadow} />
      ))}
    </>
  );
}

/**
 * The prop palette, keyed by the material names Kenney's artists already wrote.
 *
 * Two things this table has to get right, and the first one is why it exists at
 * all rather than just reusing the terrain swatches:
 *
 * **Bark is not cliff.** Bark used to be painted `0x70452f`, which is
 * `GRID_SHARED_SOIL.cliff`. On a cliff face — a large mass filling a lot of
 * screen — that reads as warm earth. On a palm trunk 0.1 world units wide it
 * reads as a black stick, because almost every pixel of a thin cylinder is a
 * grazing-angle pixel and the silhouette darkening lands on all of them at
 * once. The same number is correct for one and wrong for the other; the fix is
 * a lighter swatch for props, not a change to the terrain.
 *
 * **Autumn is not green.** `leafsFall` used to fall through to the leaf entry
 * and come out the same green as summer, which would have quietly deleted the
 * entire point of the fall-grove biome.
 */
const PROP_FAMILY: readonly (readonly [RegExp, number])[] = [
  [/fall|autumn/, 0xd98836],
  [/birch/, 0xd9cdb4],
  [/mushroom|colorred|red/, 0xe0664a],
  [/corn|wheat/, 0xe0b552],
  [/flower|yellow/, 0xf0bd4f],
  [/purple|violet/, 0xa06ec0],
  [/grass|leaf|plant|foliage/, 0x6f9e3c],
  [/bark|wood|trunk|log/, 0x8f6a45],
  [/stone|rock|dirt|sand/, 0x9c8467],
];

/**
 * LOOK-V2 §11 rule 3: one object carries two or three values, not one flat
 * colour. Kenney already authored that distinction into the material names —
 * `stone`/`stoneDark`, `leafsGreen`/`leafsDark`, `woodBark`/`woodInner` — and
 * the previous table collapsed each pair onto a single swatch, throwing the
 * internal value step away and flattening every prop into a sticker.
 */
function batchedPropColour(source: THREE.Material): THREE.Color {
  const name = (source.name ?? "").toLowerCase();
  const match = PROP_FAMILY.find(([pattern]) => pattern.test(name));
  const colour = new THREE.Color(
    match ? match[1] : ((source as THREE.MeshStandardMaterial).color?.getHex?.() ?? 0xd2bf97),
  );
  if (/dark/.test(name)) colour.multiplyScalar(0.74);
  else if (/inner|light/.test(name)) colour.multiplyScalar(1.15);
  return colour;
}

function isFoliageMaterial(source: THREE.Material): boolean {
  const name = (source.name ?? "").toLowerCase();
  return /grass|leaf|plant|foliage/.test(name);
}

/**
 * Per-copy foliage variation.
 *
 * This used to *replace* a leaf's colour with one of nine fixed swatches. Two
 * things were wrong with that. The ramp reached `0x213c28`, which on an island
 * tree is depth and on a 1.5-unit shrub is a black hole in the meadow; and
 * replacing the colour meant an autumn canopy came back green, because the
 * ramp only knows about grass.
 *
 * So the variation is now relative: a small deterministic swing in value and a
 * slight warm/cool tilt, applied to whatever family colour the material
 * already resolved to. Every copy still differs from its neighbour — LOOK-V2
 * §11 rule 2, variation beats detail — but a family stays itself.
 */
function batchedFoliageInstanceMultiplier(
  source: THREE.Material,
  placement: Placement,
  placementIndex: number,
): THREE.Color | null {
  if (!isFoliageMaterial(source)) return null;
  const key = `grid-foliage/${source.name}/${placementIndex}/${Math.round(placement.position.x * 10)},${Math.round(placement.position.z * 10)}`;
  const value = 0.84 + hash(key) * 0.32;
  const tilt = (hash(`${key}/tilt`) - 0.5) * 0.16;
  return new THREE.Color(value * (1 + tilt), value, value * (1 - tilt * 0.6));
}

function normaliseBatchedGeometry(part: Part): THREE.BufferGeometry {
  const geometry = cloneOwnedPartGeometry(part.sourceGeometry);
  // BatchedMesh requires one attribute signature for the whole batch. The
  // grid parts carry position/normal/color. UVs are deliberately not part of
  // that signature: nature has no map, and the admitted textured kits have
  // already baked their colormap into COLOR_0 at import time.
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "color") {
      geometry.deleteAttribute(name);
    }
  }
  const position = geometry.getAttribute("position");
  if (!position) throw new Error("A batched prop part needs a position attribute");
  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }
  const sourceColour = geometry.getAttribute("color");
  const colours = new Float32Array(position.count * 3);
  if (sourceColour) {
    if (sourceColour.count !== position.count || sourceColour.itemSize < 3) {
      throw new Error("A batched prop color attribute must have one RGB value per position");
    }
    for (let index = 0; index < position.count; index += 1) {
      colours[index * 3] = sourceColour.getX(index);
      colours[index * 3 + 1] = sourceColour.getY(index);
      colours[index * 3 + 2] = sourceColour.getZ(index);
    }
  } else {
    const colour = batchedPropColour(part.sourceMaterial);
    for (let index = 0; index < position.count; index += 1) colour.toArray(colours, index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/**
 * One multi-draw batch for an entire library of assets.
 *
 * `BatchedAssetField` below draws one *model* per submission, which was fine
 * while the grid shipped nine of them and fatal the moment it shipped sixty:
 * draw calls would have grown linearly with how varied the island looked,
 * so "make the map richer" and "keep the frame cheap" would have been in
 * direct opposition. They are not, and this is why.
 *
 * It works because every model in the grid library reaches this component as
 * position/normal/color geometry with no texture to bind. Nature provides its
 * fallback family colour at runtime; Castle, Survival and Pirate arrive with
 * their source colormap already baked into COLOR_0. One material describes all
 * of them. The whole prop field — every biome, every role, every instance — is
 * one submission and one shadow submission, whether the course uses six models
 * or sixty.
 *
 * The sources are sorted before loading so the hook order cannot change when a
 * course's biome mix changes.
 */
export function BatchedAssetLibraryField({
  fields,
  castShadow = false,
  name = "hex-grid-batched-library",
}: {
  readonly fields: readonly { readonly src: string; readonly at: readonly Placement[] }[];
  readonly castShadow?: boolean;
  readonly name?: string;
}) {
  const sources = useMemo(() => [...new Set(fields.map((field) => field.src))].sort(), [fields]);
  const partsBySource = usePartsFromSources(sources);
  const [batch, setBatch] = useState<THREE.BatchedMesh | null>(null);

  useLayoutEffect(() => {
    const drawn = fields.filter((field) => field.at.length > 0);
    if (drawn.length === 0 || partsBySource.size === 0) return;

    const geometryBySource = new Map<string, THREE.BufferGeometry[]>();
    let maxVertexCount = 0;
    let maxIndexCount = 0;
    let maxInstanceCount = 0;
    for (const field of drawn) {
      const parts = partsBySource.get(field.src);
      if (!parts || parts.length === 0) continue;
      if (!geometryBySource.has(field.src)) {
        const geometries = parts.map(normaliseBatchedGeometry);
        geometryBySource.set(field.src, geometries);
        for (const geometry of geometries) {
          maxVertexCount += geometry.getAttribute("position").count;
          maxIndexCount += geometry.index?.count ?? 0;
        }
      }
      maxInstanceCount += field.at.length * parts.length;
    }
    if (maxInstanceCount === 0) return;

    const material = createBatchedPropMaterial();
    const target = new THREE.BatchedMesh(
      maxInstanceCount,
      Math.max(1, maxVertexCount),
      Math.max(1, maxIndexCount),
      material,
    );
    target.perObjectFrustumCulled = false;
    target.sortObjects = false;
    target.castShadow = castShadow;
    target.frustumCulled = false;
    target.name = name;

    const geometryIdsBySource = new Map<string, number[]>();
    for (const [src, geometries] of geometryBySource) {
      geometryIdsBySource.set(
        src,
        geometries.map((geometry) => target.addGeometry(geometry)),
      );
    }

    const local = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    let placed = 0;
    for (const field of drawn) {
      const parts = partsBySource.get(field.src);
      const geometryIds = geometryIdsBySource.get(field.src);
      if (!parts || !geometryIds) continue;
      field.at.forEach((placement, placementIndex) => {
        const width = placement.width ?? placement.height;
        world.compose(
          placement.position,
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn),
          new THREE.Vector3(width, placement.height, width),
        );
        geometryIds.forEach((geometryId, partIndex) => {
          const instanceId = target.addInstance(geometryId);
          target.setMatrixAt(instanceId, local.multiplyMatrices(world, parts[partIndex]!.offset));
          const foliageMultiplier = batchedFoliageInstanceMultiplier(
            parts[partIndex]!.sourceMaterial,
            placement,
            placementIndex,
          );
          if (foliageMultiplier) target.setColorAt(instanceId, foliageMultiplier);
        });
        placed += 1;
      });
    }
    target.userData = {
      islandLookPlacementCount: placed,
      islandLookBatch: true,
      islandLookMaterials: [...partsBySource.entries()].flatMap(([src, parts]) =>
        parts.map(
          (part) =>
            `${src.split("/").pop()}::${part.sourceMaterial.name}::${batchedPropColour(part.sourceMaterial).getHexString()}`,
        ),
      ),
    };
    target.computeBoundingBox();
    target.computeBoundingSphere();
    for (const geometries of geometryBySource.values()) {
      geometries.forEach((geometry) => geometry.dispose());
    }
    setBatch(target);

    return () => {
      setBatch((current) => (current === target ? null : current));
      target.dispose();
      material.dispose();
    };
  }, [castShadow, fields, name, partsBySource]);

  if (!batch) return null;
  return <primitive object={batch} dispose={null} />;
}

/**
 * One multi-draw batch for all parts of one nature asset. A GLB may contain a
 * leaf part and a bark part with different geometry, so ordinary InstancedMesh
 * still needs one call per primitive. BatchedMesh keeps those parts together
 * under one material and one renderer submission while retaining each model's
 * silhouette and per-copy transform.
 */
export function BatchedAssetField({
  src,
  at,
  castShadow = false,
}: {
  readonly src: string;
  readonly at: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const parts = usePartsFromSource(src, false);
  const [batch, setBatch] = useState<THREE.BatchedMesh | null>(null);

  useLayoutEffect(() => {
    if (parts.length === 0 || at.length === 0) return;
    const geometries = parts.map(normaliseBatchedGeometry);
    const material = createBatchedPropMaterial();
    const maxVertexCount = geometries.reduce(
      (total, geometry) => total + geometry.getAttribute("position").count,
      0,
    );
    const maxIndexCount = geometries.reduce(
      (total, geometry) => total + (geometry.index?.count ?? 0),
      0,
    );
    const target = new THREE.BatchedMesh(
      Math.max(1, at.length * geometries.length),
      Math.max(1, maxVertexCount),
      Math.max(1, maxIndexCount),
      material,
    );
    target.perObjectFrustumCulled = false;
    target.sortObjects = false;
    target.castShadow = castShadow;
    target.frustumCulled = false;
    target.name = "hex-grid-batched-prop";
    target.userData = {
      islandLookPlacementCount: at.length,
      islandLookBatch: true,
    };
    const geometryIds = geometries.map((geometry) => target.addGeometry(geometry));
    const local = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    at.forEach((placement, placementIndex) => {
      const width = placement.width ?? placement.height;
      world.compose(
        placement.position,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn),
        new THREE.Vector3(width, placement.height, width),
      );
      geometryIds.forEach((geometryId, partIndex) => {
        const instanceId = target.addInstance(geometryId);
        target.setMatrixAt(instanceId, local.multiplyMatrices(world, parts[partIndex]!.offset));
        const foliageMultiplier = batchedFoliageInstanceMultiplier(
          parts[partIndex]!.sourceMaterial,
          placement,
          placementIndex,
        );
        if (foliageMultiplier) target.setColorAt(instanceId, foliageMultiplier);
      });
    });
    target.computeBoundingBox();
    target.computeBoundingSphere();
    geometries.forEach((geometry) => geometry.dispose());
    setBatch(target);

    return () => {
      setBatch((current) => (current === target ? null : current));
      target.dispose();
      material.dispose();
    };
  }, [at, castShadow, parts]);

  if (!batch) return null;
  return <primitive object={batch} dispose={null} />;
}

function PartField({
  part,
  at,
  castShadow = true,
}: {
  part: Part;
  at: readonly Placement[];
  castShadow?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ownedRef = useRef<OwnedPartResources | null>(null);
  const [owned, setOwned] = useState<OwnedPartResources | null>(null);

  // R3F receives geometry/material through constructor args and only disposes
  // the InstancedMesh itself. Create the projection-owned clones in a layout
  // effect, after commit, and release the exact pair in that effect's cleanup.
  // This also makes React StrictMode's setup/cleanup/setup probe harmless: the
  // first pair is disposed before the second pair is installed.
  useLayoutEffect(() => {
    const geometry = cloneOwnedPartGeometry(part.sourceGeometry);
    // The legacy donor stores baked AO in COLOR_0; Kenney's unlit packs use
    // authored colour there. Lifting the latter would wash its palette out,
    // so the correction belongs only to the repainting path it was written
    // for. The source geometry is never mutated.
    if (!part.preserveMap) lift(geometry);
    const resources: OwnedPartResources = {
      geometry,
      material: repaint(part.sourceMaterial, part.preserveMap),
    };
    ownedRef.current = resources;
    setOwned(resources);

    return () => {
      if (ownedRef.current === resources) ownedRef.current = null;
      disposeOwnedPartResources([resources]);
    };
  }, [part]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const local = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    at.forEach((placement, index) => {
      const width = placement.width ?? placement.height;
      world.compose(
        placement.position,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn),
        new THREE.Vector3(width, placement.height, width),
      );
      target.setMatrixAt(index, local.multiplyMatrices(world, part.offset));
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [at, owned, part]);

  // `key` on the count: an InstancedMesh cannot grow, and the world's prop
  // count changes the moment a lesson is finished.
  if (!owned) return null;
  return (
    <instancedMesh
      key={at.length}
      ref={mesh}
      args={[owned.geometry, owned.material, Math.max(at.length, 1)]}
      userData={{ islandLookPlacementCount: at.length }}
      castShadow={castShadow}
      // Casting but not receiving, on purpose. A tree receiving its own shadow
      // map at this scale is the acne case; the shadow it throws on the island
      // is the part that reads.
      frustumCulled={false}
    />
  );
}
