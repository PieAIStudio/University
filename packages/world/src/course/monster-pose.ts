import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

/**
 * A donor monster frozen in one frame of its idle, as plain geometry.
 *
 * Only the three monsters nearest the learner animate (V7 decision N1); every
 * other one on the island stands still. A skinned mesh standing still still
 * pays for its skeleton, its own draw calls and its own shadow pass, thirty
 * times over. So each model is posed once at load, its skinning applied on the
 * CPU, and the result drawn as instances: one draw per material per kind of
 * monster, however many stand on the island.
 *
 * The baked frame is normalised the way the prop kit normalises its models
 * (kit.tsx, `partsFromScene`): base on y = 0, centred on x and z, one unit
 * tall, so callers ask for a height in world units rather than a factor. The
 * same matrix is returned so a live, animated clone can be placed identically.
 */

export interface BakedMonsterPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  /** True for the painted material the bake made; the model's own stay the loader's. */
  readonly owned: boolean;
}

export interface BakedMonster {
  readonly parts: readonly BakedMonsterPart[];
  /** Maps the model's own frame onto the one-unit frame the parts are in. */
  readonly normalise: THREE.Matrix4;
  /** The top of the head in the one-unit frame, for the boss's crown. */
  readonly top: THREE.Vector3;
  /** Width over height of the posed model, for spacing and picking. */
  readonly aspect: number;
  /**
   * Whether it animates through a skeleton. The chicken's idle moves fifty-five
   * separate meshes instead; drawn live it would be over a hundred draws.
   */
  readonly skinned: boolean;
}

/** The standing idle, not a hit reaction or a landing that happens to say "idle". */
export function idleClip(clips: readonly THREE.AnimationClip[]): THREE.AnimationClip | null {
  return (
    clips.find((clip) => clip.name === "Idle") ??
    clips.find((clip) => clip.name === "Flying_Idle") ??
    clips.find((clip) => clip.name === "Idle_AnimalArmature") ??
    clips.find((clip) => /idle/i.test(clip.name) && !/hit|jump|toidle|head/i.test(clip.name)) ??
    null
  );
}

/**
 * The clips that actually move this model. Some donors ship clips for more than
 * one armature (the boar carries both `…_AnimalArmature` and
 * `…_MonsterArmature`); a clip whose tracks name bones the model does not have
 * plays as nothing, so it is left out rather than chosen and seen to freeze.
 */
export function usableClips(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const names = new Set<string>();
  root.traverse((object) => names.add(object.name));
  return clips.filter((clip) => {
    if (!clip.tracks.length) return false;
    const bound = clip.tracks.filter((track) =>
      names.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName ?? ""),
    ).length;
    return bound / clip.tracks.length >= 0.5;
  });
}

/**
 * Short, friendly one-shots a standing monster may play now and then: a wave,
 * a nod, a head shake, a hop, a little dance, a sneeze. Never an attack, a hit
 * or a death — these are fears being chased away, not enemies.
 */
const FIDGETS =
  /^(Wave|Yes|No|Jump|Dance|Cast|Idle2|Emote1 \(sneeze\)|Eating|Idle_Headlow|Idle_2|Yes_MonsterArmature|No_MonsterArmature)(_AnimalArmature)?$/;

export function fidgetClips(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const idle = idleClip(usableClips(root, clips));
  return usableClips(root, clips).filter((clip) => clip !== idle && FIDGETS.test(clip.name));
}

const KEEP = ["position", "uv", "color"] as const;

function plainCopy(mesh: THREE.Mesh): THREE.BufferGeometry {
  const source = mesh.geometry;
  const count = source.getAttribute("position").count;
  const geometry = new THREE.BufferGeometry();
  const vertex = new THREE.Vector3();
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    // Applies morph targets and, on a SkinnedMesh, the bones' current pose.
    mesh.getVertexPosition(index, vertex);
    vertex.applyMatrix4(mesh.matrixWorld);
    positions.set([vertex.x, vertex.y, vertex.z], index * 3);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  for (const name of KEEP) {
    if (name === "position") continue;
    const attribute = source.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!attribute) continue;
    // Quantized donors store uv and colour as normalised integers; merging and
    // instancing want plain floats.
    const size = attribute.itemSize;
    const values = new Float32Array(count * size);
    for (let index = 0; index < count; index += 1)
      for (let k = 0; k < size; k += 1) values[index * size + k] = attribute.getComponent(index, k);
    geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  if (source.index) geometry.setIndex(source.index.clone());
  return geometry;
}

/** The same geometry with its material's colour in its vertices, and no uv. */
function paintedCopy(geometry: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  const copy = new THREE.BufferGeometry();
  copy.setAttribute("position", geometry.getAttribute("position"));
  if (geometry.index) copy.setIndex(geometry.index);
  const count = geometry.getAttribute("position").count;
  const own = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
  const colours = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const k = own ? [own.getX(index), own.getY(index), own.getZ(index)] : [1, 1, 1];
    colours.set([colour.r * k[0]!, colour.g * k[1]!, colour.b * k[2]!], index * 3);
  }
  copy.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return copy;
}

