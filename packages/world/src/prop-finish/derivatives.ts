import * as THREE from "three";
import { copySurface, softSculptedNormals, softSculptedSurface } from "./surface-refinement.js";
import {
  encodeGeometry,
  type EncodedGeometry,
  type SourceModel,
  type SourcePart,
} from "./source-models.js";
import type { PropFinish, PropId } from "./catalog.js";
import { addCraftedDetail } from "./crafted-surface.js";

export interface DerivativeFile {
  version: 2;
  id: PropId;
  sourceSignatures: string[];
  visibilitySize: number;
  bevel: EncodedGeometry[];
  occlusion: EncodedGeometry[];
  recipe: {
    blender: string;
    bevelWidth: number;
    segments: number;
    samples: number;
    radius: number;
  };
}
type PackedChannel = { offset: number; length: number };
type PackedGeometry = Record<string, PackedChannel>;
export interface PackedDerivative extends Omit<DerivativeFile, "version" | "bevel" | "occlusion"> {
  version: 3;
  bufferBytes: number;
  bufferSha256: string;
  bevel: PackedGeometry[];
  occlusion: PackedGeometry[];
}
/** Fixed paths come from the allow-listed object ID, never from this metadata.
 * Reject stale/corrupt assets before creating GPU objects. */
export async function unpackDerivative(
  metadata: PackedDerivative,
  buffer: ArrayBuffer,
): Promise<DerivativeFile> {
  if (
    metadata?.version !== 3 ||
    metadata.bufferBytes !== buffer.byteLength ||
    buffer.byteLength > 12_000_000 ||
    !Array.isArray(metadata.bevel) ||
    !Array.isArray(metadata.occlusion) ||
    metadata.bevel.length > 32 ||
    metadata.occlusion.length > 32
  )
    throw new Error("Invalid packed object metadata");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== metadata.bufferSha256)
    throw new Error("Derived object checksum mismatch; regenerate the object");
  const channels = new Set([
    "position",
    "normal",
    "uv",
    "color",
    "index",
    "visibilityUv",
    "grainAxis",
  ]);
  const unpack = (parts: PackedGeometry[]) =>
    parts.map((part) => {
      const result: Record<string, number[]> = {};
      for (const [key, range] of Object.entries(part)) {
        if (
          !channels.has(key) ||
          !range ||
          !Number.isSafeInteger(range.offset) ||
          !Number.isSafeInteger(range.length) ||
          range.offset < 0 ||
          range.offset % 4 ||
          range.length < 1 ||
          range.offset + range.length * 4 > buffer.byteLength
        )
          throw new Error(`Invalid packed channel ${key}`);
        result[key] = Array.from(
          key === "index"
            ? new Uint32Array(buffer, range.offset, range.length)
            : new Float32Array(buffer, range.offset, range.length),
        );
      }
      return result as unknown as EncodedGeometry;
    });
  return {
    ...metadata,
    version: 2,
    bevel: unpack(metadata.bevel),
    occlusion: unpack(metadata.occlusion),
  };
}
/** Float32/index hash catches stale bakes without serializing UUIDs or lighting. */
export function geometrySignature(g: THREE.BufferGeometry): string {
  let hash = 2166136261;
  const add = (data: ArrayBufferView) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  };
  const e = encodeGeometry(g);
  for (const key of ["position", "normal", "uv", "color"] as const)
    if (e[key]) add(new Float32Array(e[key]));
  add(new Uint32Array(e.index));
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function decodeGeometry(e: EncodedGeometry): THREE.BufferGeometry {
  const count = e.position?.length / 3;
  if (
    !Number.isInteger(count) ||
    count < 3 ||
    count > 200000 ||
    e.normal?.length !== count * 3 ||
    !e.index?.length ||
    e.index.length % 3
  )
    throw new Error("Invalid derived geometry dimensions");
  for (const [key, values] of Object.entries(e)) {
    if (!Array.isArray(values) || !values.every(Number.isFinite))
      throw new Error(`Invalid geometry channel ${key}`);
  }
  if (e.index.some((i) => !Number.isInteger(i) || i < 0 || i >= count))
    throw new Error("Invalid derived index");
  if ((e.uv && e.uv.length !== count * 2) || (e.color && e.color.length !== count * 3))
    throw new Error("Invalid derived attribute");
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(e.position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(e.normal, 3));
  if (e.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(e.uv, 2));
  if (e.color) g.setAttribute("color", new THREE.Float32BufferAttribute(e.color, 3));
  if (e.visibilityUv) {
    if (e.visibilityUv.length !== count * 2) throw new Error("Invalid visibility UV");
    g.setAttribute("visibilityUv", new THREE.Float32BufferAttribute(e.visibilityUv, 2));
  }
  if (e.grainAxis) {
    if (e.grainAxis.length !== count || e.grainAxis.some((v) => ![0, 1, 2].includes(v)))
      throw new Error("Invalid grain direction");
    g.setAttribute("grainAxis", new THREE.Float32BufferAttribute(e.grainAxis, 1));
  }
  g.setIndex(e.index);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
export function validateDerivative(model: SourceModel, data: DerivativeFile): void {
  if (
    !data ||
    !Number.isSafeInteger(data.visibilitySize) ||
    data.visibilitySize < 16 ||
    data.visibilitySize > 2048 ||
    data.visibilitySize & (data.visibilitySize - 1)
  )
    throw new Error("Invalid surface atlas size");
  if (
    data.version !== 2 ||
    data.id !== model.sample.id ||
    data.sourceSignatures?.length !== model.parts.length ||
    data.bevel?.length !== model.parts.length ||
    data.occlusion?.length !== model.parts.length
  )
    throw new Error("Derivative does not match this map object");
  model.parts.forEach((p, i) => {
    if (geometrySignature(p.geometry) !== data.sourceSignatures[i])
      throw new Error(
        `Stale derivative: ${model.sample.id}/${i}. Rebuild from the current map adapter.`,
      );
  });
}
export function localVisibilitySurface(
  source: THREE.MeshStandardMaterial,
  visibility: THREE.Texture,
) {
  const m = copySurface(source);
  const hook = source.onBeforeCompile;
  m.name = `${source.name}/baked-local-visibility`;
  const diagnostic = { value: 0 };
  m.userData = { ...m.userData, propFinishDiagnostic: diagnostic };
  m.onBeforeCompile = (shader, renderer) => {
    hook.call(m, shader, renderer);
    shader.uniforms.uPropVisibility = { value: visibility };
    shader.uniforms.uFinishDiagnostic = diagnostic;
    const anchor = "#include <aomap_fragment>";
    if (
      !shader.fragmentShader.includes(anchor) ||
      !shader.vertexShader.includes("#include <begin_vertex>")
    )
      throw new Error("Visibility finish requires pinned Three indirect-light chunks");
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 visibilityUv;\nvarying vec2 vVisibilityUv;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvVisibilityUv=visibilityUv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uPropVisibility;\nuniform float uFinishDiagnostic;\nvarying vec2 vVisibilityUv;",
      )
      .replace(
        anchor,
        `${anchor}\n// Only indirect light is occluded. No painted shadow, no whole-color multiply.\nfloat vPropVisibility=texture2D(uPropVisibility,vVisibilityUv).r;\nreflectedLight.indirectDiffuse *= max(0.12, vPropVisibility);\nreflectedLight.indirectSpecular *= clamp(vPropVisibility + roughnessFactor * 0.15, 0.12, 1.0);`,
      );
  };
  const surfaceHook = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    surfaceHook(shader, renderer);
    if (!shader.fragmentShader.includes("#include <opaque_fragment>"))
      throw new Error("Missing diagnostic output anchor");
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if(uFinishDiagnostic>0.5) outgoingLight=texture2D(uPropVisibility,vVisibilityUv).rgb;\n#include <opaque_fragment>",
    );
  };
  m.customProgramCacheKey = () => `${source.customProgramCacheKey()}/object-visibility-v1`;
  return m;
}
export interface PreparedModel {
  readonly source: SourceModel;
  readonly parts: Record<PropFinish, readonly SourcePart[]>;
  dispose(): void;
}
export function prepareModel(
  source: SourceModel,
  data: DerivativeFile,
  visibility: THREE.Texture,
): PreparedModel {
  validateDerivative(source, data);
  const role = source.sample.tree
    ? "plant"
    : source.sample.id.startsWith("rock")
      ? "stone"
      : "prop";
  const made: SourcePart[] = [];
  try {
    const build = (finish: Exclude<PropFinish, "original">) =>
      source.parts.map((p, i) => {
        const isWater = p.material.transparent || p.material.opacity < 1;
        const geometry = isWater
          ? p.geometry.clone()
          : finish === "sculpted"
            ? softSculptedNormals(p.geometry)
            : decodeGeometry((finish === "bevel" ? data.bevel : data.occlusion)[i]!);
        const material =
          finish === "sculpted"
            ? softSculptedSurface(p.material, role)
            : finish === "crafted" && !isWater
              ? localVisibilitySurface(p.material, visibility)
              : copySurface(p.material);
        if (finish === "crafted" && !isWater) addCraftedDetail(material, source.sample.id);
        if (finish === "bevel" && !isWater) material.flatShading = false;
        const part = { geometry, material, name: p.name };
        made.push(part);
        return part;
      });
    const parts = {
      original: source.parts,
      sculpted: build("sculpted"),
      bevel: build("bevel"),
      crafted: build("crafted"),
    };
    let disposed = false;
    return {
      source,
      parts,
      dispose() {
        if (disposed) return;
        disposed = true;
        visibility.dispose();
        made.forEach((p) => {
          p.geometry.dispose();
          p.material.dispose();
        });
      },
    };
  } catch (e) {
    made.forEach((p) => {
      p.geometry.dispose();
      p.material.dispose();
    });
    throw e;
  }
}
