/**
 * Screen-pixel contract for the remote island underside.
 *
 * A world island is small in the fixed aerial shot, so the underside is a
 * silhouette cue rather than a second terrain model. Keeping these rules pure
 * lets the renderer and its budget tests agree without importing Three.js.
 */
export const WORLD_UNDERSIDE_CONTRACT = {
  baseSegments: 6,
  spikeSegments: 3,
  baseTriangles: 6,
  spikeTriangles: 3,
  minSpikeCount: 3,
  maxSpikeCount: 5,
  minDepth: 2.4,
  maxDepth: 4.8,
  depthBase: 2,
  depthPerSqrtCell: 0.14,
  drawBatches: 2,
} as const;

function safeCellCount(cellCount: number): number {
  return Math.max(1, Math.floor(Number.isFinite(cellCount) ? cellCount : 1));
}

/** Three points read as a floating island; larger remote silhouettes earn two more. */
export function worldUndersideSpikeCountForCells(cellCount: number): number {
  const scale = Math.ceil(Math.sqrt(safeCellCount(cellCount)) / 7);
  return Math.min(
    WORLD_UNDERSIDE_CONTRACT.maxSpikeCount,
    Math.max(WORLD_UNDERSIDE_CONTRACT.minSpikeCount, 2 + scale),
  );
}

/** Depth grows with the projected course footprint, then stops at the aerial budget. */
export function worldUndersideDepthForCells(cellCount: number): number {
  const depth =
    WORLD_UNDERSIDE_CONTRACT.depthBase +
    Math.sqrt(safeCellCount(cellCount)) * WORLD_UNDERSIDE_CONTRACT.depthPerSqrtCell;
  return Math.min(
    WORLD_UNDERSIDE_CONTRACT.maxDepth,
    Math.max(WORLD_UNDERSIDE_CONTRACT.minDepth, depth),
  );
}

export function worldUndersideTriangleCountForCells(cellCount: number): number {
  return (
    WORLD_UNDERSIDE_CONTRACT.baseTriangles +
    worldUndersideSpikeCountForCells(cellCount) * WORLD_UNDERSIDE_CONTRACT.spikeTriangles
  );
}

export function worldUndersideTriangleCountForIslands(cellCounts: readonly number[]): number {
  return cellCounts.reduce(
    (total, cellCount) => total + worldUndersideTriangleCountForCells(cellCount),
    0,
  );
}
