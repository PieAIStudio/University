import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import {
  COURSE_BATCHED_MATERIAL_ROUGHNESS,
  islandDressingCourseBatches,
  islandDressingFields,
  isCourseBatchableOpaqueUntexturedSrc,
  type IslandDressingField,
} from "./island-dressing-render.js";
import { isIslandFoliagePlacement } from "./island-foliage-render.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(here, "../../../../apps/university/public");

interface GlbPrimitive {
  readonly attributes?: Readonly<Record<string, number>>;
  readonly material?: number;
  readonly extensions?: {
    readonly KHR_draco_mesh_compression?: {
      readonly attributes?: Readonly<Record<string, number>>;
    };
  };
}

interface GlbMaterial {
  readonly name?: string;
  readonly pbrMetallicRoughness?: {
    readonly baseColorFactor?: readonly number[];
    readonly baseColorTexture?: unknown;
    readonly metallicFactor?: number;
    readonly roughnessFactor?: number;
    readonly metallicRoughnessTexture?: unknown;
  };
  readonly emissiveFactor?: readonly number[];
  readonly emissiveTexture?: unknown;
  readonly normalTexture?: unknown;
  readonly occlusionTexture?: unknown;
  readonly alphaMode?: string;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

interface GlbJson {
  readonly images?: readonly unknown[];
  readonly textures?: readonly unknown[];
  readonly materials?: readonly GlbMaterial[];
  readonly meshes?: readonly { readonly primitives?: readonly GlbPrimitive[] }[];
}

function parseGlbJson(path: string): GlbJson {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")) as GlbJson;
}

function attributeNames(primitive: GlbPrimitive): string[] {
  return [
    ...Object.keys(primitive.attributes ?? {}),
    ...Object.keys(primitive.extensions?.KHR_draco_mesh_compression?.attributes ?? {}),
  ];
}

function inspectOpaqueUntexturedBatchContract(json: GlbJson): {
  readonly compatible: boolean;
  readonly reasons: readonly string[];
  readonly roughnesses: readonly number[];
} {
  const reasons: string[] = [];
  if ((json.images?.length ?? 0) > 0 || (json.textures?.length ?? 0) > 0) {
    reasons.push("textures");
  }
  const materials = json.materials ?? [];
  const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const roughnesses: number[] = [];
  for (const primitive of primitives) {
    if (attributeNames(primitive).includes("COLOR_0")) {
      // COLOR_0 is allowed; the baker multiplies it with the factor.
    }
    const materialIndex = primitive.material;
    if (materialIndex === undefined) {
      reasons.push("default-metallic-material");
      roughnesses.push(1);
      continue;
    }
    const material = materials[materialIndex];
    if (!material) {
      reasons.push("missing-material");
      continue;
    }
    const pbr = material.pbrMetallicRoughness ?? {};
    const alpha = pbr.baseColorFactor?.[3] ?? 1;
    const metallic = pbr.metallicFactor ?? 1;
    const roughness = pbr.roughnessFactor ?? 1;
    const emissive = material.emissiveFactor ?? [0, 0, 0];
    roughnesses.push(roughness);
    if ((material.alphaMode ?? "OPAQUE") !== "OPAQUE" || alpha < 1) reasons.push("alpha");
    if (pbr.baseColorTexture || pbr.metallicRoughnessTexture) reasons.push("pbr-texture");
    if (material.emissiveTexture || material.normalTexture || material.occlusionTexture) {
      reasons.push("extra-texture");
    }
    if (metallic !== 0) reasons.push("metallic");
    if (emissive.some((channel) => channel !== 0)) reasons.push("emissive");
    if (material.extensions && Object.keys(material.extensions).length > 0) {
      reasons.push("material-extension");
    }
  }
  const floors = roughnesses.map((value) => Math.max(0.72, value));
  if (floors.some((value) => value !== floors[0])) {
    reasons.push("mixed-roughness");
  }
  return { compatible: reasons.length === 0, reasons: [...new Set(reasons)], roughnesses };
}

function placementField(
  pack: IslandDressingField["pack"],
  src: string,
  count: number,
): IslandDressingField {
  return {
    key: `${pack}/${src}`,
    pack,
    src,
    at: Array.from({ length: count }, (_, index) => ({
      position: new THREE.Vector3(index, 0, 0),
      height: 1,
      turn: 0,
    })),
  };
}

function countAt(fields: readonly { readonly at: readonly unknown[] }[]): number {
  return fields.reduce((total, field) => total + field.at.length, 0);
}

describe("course dressing batch grouping", () => {
  it("keeps every non-foliage placement in batched or fallback, never both", () => {
    const blueprint = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const plan = planIslandDressing(blueprint, "course");
    const fields = islandDressingFields(plan, 1);
    const batches = islandDressingCourseBatches(fields);
    const fieldCount = countAt(fields);
    expect(fieldCount).toBe(
      plan.placements.filter((placement) => !isIslandFoliagePlacement(placement)).length,
    );
    expect(countAt(batches.batched) + countAt(batches.fallback)).toBe(fieldCount);
    const batchedSrcs = new Set(batches.batched.map((field) => field.src));
    const fallbackSrcs = new Set(batches.fallback.map((field) => field.src));
    expect([...batchedSrcs].some((src) => fallbackSrcs.has(src))).toBe(false);
    expect(batches.fallback.some((field) => field.pack === "nature-kit")).toBe(true);
    expect(batches.batched.some((field) => field.src.includes("nature"))).toBe(false);
  });

  it("batches only opaque untextured camp/bridge and falls back incompatible contracts", () => {
    const fields = [
      placementField("nature-kit", "/kenney/r01/nature/tree_oak.glb", 4),
      placementField("elemental-serenity", "/models/elemental-serenity/camp.glb", 2),
      placementField("elemental-serenity", "/models/elemental-serenity/tent.glb", 3),
      placementField("elemental-serenity", "/models/elemental-serenity/rocks.glb", 5),
      placementField("elemental-serenity", "/models/elemental-serenity/bridge.glb", 1),
      placementField("fantasy-town-kit", "/kenney/r01/fantasy-town/fountain-round.glb", 2),
    ];
    const batches = islandDressingCourseBatches(fields);
    expect(countAt(batches.batched) + countAt(batches.fallback)).toBe(17);
    expect(batches.batched.map((field) => field.src).sort()).toEqual([
      "/models/elemental-serenity/bridge.glb",
      "/models/elemental-serenity/camp.glb",
    ]);
    expect(countAt(batches.batched)).toBe(3);
    expect(batches.fallback.map((field) => field.src).sort()).toEqual([
      "/kenney/r01/fantasy-town/fountain-round.glb",
      "/kenney/r01/nature/tree_oak.glb",
      "/models/elemental-serenity/rocks.glb",
      "/models/elemental-serenity/tent.glb",
    ]);
  });
});

describe("elemental GLB batch contracts", () => {
  const cases = [
    ["/models/elemental-serenity/camp.glb", true],
    ["/models/elemental-serenity/bridge.glb", true],
    ["/models/elemental-serenity/tent.glb", false],
    ["/models/elemental-serenity/rocks.glb", false],
    ["/models/elemental-serenity/treeTrunks.glb", false],
    ["/kenney/r01/fantasy-town/fountain-round.glb", false],
    ["/kenney/r01/nature/tree_oak.glb", false],
  ] as const;

  it("allowlists only GLBs whose JSON is opaque, untextured, dielectric, uniform roughness", () => {
    for (const [src, expected] of cases) {
      const json = parseGlbJson(resolve(publicRoot, src.replace(/^\/+/, "")));
      const inspect = inspectOpaqueUntexturedBatchContract(json);
      expect(inspect.compatible, `${src}: ${inspect.reasons.join(",")}`).toBe(expected);
      expect(isCourseBatchableOpaqueUntexturedSrc(src)).toBe(expected);
      if (expected) {
        const floors = inspect.roughnesses.map((value) => Math.max(0.72, value));
        expect(new Set(floors)).toEqual(new Set([COURSE_BATCHED_MATERIAL_ROUGHNESS]));
      }
    }
  });
});

describe("course batching source", () => {
  it("does not depend on private SCRATCH paths", () => {
    const render = readFileSync(resolve(here, "island-dressing-render.tsx"), "utf8");
    const testSource = readFileSync(resolve(here, "island-dressing-batching.test.ts"), "utf8");
    expect(render).not.toMatch(/SCRATCH\//);
    expect(testSource).not.toMatch(/from ["'][^"']*SCRATCH\//);
    expect(render).toMatch(/useMemo\(\(\) => islandDressingCourseBatches\(fields\), \[fields\]\)/);
    expect(render).not.toMatch(/colorSource="family"/);
  });
});