/** Merging needs every geometry indexed or none; the donors' smooth normals need indices. */
function indexed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.index) return geometry;
  const count = geometry.getAttribute("position").count;
  geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  return geometry;
}

/** Pose `scene` at `seconds` into its idle and bake it; `scene` itself is untouched. */
export function bakeMonsterPose(
  scene: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
  seconds = 0,
): BakedMonster {
  const root = cloneSkinned(scene);
  const mixer = new THREE.AnimationMixer(root);
  const idle = idleClip(usableClips(root, clips));
  if (idle) {
    mixer.clipAction(idle).play();
    mixer.update(seconds);
  }
  root.updateMatrixWorld(true);

  const raw: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    raw.push({ geometry: plainCopy(mesh), material });
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(root);

  const box = new THREE.Box3();
  for (const part of raw) {
    part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox!);
  }
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const height = size.y || 1;
  const normalise = new THREE.Matrix4()
    .makeScale(1 / height, 1 / height, 1 / height)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));

  // Untextured materials are flat colours: paint each into its vertices and
  // merge them, so a monster built from several colours (the frog has four,
  // the chicken fifty-five meshes in eleven) is one draw. Textured materials
  // keep their own draw.
  let roughness = 0;
  const painted: THREE.BufferGeometry[] = [];
  const textured = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of raw) {
    part.geometry.applyMatrix4(normalise);
    const flat = part.material as THREE.MeshStandardMaterial;
    if (!flat.map && flat.color) {
      painted.push(paintedCopy(part.geometry, flat.color));
      roughness += flat.roughness ?? 0.6;
      part.geometry.dispose();
    } else {
      textured.set(part.material, [...(textured.get(part.material) ?? []), part.geometry]);
    }
  }
  const buckets: { material: THREE.Material; owned: boolean; list: THREE.BufferGeometry[] }[] = [
    ...textured,
  ].map(([material, list]) => ({ material, owned: false, list }));
  if (painted.length)
    buckets.push({
      material: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: Math.min(0.85, Math.max(0.35, roughness / painted.length)),
        metalness: 0,
      }),
      owned: true,
      list: painted,
    });
  const parts: BakedMonsterPart[] = [];
  const top = new THREE.Vector3();
  let topCount = 0;
  for (const { material, owned, list } of buckets) {
    const signature = (g: THREE.BufferGeometry) => Object.keys(g.attributes).sort().join(",");
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const g of list.map(indexed))
      groups.set(signature(g), [...(groups.get(signature(g)) ?? []), g]);
    for (const same of groups.values()) {
      const merged = same.length === 1 ? same[0]! : mergeGeometries(same, false);
      if (!merged) continue;
      if (merged !== same[0]) for (const g of same) g.dispose();
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      const position = merged.getAttribute("position") as THREE.BufferAttribute;
      for (let index = 0; index < position.count; index += 1) {
        if (position.getY(index) < 0.9) continue;
        top.x += position.getX(index);
        top.z += position.getZ(index);
        topCount += 1;
      }
      parts.push({ geometry: merged, material, owned });
    }
  }
  if (topCount) top.set(top.x / topCount, 1, top.z / topCount);
  else top.set(0, 1, 0);
  let skinned = false;
  scene.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  return { parts, normalise, top, aspect: Math.max(size.x, size.z) / height, skinned };
}

/** Triangles in a baked monster, for the technique lock's budget. */
export function bakedMonsterTriangles(baked: BakedMonster): number {
  return baked.parts.reduce((sum, part) => {
    const g = part.geometry;
    return sum + (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  }, 0);
}

/**
 * The boss's crown (V7: 「戴王冠的大怪」): a gold band with five points and a
 * red gem under each, one unit across, base at y = 0. Flat-shaded and
 * vertex-coloured like the island's own objects.
 */
export function buildCrownGeometry(): THREE.BufferGeometry {
  const gold = new THREE.Color(0xffc83d);
  const gem = new THREE.Color(0xff4d6d);
  const parts: THREE.BufferGeometry[] = [];
  const paint = (geometry: THREE.BufferGeometry, colour: THREE.Color) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.deleteAttribute("uv");
    flat.computeVertexNormals();
    const count = flat.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1)
      colours.set([colour.r, colour.g, colour.b], index * 3);
    flat.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    parts.push(flat);
  };
  const band = new THREE.CylinderGeometry(0.5, 0.46, 0.3, 10, 1, true);
  band.translate(0, 0.15, 0);
  paint(band, gold);
  for (let index = 0; index < 5; index += 1) {
    const a = (index / 5) * Math.PI * 2;
    const spike = new THREE.ConeGeometry(0.13, 0.34, 4);
    spike.translate(Math.sin(a) * 0.48, 0.47, Math.cos(a) * 0.48);
    paint(spike, gold);
    const stone = new THREE.OctahedronGeometry(0.07, 0);
    stone.translate(Math.sin(a) * 0.5, 0.15, Math.cos(a) * 0.5);
    paint(stone, gem);
  }
  const crown = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!crown) throw new Error("crown geometry did not merge");
  return crown;
}
