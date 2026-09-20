/** Reversible views of existing scenery. No placement or terrain changes. */
import * as THREE from "three";
import { roundStoneUpper } from "./clay-stone.js";
export type ClayGeometryKind = "lobe" | "stone" | "foliage";

/** Avoid JSON-serializing live resources in source userData. */
export function copyGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const view = Object.create(source) as THREE.BufferGeometry;
  view.userData = {};
  return new THREE.BufferGeometry().copy(view);
}

export function clayGeometryView(source: THREE.BufferGeometry, kind: ClayGeometryKind) {
  const position = source.getAttribute("position");
  if (!position || position.itemSize !== 3 || position.count > 100_000)
    throw new RangeError("Clay requires bounded three-component positions");
  for (let i = 0; i < position.count; i++)
    if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite))
      throw new RangeError("Clay vertices must be finite");
  if (source.index) {
    if (source.index.count % 3) throw new RangeError("Clay requires triangle indices");
    for (let i = 0; i < source.index.count; i++) {
      const id = source.index.getX(i);
      if (!Number.isInteger(id) || id < 0 || id >= position.count)
        throw new RangeError("Clay index lies outside its source");
    }
  }
  const result = (kind === "stone" ? roundStoneUpper(source) : null) ?? copyGeometry(source);
  if (kind === "lobe") pressLobe(result);
  result.computeVertexNormals();
  if (kind !== "lobe") softenPlanes(result, kind === "stone" ? 0.65 : 0.8);
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.name = `${source.name || "scenery"}/polymer-${kind}`;
  result.userData = { ...source.userData, claySourceGeometry: source.uuid, clayGeometryKind: kind };
  return result;
}

/** Preserve every lower contact vertex; the two upper hand presses move inward only. */
function pressLobe(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute("position");
  const a = new THREE.Vector3(0.4, 0.6, 0.7).normalize();
  const b = new THREE.Vector3(-0.65, 0.5, -0.4).normalize();
  const p = new THREE.Vector3(),
    direction = new THREE.Vector3();
  const cap = (value: number) => {
    const t = THREE.MathUtils.clamp((value - 0.65) / 0.35, 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    if (p.y <= 0) continue;
    direction.copy(p).normalize();
    const pressure =
      (0.038 * cap(direction.dot(a)) + 0.022 * cap(direction.dot(b))) * Math.min(1, p.y / 0.3);
    p.multiplyScalar(1 - pressure);
    position.setXYZ(i, p.x, p.y, p.z);
  }
}

/** Blend adjoining light normals, not positions, and keep sharp returns. */
function softenPlanes(geometry: THREE.BufferGeometry, amount: number): void {
  const position = geometry.getAttribute("position"),
    original = geometry.getAttribute("normal");
  const keys: string[] = [],
    groups = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map((v) => Math.round(v * 100_000))
      .join("/");
    keys.push(key);
    const members = groups.get(key) ?? [];
    members.push(i);
    groups.set(key, members);
  }
  const data = new Float32Array(position.count * 3);
  const current = new THREE.Vector3(),
    other = new THREE.Vector3(),
    sum = new THREE.Vector3();
  const crease = Math.cos((75 * Math.PI) / 180);
  for (let i = 0; i < position.count; i++) {
    current.fromBufferAttribute(original, i).normalize();
    sum.set(0, 0, 0);
    const members = groups.get(keys[i]!)!;
    // Malformed coincident buckets must not cause quadratic preparation.
    if (members.length <= 64)
      for (const j of members) {
        other.fromBufferAttribute(original, j).normalize();
        if (current.dot(other) >= crease) sum.add(other);
      }
    if (sum.lengthSq() > 1e-12) current.lerp(sum.normalize(), amount).normalize();
    current.toArray(data, i * 3);
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(data, 3));
}
