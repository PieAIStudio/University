import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { SceneMaterialAppearance } from "./scene-materials.js";
const setup = () => {
  const scene = new THREE.Scene();
  const source = new THREE.MeshPhysicalMaterial({ color: 0x65984e, clearcoat: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
  scene.add(mesh);
  return { scene, source, mesh, owner: new SceneMaterialAppearance(scene) };
};
describe("reversible borrowed material presentation", () => {
  it("changes only material pointers and preserves source resources/hooks", () => {
    const { scene, source, mesh, owner } = setup();
    const geometry = mesh.geometry,
      vertices = geometry.attributes.position!.array.slice();
    source.userData.self = source; // Live resource graphs must not be JSON cloned.
    const texture = new THREE.Texture();
    source.map = texture;
    const hook = vi.fn((shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.host = { value: 7 };
    });
    source.onBeforeCompile = hook;
    owner.reconcile("clay");
    const clay = mesh.material;
    expect(clay).not.toBe(source);
    expect(clay.map).toBe(texture);
    expect(source.clearcoat).toBe(1);
    expect(clay.clearcoat).toBe(0);
    const shader = {
      vertexShader: THREE.ShaderLib.physical.vertexShader,
      fragmentShader: THREE.ShaderLib.physical.fragmentShader,
      uniforms: {},
    } as THREE.WebGLProgramParametersWithUniforms;
    clay.onBeforeCompile(shader, null as never);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(shader.uniforms.host).toEqual({ value: 7 });
    expect(shader.fragmentShader).toContain("swimmer-clay-surface-v1");
    for (let i = 0; i < 20; i++) {
      owner.reconcile("classic");
      expect(mesh.material).toBe(source);
      owner.reconcile("clay");
      expect(mesh.material).toBe(clay);
    }
    expect(mesh.geometry).toBe(geometry);
    expect(geometry.attributes.position!.array).toEqual(vertices);
    expect(scene.userData.worldAppearance.materialCount).toBe(1);
    const sourceDisposal = vi.fn(),
      textureDisposal = vi.fn(),
      clayDisposal = vi.fn();
    source.addEventListener("dispose", sourceDisposal);
    texture.addEventListener("dispose", textureDisposal);
    clay.addEventListener("dispose", clayDisposal);
    owner.dispose();
    expect(mesh.material).toBe(source);
    expect(clayDisposal).toHaveBeenCalledTimes(1);
    expect(sourceDisposal).not.toHaveBeenCalled();
    expect(textureDisposal).not.toHaveBeenCalled();
    owner.dispose();
    expect(clayDisposal).toHaveBeenCalledTimes(1);
    delete source.userData.self;
    geometry.dispose();
    source.dispose();
    texture.dispose();
  });
  it("includes late arrivals but excludes invisible picking and unlit feedback", () => {
    const { scene, source, mesh, owner } = setup();
    owner.reconcile("clay");
    const hit = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshStandardMaterial({ opacity: 0, transparent: true }),
    );
    const glow = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial());
    scene.add(hit, glow);
    const hitOriginal = hit.material,
      glowOriginal = glow.material;
    const newcomer = new THREE.Mesh(mesh.geometry, source);
    scene.add(newcomer);
    owner.reconcile("clay");
    expect(newcomer.material).toBe(mesh.material);
    expect(hit.material).toBe(hitOriginal);
    expect(glow.material).toBe(glowOriginal);
    owner.dispose();
  });
  it("releases departed entries and preserves host replacements", () => {
    const { scene, mesh, owner } = setup();
    owner.reconcile("clay");
    const old = mesh.material;
    const disposed = vi.fn();
    old.addEventListener("dispose", disposed);
    const replacement = new THREE.MeshStandardMaterial();
    mesh.material = replacement as THREE.MeshPhysicalMaterial;
    owner.reconcile("classic");
    expect(mesh.material).toBe(replacement);
    expect(disposed).toHaveBeenCalledTimes(1);
    owner.reconcile("clay");
    scene.remove(mesh);
    owner.reconcile("clay");
    expect(mesh.material).toBe(replacement);
    expect(scene.userData.worldAppearance.materialCount).toBe(0);
    owner.dispose();
  });
  it("preserves in-place array replacements, including an unmount before another frame", () => {
    const scene = new THREE.Scene();
    const a = new THREE.MeshStandardMaterial(),
      b = new THREE.MeshStandardMaterial();
    const replacement = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [a, b]);
    scene.add(mesh);
    const owner = new SceneMaterialAppearance(scene);
    owner.reconcile("clay");
    mesh.material[1] = replacement;
    owner.reconcile("clay");
    owner.reconcile("classic");
    expect(mesh.material).toEqual([a, replacement]);
    owner.reconcile("clay");
    mesh.material[0] = b;
    owner.dispose();
    expect(mesh.material).toEqual([b, replacement]);
    mesh.geometry.dispose();
    a.dispose();
    b.dispose();
    replacement.dispose();
  });
  it("isolates shared source materials between different canvases", () => {
    const { mesh, source, owner } = setup();
    const second = new THREE.Scene(),
      peer = new THREE.Mesh(mesh.geometry, source);
    second.add(peer);
    const other = new SceneMaterialAppearance(second, "avatar");
    owner.reconcile("clay");
    other.reconcile("classic");
    expect(peer.material).toBe(source);
    other.reconcile("clay");
    expect(peer.material).not.toBe(mesh.material);
    owner.dispose();
    expect(peer.material).not.toBe(source);
    other.dispose();
    expect(peer.material).toBe(source);
  });
});
