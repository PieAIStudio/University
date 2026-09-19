import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { SceneGeometryAppearance } from "./scene-geometry.js";
import { clayGeometryView } from "./clay-geometry.js";
import { createSmoothIcosahedron } from "../island/foliage-geometry.js";

const setup = () => {
  const scene = new THREE.Scene();
  const source = createSmoothIcosahedron(1, 1.2);
  const mesh = new THREE.InstancedMesh(source, new THREE.MeshStandardMaterial(), 2);
  mesh.name = "course-bush-crowns";
  scene.add(mesh);
  return { scene, source, mesh, owner: new SceneGeometryAppearance(scene) };
};

describe("reversible clay asset views", () => {
  it("retains exact classic buffers, support vertices and instance transforms", () => {
    const { source, mesh, owner } = setup();
    const p = source.getAttribute("position");
    const before = p.array.slice(),
      indices = source.index!.array.slice();
    const instances = mesh.instanceMatrix.array.slice();
    source.userData.self = source;
    owner.reconcile("classic");
    expect(owner.inspect().ownedGeometries).toBe(0);
    owner.reconcile("clay");
    const view = mesh.geometry,
      q = view.getAttribute("position");
    expect(view).not.toBe(source);
    expect(view.index!.count).toBe(source.index!.count);
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) <= 0) {
        expect([q.getX(i), q.getY(i), q.getZ(i)]).toEqual([p.getX(i), p.getY(i), p.getZ(i)]);
      }
      expect(Math.hypot(q.getX(i), q.getY(i), q.getZ(i))).toBeLessThanOrEqual(
        Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) + 1e-6,
      );
    }
    for (let i = 0; i < 30; i++) {
      owner.reconcile("classic");
      expect(mesh.geometry).toBe(source);
      owner.reconcile("clay");
      expect(mesh.geometry).toBe(view);
    }
    expect(p.array).toEqual(before);
    expect(source.index!.array).toEqual(indices);
    expect(mesh.instanceMatrix.array).toEqual(instances);
    expect(owner.sourceOf(mesh)).toBe(source);
    const sourceDispose = vi.fn(),
      viewDispose = vi.fn();
    source.addEventListener("dispose", sourceDispose);
    view.addEventListener("dispose", viewDispose);
    owner.dispose();
    owner.dispose();
    expect(mesh.geometry).toBe(source);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(viewDispose).toHaveBeenCalledTimes(1);
    delete source.userData.self;
    source.dispose();
    mesh.material.dispose();
  });
  it("releases departed views and respects host replacement before cleanup", () => {
    const { scene, source, mesh, owner } = setup();
    owner.reconcile("clay");
    const first = mesh.geometry,
      disposed = vi.fn();
    first.addEventListener("dispose", disposed);
    const replacement = source.clone();
    mesh.geometry = replacement;
    owner.reconcile("clay");
    expect(owner.sourceOf(mesh)).toBe(replacement);
    expect(disposed).toHaveBeenCalledTimes(1);
    const second = mesh.geometry,
      freed = vi.fn();
    second.addEventListener("dispose", freed);
    scene.remove(mesh);
    owner.reconcile("clay");
    expect(mesh.geometry).toBe(replacement);
    expect(freed).toHaveBeenCalledTimes(1);
    expect(owner.inspect().ownedGeometries).toBe(0);
    scene.add(mesh);
    owner.reconcile("clay");
    mesh.geometry = source;
    owner.dispose();
    expect(mesh.geometry).toBe(source);
    source.dispose();
    replacement.dispose();
    mesh.material.dispose();
  });
  it("invalidates changed source data while leaving terrain and avatar geometry alone", () => {
    const { scene, mesh, source, owner } = setup();
    const terrain = new THREE.Mesh(source, mesh.material);
    terrain.name = "island-terrain";
    const avatar = new THREE.Mesh(source, mesh.material);
    avatar.name = "body";
    scene.add(terrain, avatar);
    owner.reconcile("clay");
    const first = mesh.geometry;
    source.getAttribute("position").needsUpdate = true;
    owner.reconcile("clay");
    expect(mesh.geometry).not.toBe(first);
    expect(terrain.geometry).toBe(source);
    expect(avatar.geometry).toBe(source);
    owner.reconcile("classic");
    expect(mesh.geometry).toBe(source);
    owner.dispose();
    source.dispose();
    mesh.material.dispose();
  });
  it("does not transfer ownership between independent canvases", () => {
    const { mesh, source, owner } = setup();
    const scene = new THREE.Scene(),
      other = new THREE.Mesh(source, mesh.material);
    other.name = mesh.name;
    scene.add(other);
    const peer = new SceneGeometryAppearance(scene);
    owner.reconcile("clay");
    peer.reconcile("clay");
    expect(mesh.geometry).not.toBe(other.geometry);
    owner.dispose();
    expect(other.geometry).not.toBe(source);
    peer.dispose();
    expect(other.geometry).toBe(source);
    source.dispose();
    mesh.material.dispose();
  });
  it("rejects malformed positions and indices before allocating a view", () => {
    const source = createSmoothIcosahedron(1, 1.2);
    source.getAttribute("position").setX(0, NaN);
    expect(() => clayGeometryView(source, "lobe")).toThrow(/finite/);
    source.getAttribute("position").setX(0, 0);
    source.index!.setX(0, source.getAttribute("position").count + 1);
    expect(() => clayGeometryView(source, "stone")).toThrow(/outside/);
    source.dispose();
  });
});
