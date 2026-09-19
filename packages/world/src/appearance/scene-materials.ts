/** Product role/lifetime adapter, not a second renderer or material kernel.
 * RenderKit owns clay response; cached GLTF and AvatarKit materials stay borrowed.
 */
import * as THREE from "three";
import { createClaySurfaceAdapter } from "@pieai/swimmer-render-kit/clay";
import type { WorldStyle } from "@pieai/university-core";

type Surface = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
type MaterialSet = THREE.Material | THREE.Material[];
export type AppearanceRole = "scenery" | "terrain" | "avatar" | "cloud" | "water";
const ROLES = {
  scenery: { scale: 1.5, relief: 0.12, pigment: 1 },
  terrain: { scale: 0.65, relief: 0.16, pigment: 0.8 },
  avatar: { scale: 4.0, relief: 0.035, pigment: 0.7 },
  cloud: { scale: 2.2, relief: 0.06, pigment: 0.45 },
  water: { scale: 0.9, relief: 0.09, pigment: 0.8 },
} as const;
interface Entry {
  source: Surface;
  material: Surface;
  version: number;
  seen: number;
}
interface Binding {
  source: MaterialSet;
  shown: MaterialSet;
  slots: readonly THREE.Material[];
  seen: number;
}

function eligible(material: THREE.Material): material is Surface {
  return (
    Boolean((material as Surface).isMeshStandardMaterial) &&
    material.colorWrite &&
    material.opacity > 0 &&
    material.visible
  );
}
function roleOf(node: THREE.Object3D, inherited: AppearanceRole): AppearanceRole {
  if (node.name === "university-avatar-occlusion-target") return "avatar";
  if (/cloud/i.test(node.name)) return "cloud";
  if (/spring|water/i.test(node.name)) return "water";
  if (/island-terrain|globe-surface|planet-surface/.test(node.name)) return "terrain";
  return inherited;
}

