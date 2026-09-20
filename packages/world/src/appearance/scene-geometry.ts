import type * as THREE from "three";
import type { WorldStyle } from "@pieai/university-core";
import { clayGeometryView, type ClayGeometryKind } from "./clay-geometry.js";

const TARGETS: Readonly<Record<string, ClayGeometryKind>> = {
  "course-bush-crowns": "lobe",
  "course-rock-outcrops": "stone",
  "course-fir-trees": "foliage",
  "course-broadleaf-trees": "foliage",
};
type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const version = (attribute: Attribute) =>
  "data" in attribute ? attribute.data.version : attribute.version;
const buffersOf = (geometry: THREE.BufferGeometry) =>
  [
    ...(geometry.index ? [["index", geometry.index] as const] : []),
    ...Object.entries(geometry.attributes),
  ].map(([name, attribute]) => ({ name, attribute, version: version(attribute) }));
const topologyOf = (geometry: THREE.BufferGeometry) =>
  JSON.stringify([
    geometry.drawRange.start,
    geometry.drawRange.count,
    geometry.groups,
    geometry.userData.clayStoneRanges ?? null,
    geometry.userData.clayStoneContacts ?? null,
  ]);
interface View {
  readonly source: THREE.BufferGeometry;
  readonly shown: THREE.BufferGeometry;
  readonly kind: ClayGeometryKind;
  readonly buffers: ReturnType<typeof buffersOf>;
  readonly topology: string;
  seen: number;
}
const unchanged = (view: View) => {
  const current = buffersOf(view.source);
  return (
    topologyOf(view.source) === view.topology &&
    current.length === view.buffers.length &&
    current.every((entry, i) => {
      const prior = view.buffers[i]!;
      return (
        entry.name === prior.name &&
        entry.attribute === prior.attribute &&
        entry.version === prior.version
      );
    })
  );
};

/** One cached display view per named near-field mesh. Sources stay borrowed. */
export class SceneGeometryAppearance {
  private readonly views = new Map<THREE.Mesh, View>();
  private epoch = 0;
  constructor(private readonly scene: THREE.Scene) {}
  sourceOf(mesh: THREE.Mesh): THREE.BufferGeometry {
    const view = this.views.get(mesh);
    return view && mesh.geometry === view.shown ? view.source : mesh.geometry;
  }
  reconcile(style: WorldStyle): void {
    this.epoch++;
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const source = this.sourceOf(mesh);
      const kind =
        (mesh as THREE.SkinnedMesh).isSkinnedMesh || Object.keys(source.morphAttributes).length
          ? undefined
          : TARGETS[mesh.name];
      let view = this.views.get(mesh);
      if (view && (!kind || view.kind !== kind || source !== view.source || !unchanged(view))) {
        if (mesh.geometry === view.shown) mesh.geometry = view.source;
        view.shown.dispose();
        this.views.delete(mesh);
        view = undefined;
      }
      if (!kind) return;
      if (style === "clay" && !view) {
        view = {
          source,
          shown: clayGeometryView(source, kind),
          kind,
          buffers: buffersOf(source),
          topology: topologyOf(source),
          seen: this.epoch,
        };
        this.views.set(mesh, view);
      }
      if (view) {
        view.seen = this.epoch;
        mesh.geometry = style === "clay" ? view.shown : view.source;
      }
    });
    for (const [mesh, view] of this.views) {
      if (view.seen === this.epoch) continue;
      if (mesh.geometry === view.shown) mesh.geometry = view.source;
      view.shown.dispose();
      this.views.delete(mesh);
    }
  }
  inspect() {
    return {
      ownedGeometries: this.views.size,
      ownedVertices: [...this.views.values()].reduce(
        (n, view) => n + view.shown.getAttribute("position").count,
        0,
      ),
    };
  }
  dispose(): void {
    for (const [mesh, view] of this.views) {
      if (mesh.geometry === view.shown) mesh.geometry = view.source;
      view.shown.dispose();
    }
    this.views.clear();
  }
}
