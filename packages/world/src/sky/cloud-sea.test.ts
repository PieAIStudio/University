import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  CLOUD_LAYOUT_CONTRACT,
  CLOUD_CARRIER_FOOT_OFFSET,
  CUTE_CLOUD_BATCH_NAMES,
  CUTE_CLOUD_CONTRACT,
  cloudHorizontalFootprint,
  cloudCarrierHome,
  cloudCarrierClearance,
  cloudPuffs,
  cloudSafeCorridorRadius,
  cuteCloudLayout,
  updateCloudCarrierInstances,
} from "./cloud-sea.js";
import {
  CLOUD_BANK_SUPPORT_HEIGHT,
  CLOUD_VOLUME_CONTRACT,
  createCloudVolumeGeometry,
  createCloudVolumeParts,
} from "./cloud-volume.js";
import { createCloudMaterials } from "./cloud-material.js";

/**
 * Source with comments removed.
 *
 * These assertions count material declarations, and the modules they read
 * explain themselves at length — including by naming the very material class
 * the rule forbids. Matching raw text counts the prose too, which is how the
 * first version of this gate failed on a file that was entirely correct.
 */
function code(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Every module that draws a cloud. Both must take the shared material. */
const CLOUD_CALLERS = ["./cloud-sea.tsx", "../grid/GridCloudLayers.tsx"] as const;

describe("cute cloud sea", () => {
  it("keeps moved carrier bounds current without rewriting colours or adding instances", () => {
    const layout = cuteCloudLayout(40, -5.2, "desktop");
    const parts = createCloudVolumeParts(32, 9);
    const materials = createCloudMaterials();
    const upper = new THREE.InstancedMesh(parts.crown, materials.crown, layout.puffs.length);
    const lower = new THREE.InstancedMesh(
      parts.underbelly,
      materials.underbelly,
      layout.puffs.length,
    );
    const scratch = new THREE.Object3D();
    for (const mesh of [upper, lower]) {
      layout.lobes.forEach((bank, index) => {
        scratch.position.set(...bank.position);
        scratch.rotation.set(0, bank.rotationY, 0);
        scratch.scale.set(...bank.scale);
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        mesh.setColorAt(index, new THREE.Color(bank.color));
      });
      mesh.computeBoundingSphere();
    }
    const oldSphere = upper.boundingSphere!.clone();
    const oldColour = upper.instanceColor!.array.slice();
    const neighbour = new THREE.Matrix4();
    upper.getMatrixAt(0, neighbour);
    const firstMatrix = neighbour.clone();
    const carrier = layout.lobes.at(-1)!;
    const destination = new THREE.Vector3(
      carrier.position[0] + 200,
      carrier.position[1] + 15,
      carrier.position[2] + 180,
    );
    expect(oldSphere.containsPoint(destination)).toBe(false);
    updateCloudCarrierInstances(upper, lower, layout, 200, 15, 180, scratch);
    for (const mesh of [upper, lower]) {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(mesh.count - 1, matrix);
      expect(
        new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(destination),
      ).toBeLessThan(1e-5);
      expect(mesh.boundingSphere!.containsPoint(destination)).toBe(true);
      expect(mesh.count).toBe(layout.puffs.length);
    }
    upper.getMatrixAt(0, neighbour);
    expect(neighbour).toEqual(firstMatrix);
    expect(upper.instanceColor!.array).toEqual(oldColour);
    expect(upper.geometry).toBe(parts.crown);
    expect(lower.geometry).toBe(parts.underbelly);
    expect(upper.material).toBe(materials.crown);
    expect(lower.material).toBe(materials.underbelly);
    upper.dispose();
    lower.dispose();
    parts.crown.dispose();
    parts.underbelly.dispose();
    materials.crown.dispose();
    materials.underbelly.dispose();
  });

  it("keeps a deterministic sculpted layout for each quality tier", () => {
    const desktop = cuteCloudLayout(40, -5.2, "desktop");
    const desktopAgain = cuteCloudLayout(40, -5.2, "desktop");
    const mobile = cuteCloudLayout(40, -5.2, "mobile");

    expect(desktop).toEqual(desktopAgain);
    expect(desktop.puffs).toHaveLength(CUTE_CLOUD_CONTRACT.desktopPuffCount);
    expect(mobile.puffs).toHaveLength(CUTE_CLOUD_CONTRACT.mobilePuffCount);
    expect(mobile.lobes.length).toBeLessThan(desktop.lobes.length);
    expect(new Set(desktop.puffs.map((puff) => puff.clusterIndex))).toHaveLength(
      CUTE_CLOUD_CONTRACT.compositionClusterCount,
    );
  });

  it("uses the last existing puff as the carrier home, without adding a puff", () => {
    const layout = cuteCloudLayout(40, -5.2, "desktop");
    const carrier = layout.puffs.at(-1)!;
    const home = cloudCarrierHome(40, -5.2, "desktop");

    expect(layout.puffs).toHaveLength(CUTE_CLOUD_CONTRACT.desktopPuffCount);
    expect(home).toEqual([
      carrier.position[0],
      carrier.position[1] + CLOUD_CARRIER_FOOT_OFFSET,
      carrier.position[2],
    ]);
  });

  it("uses one continuous bank with complementary opaque surface batches per puff", () => {
    const layout = cuteCloudLayout(40, -5.2, "desktop");

    expect(layout.lobes).toHaveLength(layout.puffs.length * CUTE_CLOUD_CONTRACT.upperLobesPerPuff);
    expect(layout.underbellies).toHaveLength(layout.puffs.length);
    expect(CUTE_CLOUD_CONTRACT.totalOpaqueLobesPerPuff).toBe(1);
    expect(layout.lobes).toHaveLength(layout.puffs.length);
    expect(layout.underbellies).toEqual(layout.lobes);
    expect(CUTE_CLOUD_CONTRACT.drawBatches).toBe(2);
    expect(CUTE_CLOUD_CONTRACT.opaque).toBe(true);
    expect(new Set(layout.lobes.map((lobe) => lobe.color)).size).toBeGreaterThan(1);
    expect(layout.underbellies.every((belly) => belly.color !== 0xffffff)).toBe(true);
    expect(
      new Set(layout.lobes.slice(0, 24).map((lobe) => lobe.scale.join(","))).size,
    ).toBeGreaterThan(1);
  });

  it("limits phone geometry while retaining the shared rounded-bank silhouette", () => {
    const desktop = cuteCloudLayout(40, -5.2, "desktop");
    const mobile = cuteCloudLayout(40, -5.2, "mobile");
    const desktopHeight = desktop.lobes[5]!.scale[1];
    const mobileHeight = mobile.lobes[5]!.scale[1];

    expect(CUTE_CLOUD_CONTRACT.mobileSegments.width).toBeLessThan(
      CUTE_CLOUD_CONTRACT.desktopSegments.width,
    );
    expect(CUTE_CLOUD_CONTRACT.mobileSegments.height).toBeLessThan(
      CUTE_CLOUD_CONTRACT.desktopSegments.height,
    );
    expect(desktopHeight).toBeGreaterThan(0);
    expect(mobileHeight).toBeGreaterThan(0);
    for (const tier of ["desktop", "mobile"] as const) {
      const segments =
        tier === "desktop"
          ? CUTE_CLOUD_CONTRACT.desktopSegments
          : CUTE_CLOUD_CONTRACT.mobileSegments;
      const geometry = createCloudVolumeGeometry(segments.width, segments.height);
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.y).toBeGreaterThan(0.4);
      // R44 replaces the old flat-bank art proportion, not its physical
      // clearance, carrier support, instance counts or closed-shell tests.
      expect(size.y / size.x).toBeGreaterThan(0.35);
      expect(size.y / size.x).toBeLessThan(CLOUD_VOLUME_CONTRACT.verticalAspectMax);
      geometry.dispose();
    }
  });

  it("uses finite outward sculpture normals at every cloud detail level", () => {
    const supports: number[][] = [];
    for (const [width, height] of [
      [9, 3],
      [20, 6],
      [32, 9],
    ]) {
      const geometry = createCloudVolumeGeometry(width!, height!);
      try {
        const positions = geometry.getAttribute("position"),
          normals = geometry.getAttribute("normal");
        const point = new THREE.Vector3(),
          normal = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i);
          normal.fromBufferAttribute(normals, i);
          if (
            !normal.toArray().every(Number.isFinite) ||
            Math.abs(normal.length() - 1) > 1e-5 ||
            normal.dot(point) <= 0
          )
            throw new Error(`Invalid bank normal ${width}/${height}/${i}`);
        }
        supports.push(new THREE.Vector3().fromBufferAttribute(normals, 0).toArray());
      } finally {
        geometry.dispose();
      }
    }
    expect(supports[0]).toEqual(supports[1]);
    expect(supports[1]).toEqual(supports[2]);
  });

  it("keeps every sculpted crown below the turf contract", () => {
    for (const quality of ["desktop", "mobile"] as const) {
      const segments =
        quality === "desktop"
          ? CUTE_CLOUD_CONTRACT.desktopSegments
          : CUTE_CLOUD_CONTRACT.mobileSegments;
      const geometry = createCloudVolumeGeometry(segments.width, segments.height);
      for (const level of [-5.2, 3]) {
        const layout = cuteCloudLayout(40, level, quality);
        for (const bank of layout.lobes) {
          const source = layout.puffs[bank.puffIndex]!;
          // The source is no longer a unit sphere. Measure its actual crown,
          // retaining the original 1.12-per-scale / below-turf thresholds.
          const top = bank.position[1] + geometry.boundingBox!.max.y * bank.scale[1];
          expect(top).toBeLessThan(
            source.position[1] + source.scale * CUTE_CLOUD_CONTRACT.crownHeightPerScale + 1e-9,
          );
          expect(top).toBeLessThan(-CLOUD_LAYOUT_CONTRACT.turfClearance);
        }
      }
      geometry.dispose();
    }
  });

  it("keeps each complete cloud footprint outside the central play corridor", () => {
    for (const extent of [12, 40, 80]) {
      for (const puff of cloudPuffs(extent, false, -5.2)) {
        const driftMargin = Math.max(extent * 0.035, 0.7);
        const centreDistance = Math.hypot(puff.position[0], puff.position[2]);
        expect(centreDistance).toBeGreaterThanOrEqual(
          cloudSafeCorridorRadius(extent) +
            cloudHorizontalFootprint(puff.scale) +
            driftMargin -
            1e-9,
        );
      }
    }
  });

  it("uses six designed framing clusters with two background masses and one near edge", () => {
    const puffs = cloudPuffs(40, false, -5.2);
    const clusters = new Set(puffs.map((puff) => puff.clusterIndex));
    const backgroundClusters = new Set(
      puffs.filter((puff) => puff.role === "background").map((puff) => puff.clusterIndex),
    );
    const nearEdge = puffs.filter((puff) => puff.role === "near-edge");

    expect(clusters).toHaveLength(CLOUD_LAYOUT_CONTRACT.compositionClusterCount);
    expect(backgroundClusters).toHaveLength(CLOUD_LAYOUT_CONTRACT.backgroundClusterCount);
    expect(nearEdge.length).toBeGreaterThan(0);
    // The world road camera looks toward -Z, so the near-edge cluster remains
    // on that authored camera-facing arc rather than drifting behind the eye.
    expect(nearEdge.every((puff) => puff.position[2] < 0)).toBe(true);
    expect(
      puffs.filter((puff) => puff.role === "background").every((puff) => puff.position[2] < 0),
    ).toBe(true);
    expect(
      nearEdge.reduce((sum, puff) => sum + Math.hypot(puff.position[0], puff.position[2]), 0) /
        nearEdge.length,
    ).toBeLessThan(
      puffs
        .filter((puff) => puff.role === "background")
        .reduce((sum, puff) => sum + Math.hypot(puff.position[0], puff.position[2]), 0) /
        puffs.filter((puff) => puff.role === "background").length,
    );
    expect(
      Math.min(...puffs.filter((puff) => puff.role === "background").map((puff) => puff.scale)),
    ).toBeGreaterThan(
      Math.max(...puffs.filter((puff) => puff.role === "frame").map((puff) => puff.scale)),
    );
    expect(new Set(puffs.map((puff) => puff.scale.toFixed(3))).size).toBeGreaterThan(6);
  });

  it("renders exactly two named InstancedMesh batches", () => {
    const source = readFileSync(new URL("./cloud-sea.tsx", import.meta.url), "utf8");
    expect(CUTE_CLOUD_BATCH_NAMES).toEqual(["cute-cloud-upper", "cute-cloud-underbelly"]);
    expect(CUTE_CLOUD_CONTRACT.drawBatches).toBe(2);
    expect(CUTE_CLOUD_CONTRACT.batchNames).toEqual(CUTE_CLOUD_BATCH_NAMES);
    expect(source.match(/<instancedMesh\b/g)).toHaveLength(CUTE_CLOUD_CONTRACT.drawBatches);
    expect(source).not.toMatch(/RayMarchMaterial|raymarchShader|volumeCloud/i);
  });

  it("keeps tier geometry cleanup separate from stable shared material cleanup", () => {
    const source = code("./cloud-sea.tsx");
    const cleanups = Array.from(
      source.matchAll(/useLayoutEffect\(\s*\(\) => \(\) => \{([\s\S]*?)\},\s*\[([^\]]*)\],?\s*\)/g),
    );
    const geometry = cleanups.find((match) => match[1]!.includes("upperGeometry.dispose()"));
    const materials = cleanups.find((match) => match[1]!.includes("upperMaterial.dispose()"));
    expect(geometry).toBeDefined();
    expect(materials).toBeDefined();
    expect(geometry![1]).toContain("lowerGeometry.dispose()");
    expect(geometry![1]).not.toContain("Material.dispose()");
    expect(materials![1]).toContain("lowerMaterial.dispose()");
    expect(materials![2]).not.toMatch(/geometry/i);
    expect(geometry).not.toBe(materials);
  });

  /*
   * These three used to read `cloud-sea.tsx` and count its two inline
   * materials. They now read the module that owns the answer, and they check
   * the far more useful thing: that it is the *only* module that does.
   *
   * The defect that prompted it shipped for months. Both cloud fields built
   * the same 3D body, and the course island's field then drew it with an
   * unlit, semi-transparent, single-tone `MeshBasicMaterial` — so a modelled
   * cloud rendered as a paper cut-out, and none of the island's lighting work
   * reached it. Nothing failed, because no test asked whether the two agreed.
   */
  it("keeps one lit material pair for every cloud in the product", () => {
    const shared = code("./cloud-material.ts");
    // One factory, two actual owned materials for the catalogue; course and
    // globe use the single-material entry and no longer leak an unused belly.
    expect(shared.match(/new THREE\.MeshStandardMaterial/g)).toHaveLength(1);
    const materials = createCloudMaterials();
    expect(materials.crown).not.toBe(materials.underbelly);
    for (const material of Object.values(materials)) {
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.vertexColors).toBe(true);
      expect(material.transparent).toBe(false);
      expect(material.map).toBeNull();
      material.dispose();
    }
    for (const file of CLOUD_CALLERS) {
      const source = code(file);
      expect(source, file).toMatch(/createCloudMaterials?\(/);
      // An unlit or bespoke cloud material anywhere is the defect returning.
      expect(source, file).not.toMatch(/MeshBasicMaterial|MeshStandardMaterial/);
    }
  });

  it("depth-tests after the opaque scene without contributing cloud depth to AO", () => {
    expect(CUTE_CLOUD_CONTRACT.renderOrder).toEqual({ underbelly: 3, upper: 4 });
    const materials = createCloudMaterials();
    for (const material of Object.values(materials)) {
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(false);
      material.dispose();
    }
    for (const file of CLOUD_CALLERS) {
      const source = code(file);
      // A negative renderOrder draws before the opaque pass, which is only
      // survivable while a cloud is transparent. Solid clouds must sort after.
      expect(source, file).not.toMatch(/renderOrder=\{-[^}]+\}/);
    }
  });

  it("uses one closed low-poly volume with a baked value ramp", () => {
    const geometry = createCloudVolumeGeometry(
      CLOUD_VOLUME_CONTRACT.courseSegments.width,
      CLOUD_VOLUME_CONTRACT.courseSegments.height,
      CLOUD_VOLUME_CONTRACT.courseForm,
    );
    const position = geometry.getAttribute("position");
    const colour = geometry.getAttribute("color");
    expect(CLOUD_VOLUME_CONTRACT.closedSurface).toBe(true);
    expect(CLOUD_VOLUME_CONTRACT.usesVertexValueRamp).toBe(true);
    expect(position.count).toBeGreaterThan(0);
    expect(colour.count).toBe(position.count);
    expect((geometry.index?.count ?? 0) / 3).toBeLessThanOrEqual(37);
    expect(geometry.groups).toHaveLength(0);
    expect(geometry.userData.cloudVolume).toEqual(CLOUD_VOLUME_CONTRACT);
    expect(Math.min(...Array.from(position.array as ArrayLike<number>))).toBeLessThan(-0.5);
    expect(Math.max(...Array.from(position.array as ArrayLike<number>))).toBeGreaterThan(0.5);
    geometry.dispose();
  });

  it.each(["desktop", "mobile"] as const)(
    "retains the %s carrier's feet and full horizontal/vertical safety envelope",
    (quality) => {
      const segments =
        quality === "desktop"
          ? CUTE_CLOUD_CONTRACT.desktopSegments
          : CUTE_CLOUD_CONTRACT.mobileSegments;
      const geometry = createCloudVolumeGeometry(segments.width, segments.height);
      const position = geometry.getAttribute("position");
      for (const extent of [1, 12, 40, 120, 400]) {
        const layout = cuteCloudLayout(extent, -5.2, quality);
        const feet = cloudCarrierHome(extent, -5.2, quality);
        const clearance = cloudCarrierClearance(extent, -5.2, quality);
        expect(CLOUD_CARRIER_FOOT_OFFSET).toBe(1.55);
        expect(clearance).toBeGreaterThan(CLOUD_CARRIER_FOOT_OFFSET);
        for (const bank of layout.lobes) {
          const puff = layout.puffs[bank.puffIndex]!;
          const carrier = bank.puffIndex === layout.puffs.length - 1;
          const transform = new THREE.Matrix4().compose(
            new THREE.Vector3(...bank.position),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bank.rotationY),
            new THREE.Vector3(...bank.scale),
          );
          for (let index = 0; index < position.count; index += 1) {
            const vertex = new THREE.Vector3()
              .fromBufferAttribute(position, index)
              .applyMatrix4(transform);
            expect(
              Math.hypot(vertex.x - puff.position[0], vertex.z - puff.position[2]),
            ).toBeLessThanOrEqual(cloudHorizontalFootprint(puff.scale));
            if (carrier)
              expect(vertex.y).toBeGreaterThanOrEqual(
                feet[1] - clearance + CLOUD_LAYOUT_CONTRACT.turfClearance,
              );
          }
          if (carrier) {
            const support = new THREE.Vector3(0, CLOUD_BANK_SUPPORT_HEIGHT, 0).applyMatrix4(
              transform,
            );
            expect(support.distanceTo(new THREE.Vector3(...feet))).toBeLessThan(1e-10);
            // The exact rendered crown, including its coarsest LOD, supports
            // the avatar; it is not merely a point copied into the metadata.
            const renderedSupport = new THREE.Vector3()
              .fromBufferAttribute(position, 0)
              .applyMatrix4(transform);
            expect(renderedSupport.distanceTo(support)).toBeLessThan(1e-6);
          }
        }
      }
      geometry.dispose();
    },
  );

  it.each([
    ["desktop", 32, 9, 9, 4608],
    ["mobile", 20, 6, 6, 1200],
  ] as const)(
    "keeps the %s surface split seamless and under the previous submitted triangle budget",
    (_quality, width, height, count, expected) => {
      const whole = createCloudVolumeGeometry(width, height);
      const parts = createCloudVolumeParts(width, height);
      const combined = [...parts.crown.index!.array, ...parts.underbelly.index!.array];
      expect(combined).toEqual(Array.from(whole.index!.array));
      expect((combined.length / 3) * count).toBe(expected);
      expect(expected).toBeLessThan(_quality === "desktop" ? 14112 : 3780);
      for (const attribute of ["position", "normal", "color"]) {
        expect(parts.crown.getAttribute(attribute).array).toEqual(
          parts.underbelly.getAttribute(attribute).array,
        );
        expect(parts.crown.getAttribute(attribute).array).not.toBe(
          parts.underbelly.getAttribute(attribute).array,
        );
      }
      const materials = createCloudMaterials();
      expect(materials.crown.color).toEqual(materials.underbelly.color);
      expect(materials.crown.emissive).toEqual(materials.underbelly.emissive);
      expect(materials.crown.emissiveIntensity).toBe(materials.underbelly.emissiveIntensity);
      expect(materials.crown.roughness).toBe(materials.underbelly.roughness);
      whole.dispose();
      parts.crown.dispose();
      parts.underbelly.dispose();
      materials.crown.dispose();
      materials.underbelly.dispose();
    },
  );
});
