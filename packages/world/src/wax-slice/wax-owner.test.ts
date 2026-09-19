import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { WaxSliceOwner, waxNormals } from "./wax-owner.js";
import { createWaxSurface, WAX_PROGRAM } from "./wax-surface.js";

describe("reversible wax slice", () => {
  it("derives normals without moving a single vertex or destroying map coordinates", () => {
    const source = new THREE.BoxGeometry(2, 1, 3),
      before = source.attributes.normal!.array.slice();
    const copy = waxNormals(source);
    expect(copy).not.toBe(source);
    expect(copy.attributes.position!.array).toEqual(source.attributes.position!.array);
    expect(copy.attributes.uv!.array).toEqual(source.attributes.uv!.array);
    expect(copy.index!.array).toEqual(source.index!.array);
    expect(source.attributes.normal!.array).toEqual(before);
    expect(copy.attributes.normal!.array).not.toEqual(before);
    copy.dispose();
    source.dispose();
  });
  it("restores the exact original material and geometry, and never disposes borrowed resources", () => {
    const map = new THREE.Texture(),
      source = new THREE.MeshPhysicalMaterial({ map, clearcoat: 0.7, roughness: 0.2 });
    const geometry = new THREE.BoxGeometry();
    const root = new THREE.Group(),
      mesh = new THREE.Mesh(geometry, source);
    root.add(mesh);
    const borrowed = vi.fn();
    source.addEventListener("dispose", borrowed);
    geometry.addEventListener("dispose", borrowed);
    map.addEventListener("dispose", borrowed);
    const owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    const first = mesh.material,
      shape = mesh.geometry,
      dispose = vi.fn();
    first.addEventListener("dispose", dispose);
    expect(first).not.toBe(source);
    expect(first.map).toBe(map);
    expect(first.clearcoat).toBe(0);
    expect(source.clearcoat).toBe(0.7);
    expect(source.roughness).toBe(0.2);
    for (let i = 0; i < 10; i++) {
      owner.reconcile(false);
      expect(mesh.material).toBe(source);
      expect(mesh.geometry).toBe(geometry);
      owner.reconcile(true);
      expect(mesh.material).toBe(first);
      expect(mesh.geometry).toBe(shape);
    }
    expect(owner.report.materials).toBe(1);
    owner.dispose();
    owner.dispose();
    expect(mesh.material).toBe(source);
    expect(mesh.geometry).toBe(geometry);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(borrowed).not.toHaveBeenCalled();
  });
  it("preserves cyclic host userData, shader hooks, texture identity and animation color", () => {
    const source = new THREE.MeshStandardMaterial();
    source.userData.self = source.userData;
    const hook = vi.fn();
    source.onBeforeCompile = hook;
    const root = new THREE.Group(),
      mesh = new THREE.Mesh(new THREE.SphereGeometry(), source);
    root.add(mesh);
    const owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    const shader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as THREE.WebGLProgramParametersWithUniforms;
    mesh.material.onBeforeCompile(shader, null as never);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(shader.fragmentShader).toContain("waxScattering");
    expect(shader.fragmentShader).toContain("#include <tonemapping_fragment>");
    expect(shader.fragmentShader).toContain("#include <colorspace_fragment>");
    expect(mesh.material.customProgramCacheKey()).toContain(WAX_PROGRAM);
    source.color.setHex(0x125678);
    owner.reconcile(true, 0.6);
    expect(mesh.material.color).toEqual(source.color);
    expect(mesh.material.userData.waxSlice.uniforms.uWaxStrength.value).toBe(0.6);
    owner.dispose();
  });
  it("handles late models and host material replacement, and releases detached copies", () => {
    const root = new THREE.Group(),
      owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    expect(owner.report.styled).toBe(0);
    const source = new THREE.MeshStandardMaterial(),
      mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    root.add(mesh);
    owner.reconcile(true);
    const replacement = new THREE.MeshStandardMaterial();
    mesh.material = replacement;
    owner.reconcile(false);
    expect(mesh.material).toBe(replacement);
    owner.reconcile(true);
    root.remove(mesh);
    owner.reconcile(true);
    expect(mesh.material).toBe(replacement);
    expect(owner.report.materials).toBe(0);
    owner.dispose();
  });
  it("never changes another scene sharing the same model, or background and hit materials", () => {
    const source = new THREE.MeshStandardMaterial(),
      geometry = new THREE.BoxGeometry();
    const root = new THREE.Group(),
      a = new THREE.Mesh(geometry, source),
      b = new THREE.Mesh(geometry, source);
    root.add(a);
    const hidden = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ colorWrite: false }));
    root.add(hidden);
    const sky = new THREE.Mesh(geometry, source);
    sky.name = "sky-dome";
    root.add(sky);
    const owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    expect(b.material).toBe(source);
    expect(b.geometry).toBe(geometry);
    expect(sky.material).toBe(source);
    expect(owner.report.styled).toBe(1);
    owner.dispose();
  });
  it("supports material arrays and never reuses an outdated shader variant", () => {
    const root = new THREE.Group(),
      source = new THREE.MeshStandardMaterial(),
      mesh = new THREE.Mesh(new THREE.BoxGeometry(), [source, source]);
    root.add(mesh);
    const originals = mesh.material,
      owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    expect(mesh.material[0]).toBe(mesh.material[1]);
    const old = mesh.material[0];
    source.needsUpdate = true;
    owner.reconcile(true);
    expect(mesh.material[0]).not.toBe(old);
    owner.reconcile(false);
    expect(mesh.material).toBe(originals);
    owner.dispose();
  });
  it("keeps a host's in-place material slot replacement on restore", () => {
    const root = new THREE.Group(),
      a = new THREE.MeshStandardMaterial(),
      b = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [a, a]);
    root.add(mesh);
    const owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    mesh.material[1] = b;
    owner.reconcile(true);
    owner.reconcile(false);
    expect(mesh.material[0]).toBe(a);
    expect(mesh.material[1]).toBe(b);
    owner.dispose();
  });
  it("does not resurrect an old array slot when the host unmounts before the next frame", () => {
    const root = new THREE.Group(),
      a = new THREE.MeshStandardMaterial(),
      b = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [a, a]);
    root.add(mesh);
    const owner = new WaxSliceOwner(root);
    owner.reconcile(true);
    mesh.material[1] = b;
    owner.dispose();
    expect(mesh.material[0]).toBe(a);
    expect(mesh.material[1]).toBe(b);
  });
  it("keeps the source response as the strength blend origin and clamps invalid input", () => {
    const source = new THREE.MeshPhysicalMaterial({
      roughness: 0.18,
      metalness: 0.3,
      clearcoat: 0.8,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const owner = new WaxSliceOwner(mesh);
    owner.reconcile(true, 0.3);
    const material = mesh.material;
    expect(material.roughness).toBe(0.18);
    expect(material.metalness).toBe(0.3);
    expect(material.clearcoat).toBe(0);
    expect(material.userData.waxSlice.uniforms.uWaxRoughness.value).toBe(0.8);
    expect(material.userData.waxSlice.uniforms.uWaxStrength.value).toBe(0.3);
    owner.reconcile(true, 8);
    expect(material.userData.waxSlice.uniforms.uWaxStrength.value).toBe(1);
    owner.reconcile(true, -2);
    expect(material.userData.waxSlice.uniforms.uWaxStrength.value).toBe(0);
    owner.reconcile(true, Number.NaN);
    expect(material.userData.waxSlice.uniforms.uWaxStrength.value).toBe(1);
    owner.dispose();
    expect(mesh.material).toBe(source);
  });
  it("rejects a missing physical-response anchor even when other lighting chunks exist", () => {
    const { material } = createWaxSurface(new THREE.MeshStandardMaterial(), "prop");
    expect(() =>
      material.onBeforeCompile(
        {
          vertexShader: THREE.ShaderLib.standard.vertexShader,
          fragmentShader: THREE.ShaderLib.standard.fragmentShader.replace(
            "#include <lights_physical_fragment>",
            "",
          ),
          uniforms: {},
        } as THREE.WebGLProgramParametersWithUniforms,
        null as never,
      ),
    ).toThrow(/pinned Three/);
    material.dispose();
  });
  it("fails visibly for unsupported shader chunks, instead of calling the style successful", () => {
    const { material } = createWaxSurface(new THREE.MeshStandardMaterial(), "prop");
    expect(() =>
      material.onBeforeCompile(
        {
          vertexShader: "",
          fragmentShader: "",
          uniforms: {},
        } as THREE.WebGLProgramParametersWithUniforms,
        null as never,
      ),
    ).toThrow(/pinned Three/);
    material.dispose();
  });
});
