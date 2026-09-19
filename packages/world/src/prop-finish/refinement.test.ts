import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { softSculptedNormals, softSculptedSurface, copySurface } from "./surface-refinement.js";
import {
  decodeGeometry,
  unpackDerivative,
  validateDerivative,
  localVisibilitySurface,
  type PackedDerivative,
} from "./derivatives.js";
import { addCraftedDetail } from "./crafted-surface.js";
import { PROP_IDS, FINISH_IDS, parsePropFinish, parsePropId } from "./catalog.js";

const shader = () =>
  ({
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  }) as THREE.WebGLProgramParametersWithUniforms;
const asset = (name: string) =>
  new URL(`../../../../apps/university/public/art/prop-finish/${name}`, import.meta.url);
const hash = (buffer: Uint8Array) => createHash("sha256").update(buffer).digest("hex");

describe("selective surface refinement, not a wax skin", () => {
  it("has ten actual source identities and four independent treatments", () => {
    expect(PROP_IDS).toHaveLength(10);
    expect(new Set(PROP_IDS).size).toBe(10);
    expect(FINISH_IDS).toEqual(["original", "sculpted", "bevel", "crafted"]);
    expect(parsePropId("../../other")).toBe("rock-small");
    expect(parsePropFinish("wax")).toBe("sculpted");
  });
  it("softens shading normals without moving vertices, faces, UV or color", () => {
    const source = new THREE.BoxGeometry(2, 1, 3),
      before = source.attributes.normal!.array.slice();
    const copy = softSculptedNormals(source);
    for (const name of ["position", "uv"])
      expect(copy.getAttribute(name).array).toEqual(source.getAttribute(name).array);
    expect(copy.index!.array).toEqual(source.index!.array);
    expect(source.attributes.normal!.array).toEqual(before);
    expect(copy.attributes.normal!.array).not.toEqual(before);
    expect(softSculptedNormals(source, 0).attributes.normal!.array).toEqual(before);
    expect(() => softSculptedNormals(source, Number.NaN)).toThrow();
    source.dispose();
    copy.dispose();
  });
  it("preserves borrowed maps and live cyclic metadata while removing rejected scattering", () => {
    const map = new THREE.Texture(),
      source = new THREE.MeshPhysicalMaterial({ map, roughness: 0.2, clearcoat: 0.8 });
    source.userData.self = source.userData;
    const hook = vi.fn();
    source.onBeforeCompile = hook;
    const disposed = vi.fn();
    source.addEventListener("dispose", disposed);
    map.addEventListener("dispose", disposed);
    const m = softSculptedSurface(source, "stone");
    const s = shader();
    m.onBeforeCompile(s, null as never);
    expect(hook).toHaveBeenCalledOnce();
    expect(m.map).toBe(map);
    expect(m.color).toEqual(source.color);
    expect((m as THREE.MeshPhysicalMaterial).clearcoat).toBe(0);
    expect(source.clearcoat).toBe(0.8);
    expect(s.fragmentShader).toContain("nonPerturbedNormal");
    expect(s.fragmentShader).not.toContain("waxScattering");
    expect(s.fragmentShader).toContain("#include <tonemapping_fragment>");
    m.dispose();
    expect(disposed).not.toHaveBeenCalled();
  });
  it("leaves transparent water and its authored shading unchanged", () => {
    const source = new THREE.MeshPhysicalMaterial({
      transparent: true,
      opacity: 0.7,
      roughness: 0.12,
      transmission: 0.2,
    });
    const m = softSculptedSurface(source, "prop");
    expect(m.roughness).toBe(source.roughness);
    expect(m.onBeforeCompile).toBe(source.onBeforeCompile);
    m.dispose();
  });
  it("uses real local visibility on indirect light and separates material details from geometry", () => {
    const source = new THREE.MeshStandardMaterial(),
      texture = new THREE.Texture();
    const m = localVisibilitySurface(source, texture);
    addCraftedDetail(m, "cart");
    const s = shader();
    m.onBeforeCompile(s, null as never);
    expect(s.fragmentShader).toContain("reflectedLight.indirectDiffuse *=");
    expect(s.fragmentShader).not.toContain("reflectedLight.directDiffuse *=");
    expect(s.vertexShader).toContain("attribute float grainAxis");
    expect(s.fragmentShader).toContain("(1.0-craftGreen)");
    expect(s.fragmentShader).toContain("grainFade");
    expect(s.fragmentShader).not.toContain("transformed +=");
    expect(source.onBeforeCompile).not.toBe(m.onBeforeCompile);
    m.dispose();
  });
  it("fails visibly when the pinned shader anchors disappear", () => {
    const m = softSculptedSurface(new THREE.MeshStandardMaterial(), "stone");
    expect(() =>
      m.onBeforeCompile(
        {
          vertexShader: "",
          fragmentShader: "",
          uniforms: {},
        } as THREE.WebGLProgramParametersWithUniforms,
        null as never,
      ),
    ).toThrow(/physical shading/);
    m.dispose();
  });
  it("copies the original, not another treatment as its base", () => {
    const source = new THREE.MeshStandardMaterial({ roughness: 0.35, flatShading: true });
    const original = copySurface(source),
      sculpted = softSculptedSurface(source, "prop");
    expect(original.flatShading).toBe(true);
    expect(sculpted.flatShading).toBe(false);
    expect(source.roughness).toBe(0.35);
    original.dispose();
    sculpted.dispose();
    source.dispose();
  });
  it("rejects malformed indices, nonfinite data and invalid shader attributes", () => {
    const g = {
      position: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normal: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      index: [0, 1, 2],
    };
    expect(() => decodeGeometry({ ...g, index: [0, 1, 10] })).toThrow();
    expect(() => decodeGeometry({ ...g, normal: [NaN, ...g.normal.slice(1)] })).toThrow();
    expect(() => decodeGeometry({ ...g, grainAxis: [0, 1, 5] })).toThrow();
  });
  it("verifies compact assets, bounded costs, original triangle counts and map fields for all ten", async () => {
    const manifest = JSON.parse(readFileSync(asset("manifest.json"), "utf8"));
    let bytes = 0;
    for (const id of PROP_IDS) {
      const json = readFileSync(asset(`${id}.json`));
      const meta = JSON.parse(json.toString()) as PackedDerivative;
      const bin = readFileSync(asset(`${id}.bin`)),
        png = readFileSync(asset(`${id}-visibility.png`));
      const record = manifest.objects.find((r: { id: string }) => r.id === id);
      expect(hash(json)).toBe(record.sha256);
      expect(hash(bin)).toBe(record.bufferSha256);
      expect(hash(png)).toBe(record.visibilitySha256);
      const data = await unpackDerivative(
        meta,
        bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
      );
      const originals = data.occlusion.reduce((sum, g) => sum + g.index.length / 3, 0);
      const beveled = data.bevel.reduce((sum, g) => sum + g.index.length / 3, 0);
      expect(originals).toBe(record.originalTriangles);
      expect(beveled).toBe(record.bevelTriangles);
      expect(beveled).toBeGreaterThan(originals);
      expect(beveled).toBeLessThan(originals * 25);
      for (const g of [...data.bevel, ...data.occlusion]) {
        const decoded = decodeGeometry(g);
        expect(decoded.boundingBox!.isEmpty()).toBe(false);
        decoded.dispose();
      }
      for (const g of data.occlusion) {
        expect(g.visibilityUv).toHaveLength((g.position.length / 3) * 2);
        expect(g.grainAxis).toHaveLength(g.position.length / 3);
      }
      bytes += bin.byteLength + png.byteLength + json.byteLength;
    }
    expect(bytes).toBeLessThan(3_600_000);
  });
  it("rejects corruption before GPU allocation rather than silently showing an original as finished", async () => {
    const meta = JSON.parse(readFileSync(asset("rock-small.json"), "utf8"));
    const bin = readFileSync(asset("rock-small.bin"));
    const bytes = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
    new Uint8Array(bytes)[0] ^= 1;
    await expect(unpackDerivative(meta, bytes)).rejects.toThrow(/checksum/);
    expect(() =>
      validateDerivative(
        { sample: { id: "rock-small" }, parts: [] } as never,
        { version: 2, visibilitySize: 3 } as never,
      ),
    ).toThrow();
  });
});
