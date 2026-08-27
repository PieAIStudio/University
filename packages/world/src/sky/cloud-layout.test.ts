import { describe, expect, it } from "vitest";

import {
  CLOUD_LAYOUT_CONTRACT,
  cloudHorizontalFootprint,
  cloudPuffs,
  cloudSafeCorridorRadius,
} from "./cloud-layout.js";

describe("cloud sea", () => {
  it("is deterministic and has a smaller mobile population", () => {
    expect(cloudPuffs(40, false, -5.2)).toEqual(cloudPuffs(40, false, -5.2));
    expect(cloudPuffs(40, true, -5.2)).toHaveLength(CLOUD_LAYOUT_CONTRACT.mobilePuffCount);
    expect(cloudPuffs(40, false, -5.2)).toHaveLength(CLOUD_LAYOUT_CONTRACT.desktopPuffCount);
  });

  it("stays below the visible shoreline in both map levels", () => {
    for (const [extent, mobile, level] of [
      [40, false, -5.2],
      [40, true, -5.2],
      [80, false, -10.2],
    ] as const) {
      for (const puff of cloudPuffs(extent, mobile, level)) {
        // CuteCloudSea's tallest lobe reaches about 1.12 puff scales above
        // the source position; keep even that sculpted crown below the turf.
        const highestPoint = puff.position[1] + puff.scale * 1.12;
        expect(highestPoint).toBeLessThan(0);
      }
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
});