/** Copy without JSON-serializing live host uniform/texture graphs in userData. */
function clayCopy(source: Surface, role: AppearanceRole): Surface {
  const view = Object.create(source) as Surface;
  view.userData = {};
  const material = (source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial().copy(view as THREE.MeshPhysicalMaterial)
    : new THREE.MeshStandardMaterial().copy(view);
  const clay = createClaySurfaceAdapter(ROLES[role]);
  material.name = `${source.name || source.type}/colored-clay`;
  material.userData = {
    ...source.userData,
    worldAppearance: { style: "clay", role, source: source.uuid },
    clay: clay.uniforms,
  };
  // Disable extra physical lobes on the clone, never on the kit-owned source.
  if ((material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const physical = material as THREE.MeshPhysicalMaterial;
    physical.clearcoat = 0;
    physical.sheen = 0;
    physical.iridescence = 0;
    physical.transmission = 0;
    physical.anisotropy = 0;
  }
  const program = source.customProgramCacheKey();
  material.customProgramCacheKey = () => `${program}/${clay.customProgramCacheKey()}/${role}`;
  material.onBeforeCompile = (shader, renderer) => {
    source.onBeforeCompile.call(material, shader, renderer);
    clay.onBeforeCompile(shader);
  };
  material.onBeforeRender = source.onBeforeRender;
  return material;
}

/** One owner per existing canvas. Reconcile before its normal draw, including
 * asynchronously loaded meshes; never rebuild a map/avatar when style changes.
 */
export class SceneMaterialAppearance {
  private readonly entries = new Map<Surface, Map<AppearanceRole, Entry>>();
  private readonly bindings = new Map<THREE.Mesh, Binding>();
  private readonly originals = new WeakMap<THREE.Material, Surface>();
  private epoch = 0;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly defaultRole: AppearanceRole = "scenery",
  ) {}

  private resolve(source: THREE.Material, role: AppearanceRole, style: WorldStyle): THREE.Material {
    if (!eligible(source)) return source;
    let variants = this.entries.get(source);
    let entry = variants?.get(role);
    if (entry && entry.version !== source.version) {
      entry.material.dispose();
      variants!.delete(role);
      entry = undefined;
    }
    if (style === "clay" && !entry) {
      variants ??= new Map();
      this.entries.set(source, variants);
      entry = {
        source,
        material: clayCopy(source, role),
        version: source.version,
        seen: this.epoch,
      };
      variants.set(role, entry);
      this.originals.set(entry.material, source);
    }
    if (entry) {
      entry.seen = this.epoch;
      // Host-owned animation/uniform updates remain live without changing the
      // shape, source maps, original style, or clay shader identity.
      entry.material.color.copy(source.color);
      entry.material.emissive.copy(source.emissive);
      entry.material.emissiveIntensity = source.emissiveIntensity;
      entry.material.opacity = source.opacity;
      entry.material.visible = source.visible;
    }
    return style === "clay" && entry ? entry.material : source;
  }

  private sourceOf(current: MaterialSet, binding?: Binding): MaterialSet {
    const slots = Array.isArray(current) ? current : [current];
    if (
      binding &&
      current === binding.shown &&
      slots.length === binding.slots.length &&
      slots.every((material, i) => material === binding.slots[i])
    )
      return binding.source;
    // A host may replace one array slot in place. Recover our unchanged slots
    // but keep the new slot, rather than resurrecting the previous array.
    const recovered = slots.map((material) => this.originals.get(material) ?? material);
    if (recovered.every((material, i) => material === slots[i])) return current;
    return Array.isArray(current) ? recovered : recovered[0]!;
  }

  reconcile(style: WorldStyle): void {
    this.epoch++;
    let eligibleCount = 0,
      styledCount = 0;
    const visit = (node: THREE.Object3D, inherited: AppearanceRole) => {
      const role = roleOf(node, inherited);
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        let binding = this.bindings.get(mesh);
        if (binding && mesh.material !== binding.shown) {
          // R3F/GLTF/AvatarKit replaced this material; do not put an old source
          // back over a new host decision when returning to classic.
          this.bindings.delete(mesh);
          binding = undefined;
        }
        const source = this.sourceOf(mesh.material, binding);
        const originals = Array.isArray(source) ? source : [source];
        const next = originals.map((material) => {
          if (eligible(material)) eligibleCount++;
          const result = this.resolve(material, role, style);
          if (result !== material) styledCount++;
          return result;
        });
        const changed = next.some((material, i) => material !== originals[i]);
        let shown: MaterialSet = source;
        if (changed) {
          if (Array.isArray(source)) {
            const previous = binding?.shown;
            shown =
              Array.isArray(previous) && next.every((m, i) => m === previous[i]) ? previous : next;
          } else shown = next[0]!;
        }
        if (mesh.material !== shown) mesh.material = shown;
        if (changed || binding)
          this.bindings.set(mesh, {
            source,
            shown,
            slots: Array.isArray(shown) ? [...shown] : [shown],
            seen: this.epoch,
          });
      }
      for (const child of node.children) visit(child, role);
    };
    visit(this.scene, this.defaultRole);
    for (const [mesh, binding] of this.bindings) {
      if (binding.seen === this.epoch) continue;
      mesh.material = this.sourceOf(mesh.material, binding);
      this.bindings.delete(mesh);
    }
    let materialCount = 0;
    for (const [source, variants] of this.entries) {
      for (const [role, entry] of variants) {
        if (entry.seen === this.epoch) {
          materialCount++;
          continue;
        }
        entry.material.dispose();
        variants.delete(role);
      }
      if (!variants.size) this.entries.delete(source);
    }
    this.scene.userData.worldAppearance = { style, eligibleCount, styledCount, materialCount };
  }

  dispose(): void {
    for (const [mesh, binding] of this.bindings)
      mesh.material = this.sourceOf(mesh.material, binding);
    this.bindings.clear();
    for (const variants of this.entries.values())
      for (const entry of variants.values()) entry.material.dispose();
    this.entries.clear();
    delete this.scene.userData.worldAppearance;
  }
}
