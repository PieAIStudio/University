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
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
// three-stdlib rather than three/examples: drei's GLTFLoader is the stdlib one,
// and `setKTX2Loader` will only accept the loader from the same package.
import { KTX2Loader } from "three-stdlib";

import manifest from "./kit.json";

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

function repaint(source: THREE.Material): THREE.Material {
  const original = source as THREE.MeshStandardMaterial;
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
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
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
function useKtx2() {
  const gl = useThree((state) => state.gl);
  return useMemo(() => {
    ktx2Loader ??= new KTX2Loader().setTranscoderPath("/basis/");
    return ktx2Loader.detectSupport(gl);
  }, [gl]);
}

/**
 * Flatten a model to a list of instanceable parts, normalised to unit height.
 */
function useParts(role: Role): readonly Part[] {
  const ktx2 = useKtx2();
  const gltf = useGLTF(kit[role].src, false, true, (loader) => loader.setKTX2Loader(ktx2));
  return useMemo(() => {
    const root = gltf.scene;
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
      lift(mesh.geometry);
      parts.push({
        geometry: mesh.geometry,
        material: repaint(material),
        offset: new THREE.Matrix4().multiplyMatrices(normalise, mesh.matrixWorld),
      });
    });
    return parts;
  }, [gltf]);
}

export interface Placement {
  readonly position: THREE.Vector3;
  /** Height in world units. The model is scaled to this, not to a factor. */
  readonly height: number;
  readonly turn: number;
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

function PartField({ part, at }: { part: Part; at: readonly Placement[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const local = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    at.forEach((placement, index) => {
      world.compose(
        placement.position,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn),
        new THREE.Vector3(placement.height, placement.height, placement.height),
      );
      target.setMatrixAt(index, local.multiplyMatrices(world, part.offset));
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [at, part]);

  // `key` on the count: an InstancedMesh cannot grow, and the world's prop
  // count changes the moment a lesson is finished.
  return (
    <instancedMesh
      key={at.length}
      ref={mesh}
      args={[part.geometry, part.material, Math.max(at.length, 1)]}
      castShadow
      // Casting but not receiving, on purpose. A tree receiving its own shadow
      // map at this scale is the acne case; the shadow it throws on the island
      // is the part that reads.
      frustumCulled={false}
    />
  );
}
