import * as THREE from "three";
import {
  createWaxSurface,
  isWaxSurface,
  waxRole,
  type WaxRole,
  type WaxSurface,
} from "./wax-surface.js";

type MaterialSet = THREE.Material | THREE.Material[];
type Variant = ReturnType<typeof createWaxSurface> & {
  source: WaxSurface;
  version: number;
  seen: number;
};
interface Binding {
  source: MaterialSet;
  shown: MaterialSet;
  slots: readonly THREE.Material[];
  geometry: THREE.BufferGeometry;
  shownGeometry: THREE.BufferGeometry;
  seen: number;
}

/** A normal-only derived asset: no displaced ground, different route or collider.
 * Coincident vertex normals soften faceted wax without destroying UV/color seams.
 */
export function waxNormals(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const clone = source.clone();
  const p = clone.getAttribute("position"),
    n = clone.getAttribute("normal");
  if (!p || !n) return clone;
  const sums = new Map<string, THREE.Vector3>();
  const key = (i: number) =>
    `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i),
      v = sums.get(k) ?? new THREE.Vector3();
    v.add(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)));
    sums.set(k, v);
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const average = sums.get(key(i))!.clone().normalize();
    v.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(average, 0.72).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  clone.name = `${source.name}/wax-soft-normals`;
  return clone;
}

/** Owns only this slice's descendants, never a global canvas or cached GLTF.
 * Reconciles asynchronous model arrivals and restores exact source identities.
 * The clay lane's owner is NOT installed alongside this experiment.
 */
export class WaxSliceOwner {
  private variants = new Map<WaxSurface, Map<WaxRole, Variant>>();
  private originals = new WeakMap<THREE.Material, WaxSurface>();
  private geometries = new Map<
    THREE.BufferGeometry,
    { copy: THREE.BufferGeometry; seen: number }
  >();
  private bindings = new Map<THREE.Mesh, Binding>();
  private epoch = 0;
  report = { eligible: 0, styled: 0, materials: 0, derivedGeometries: 0 };
  constructor(private readonly root: THREE.Object3D) {}

  reconcile(enabled: boolean, strength = 1, soften = true, scattering = true) {
    const amount = Number.isFinite(strength) ? THREE.MathUtils.clamp(strength, 0, 1) : 1;
    this.epoch++;
    let eligible = 0,
      styled = 0;
    const visit = (node: THREE.Object3D, parentRole: WaxRole) => {
      // Environment, invisible hit meshes and any diagnostic decoration are not wax subjects.
      if (/sky|distant-ground|aerial-plate|cloud-sea|horizon|sun-disc/.test(node.name)) return;
      const role = waxRole(node.name, parentRole);
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const old = this.bindings.get(mesh);
        const current = mesh.material;
        const currentSlots = Array.isArray(current) ? current : [current];
        const unchanged =
          old &&
          current === old.shown &&
          currentSlots.length === old.slots.length &&
          currentSlots.every((m, i) => m === old.slots[i]);
        const recovered = currentSlots.map((m) => this.originals.get(m) ?? m);
        const source: MaterialSet = unchanged
          ? old.source
          : recovered.every((m, i) => m === currentSlots[i])
            ? current
            : Array.isArray(current)
              ? recovered
              : recovered[0]!;
        const slots = Array.isArray(source) ? source : [source];
        const next = slots.map((m) => {
          if (!isWaxSurface(m)) return m;
          eligible++;
          let byRole = this.variants.get(m);
          let v = byRole?.get(role);
          if (v && v.version !== m.version) {
            v.material.dispose();
            byRole!.delete(role);
            v = undefined;
          }
          if (enabled && !v) {
            byRole ??= new Map();
            this.variants.set(m, byRole);
            v = { ...createWaxSurface(m, role), source: m, version: m.version, seen: this.epoch };
            byRole.set(role, v);
            this.originals.set(v.material, m);
          }
          if (v) {
            v.seen = this.epoch;
            v.uniforms.uWaxStrength.value = amount;
            v.uniforms.uWaxScatteringEnabled.value = scattering ? 1 : 0;
            v.material.color.copy(m.color);
            v.material.emissive.copy(m.emissive);
            v.material.emissiveIntensity = m.emissiveIntensity;
            v.material.opacity = m.opacity;
            v.material.visible = m.visible;
          }
          if (enabled && v) {
            styled++;
            return v.material;
          }
          return m;
        });
        const changed = next.some((m, i) => m !== slots[i]);
        let shown: MaterialSet = source;
        if (changed)
          shown = Array.isArray(source)
            ? old &&
              Array.isArray(old.shown) &&
              old.shown.length === next.length &&
              next.every((m, i) => m === (old.shown as THREE.Material[])[i])
              ? old.shown
              : next
            : next[0]!;
        const sourceGeometry =
          old && mesh.geometry === old.shownGeometry ? old.geometry : mesh.geometry;
        let shape = this.geometries.get(sourceGeometry);
        const shouldSoften =
          enabled &&
          soften &&
          role !== "detail" &&
          !mesh.userData.waxKeepNormals &&
          !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
          mesh.geometry.hasAttribute("normal") &&
          changed;
        if (shouldSoften && !shape) {
          shape = { copy: waxNormals(sourceGeometry), seen: this.epoch };
          this.geometries.set(sourceGeometry, shape);
        }
        if (shape) shape.seen = this.epoch;
        const shownGeometry = shouldSoften && shape ? shape.copy : sourceGeometry;
        mesh.material = shown;
        mesh.geometry = shownGeometry;
        this.bindings.set(mesh, {
          source,
          shown,
          slots: Array.isArray(shown) ? [...shown] : [shown],
          geometry: sourceGeometry,
          shownGeometry,
          seen: this.epoch,
        });
      }
      node.children.forEach((child) => visit(child, role));
    };
    visit(this.root, "prop");
    for (const [mesh, b] of this.bindings)
      if (b.seen !== this.epoch) {
        this.restore(mesh, b);
        this.bindings.delete(mesh);
      }
    for (const [source, roles] of this.variants) {
      for (const [role, v] of roles)
        if (v.seen !== this.epoch) {
          v.material.dispose();
          roles.delete(role);
        }
      if (!roles.size) this.variants.delete(source);
    }
    for (const [source, g] of this.geometries)
      if (g.seen !== this.epoch) {
        g.copy.dispose();
        this.geometries.delete(source);
      }
    this.report = {
      eligible,
      styled,
      materials: [...this.variants.values()].reduce((sum, roles) => sum + roles.size, 0),
      derivedGeometries: this.geometries.size,
    };
  }
  private restore(mesh: THREE.Mesh, b: Binding) {
    const current = mesh.material;
    const slots = Array.isArray(current) ? current : [current];
    if (
      current === b.shown &&
      slots.length === b.slots.length &&
      slots.every((m, i) => m === b.slots[i])
    ) {
      mesh.material = b.source;
    } else {
      // A host may replace one array slot immediately before unmount/cleanup.
      // Recover our borrowed slots without overwriting its newer choice.
      const recovered = slots.map((m) => this.originals.get(m) ?? m);
      if (recovered.some((m, i) => m !== slots[i]))
        mesh.material = Array.isArray(current) ? recovered : recovered[0]!;
    }
    if (mesh.geometry === b.shownGeometry) mesh.geometry = b.geometry;
  }
  dispose() {
    for (const [mesh, b] of this.bindings) this.restore(mesh, b);
    for (const roles of this.variants.values())
      for (const v of roles.values()) v.material.dispose();
    for (const g of this.geometries.values()) g.copy.dispose();
    this.variants.clear();
    this.geometries.clear();
    this.bindings.clear();
  }
}
