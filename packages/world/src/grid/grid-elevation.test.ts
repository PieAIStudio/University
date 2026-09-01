import { describe, expect, it } from "vitest";

import {
  gridSurfaceSlopeFor,
  GRID_SURFACE_SLOPE_MAX,
  type GridSurfaceSlope,
} from "./grid-elevation.js";
import { hexSpiral, type HexCoord } from "./hex.js";

type SurfaceCell = { readonly coord: HexCoord; readonly topY: number };

function surfaceCells(topY = 1.56): readonly SurfaceCell[] {
  return hexSpiral({ q: 0, r: 0 }, 4).map((coord) => ({ coord, topY }));
}

function magnitude(slope: GridSurfaceSlope): number {
  return Math.hypot(slope.x, slope.z);
}

describe("course surface slope field", () => {
  it("is deterministic and stays inside the physical slope cap", () => {
    const cells = surfaceCells();
    const first = cells.map((cell) => gridSurfaceSlopeFor(cell, cells, "slope-seed"));
    const second = cells.map((cell) => gridSurfaceSlopeFor(cell, cells, "slope-seed"));

    expect(first).toEqual(second);
    expect(Math.max(...first.map(magnitude))).toBeLessThanOrEqual(GRID_SURFACE_SLOPE_MAX);
    expect(first.some((slope) => magnitude(slope) > 0.2)).toBe(true);
  });

  it("adds real neighbouring height changes to the same continuous field", () => {
    const flat = surfaceCells();
    const raisedNeighbour = flat.map((cell, index) =>
      index === 1 ? { ...cell, topY: 3.12 } : cell,
    );
    const centre = flat[0]!;
    const flatSlope = gridSurfaceSlopeFor(centre, flat, "height-seed");
    const raisedSlope = gridSurfaceSlopeFor(centre, raisedNeighbour, "height-seed");

    expect(magnitude(raisedSlope)).toBeLessThanOrEqual(GRID_SURFACE_SLOPE_MAX);
    expect(
      magnitude({ x: raisedSlope.x - flatSlope.x, z: raisedSlope.z - flatSlope.z }),
    ).toBeGreaterThan(0.01);
  });
});
