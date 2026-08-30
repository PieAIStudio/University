import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  WORLD_UNDERSIDE_CONTRACT,
  worldUndersideDepthForCells,
  worldUndersideSpikeCountForCells,
  worldUndersideTriangleCountForCells,
  worldUndersideTriangleCountForIslands,
} from "./world-underside.js";

describe("remote world underside", () => {
  it("keeps a visible inverted cone and three-to-five rock points", () => {
    expect(WORLD_UNDERSIDE_CONTRACT.baseSegments).toBe(6);
    expect(WORLD_UNDERSIDE_CONTRACT.spikeSegments).toBe(3);
    expect(WORLD_UNDERSIDE_CONTRACT.minSpikeCount).toBe(3);
    expect(WORLD_UNDERSIDE_CONTRACT.maxSpikeCount).toBe(5);
    expect(worldUndersideSpikeCountForCells(3)).toBe(3);
    expect(worldUndersideSpikeCountForCells(19)).toBe(3);
    expect(worldUndersideSpikeCountForCells(330)).toBe(5);
    expect(worldUndersideDepthForCells(3)).toBeGreaterThanOrEqual(
      WORLD_UNDERSIDE_CONTRACT.minDepth,
    );
    expect(worldUndersideDepthForCells(330)).toBeGreaterThan(worldUndersideDepthForCells(3));
  });

  it("keeps the remote underside in two instanced batches", () => {
    const source = readFileSync(new URL("./WorldUndersideField.tsx", import.meta.url), "utf8");
    expect(source.match(/<instancedMesh\b/g)).toHaveLength(WORLD_UNDERSIDE_CONTRACT.drawBatches);
    expect(source).toMatch(/name="world-grid-soil-cones"/);
    expect(source).toMatch(/name="world-grid-soil-spikes"/);
    expect(source).not.toMatch(/<mesh\b/);
  });

  it("keeps the 53-island underside triangle budget explicit", () => {
    const catalogueCellCounts = [...Array.from({ length: 52 }, () => 19), 330];
    const triangles = worldUndersideTriangleCountForIslands(catalogueCellCounts);
    expect(triangles).toBe(
      catalogueCellCounts.reduce(
        (total, cellCount) => total + worldUndersideTriangleCountForCells(cellCount),
        0,
      ),
    );
    expect(triangles).toBeLessThan(2_000);
  });
});
