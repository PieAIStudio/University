import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLOUD_LAYOUT_CONTRACT,
  CLOUD_CARRIER_FOOT_OFFSET,
  CUTE_CLOUD_BATCH_NAMES,
  CUTE_CLOUD_CONTRACT,
  cloudHorizontalFootprint,
  cloudCarrierHome,
  cloudPuffs,
  cloudSafeCorridorRadius,
  cuteCloudLayout,
} from "./cloud-sea.js";
import { CLOUD_VOLUME_CONTRACT, createCloudVolumeGeometry } from "./cloud-volume.js";

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

  it("uses six upper lobes and one opaque warm under-belly per puff", () => {
    const layout = cuteCloudLayout(40, -5.2, "desktop");

    expect(layout.lobes).toHaveLength(layout.puffs.length * CUTE_CLOUD_CONTRACT.upperLobesPerPuff);
    expect(layout.underbellies).toHaveLength(layout.puffs.length);
    expect(CUTE_CLOUD_CONTRACT.totalOpaqueLobesPerPuff).toBe(7);
    expect(CUTE_CLOUD_CONTRACT.drawBatches).toBe(2);
    expect(CUTE_CLOUD_CONTRACT.opaque).toBe(true);
    expect(new Set(layout.lobes.map((lobe) => lobe.color)).size).toBeGreaterThan(1);
    expect(layout.underbellies.every((belly) => belly.color !== 0xffffff)).toBe(true);
    expect(
      new Set(layout.lobes.slice(0, 24).map((lobe) => lobe.scale.join(","))).size,
    ).toBeGreaterThan(1);
  });

  it("limits phone geometry while retaining a rounded vertical silhouette", () => {
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
    expect(desktop.lobes.some((lobe) => lobe.scale[1] > lobe.scale[0] * 0.5)).toBe(true);
  });

  it("keeps every sculpted crown below the turf contract", () => {
    const layout = cuteCloudLayout(40, -5.2, "desktop");
    for (const lobe of layout.lobes) {
      const source = layout.puffs[lobe.puffIndex]!;
      expect(lobe.position[1] + lobe.scale[1]).toBeLessThan(
        source.position[1] + source.scale * CUTE_CLOUD_CONTRACT.crownHeightPerScale + 1e-9,
      );
      expect(lobe.position[1] + lobe.scale[1]).toBeLessThan(0);
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
    // Constructions, not the two type annotations on the returned pair.
    expect(shared.match(/new THREE\.MeshStandardMaterial/g)).toHaveLength(2);
    expect(shared.match(/vertexColors:\s*true/g)).toHaveLength(2);
    expect(shared.match(/transparent:\s*false/g)).toHaveLength(2);
    for (const file of CLOUD_CALLERS) {
      const source = code(file);
      expect(source, file).toMatch(/createCloudMaterials\(/);
      // An unlit or bespoke cloud material anywhere is the defect returning.
      expect(source, file).not.toMatch(/MeshBasicMaterial|MeshStandardMaterial/);
    }
  });

  it("depth-tests after the opaque scene without contributing cloud depth to AO", () => {
    const shared = code("./cloud-material.ts");
    expect(CUTE_CLOUD_CONTRACT.renderOrder).toEqual({ underbelly: 3, upper: 4 });
    expect(shared.match(/depthTest:\s*true/g)).toHaveLength(CUTE_CLOUD_CONTRACT.drawBatches);
    expect(shared.match(/depthWrite:\s*false/g)).toHaveLength(CUTE_CLOUD_CONTRACT.drawBatches);
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
});
