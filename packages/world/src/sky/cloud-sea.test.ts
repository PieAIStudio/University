import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLOUD_LAYOUT_CONTRACT,
  CUTE_CLOUD_BATCH_NAMES,
  CUTE_CLOUD_CONTRACT,
  cloudHorizontalFootprint,
  cloudPuffs,
  cloudSafeCorridorRadius,
  cuteCloudLayout,
} from "./cloud-sea.js";

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

  it("depth-tests after the opaque scene without contributing cloud depth to AO", () => {
    const source = readFileSync(new URL("./cloud-sea.tsx", import.meta.url), "utf8");
    expect(CUTE_CLOUD_CONTRACT.renderOrder).toEqual({ underbelly: 3, upper: 4 });
    expect(source.match(/depthTest:\s*true/g)).toHaveLength(CUTE_CLOUD_CONTRACT.drawBatches);
    expect(source.match(/depthWrite:\s*false/g)).toHaveLength(CUTE_CLOUD_CONTRACT.drawBatches);
    expect(source).not.toMatch(/vertexColors:\s*true/);
    expect(source).not.toMatch(/renderOrder=\{-[^}]+\}/);
  });
});
