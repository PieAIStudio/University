import { describe, expect, it } from "vitest";
import {
  HEX_COURSE_LAND_BEVEL,
  HEX_BEVEL_GEOMETRY_TRIANGLES,
  HEX_GEOMETRY_TRIANGLES,
  HEX_TOP_CENTRE_VALUE,
  HEX_TOP_EDGE_VALUE,
  hexGeometry,
  hexGeometryTriangleCount,
} from "./HexField.js";

describe("hex field surface geometry", () => {
  it("keeps the bevel cost and normals explicit", () => {
    const flat = hexGeometry(-0.02, -1.2, false);
    const beveled = hexGeometry(0.072, -1.2, true);

    expect(flat.index!.count / 3).toBe(HEX_GEOMETRY_TRIANGLES);
    expect(beveled.index!.count / 3).toBe(HEX_BEVEL_GEOMETRY_TRIANGLES);
    expect(flat.userData.gridTriangles).toBe(hexGeometryTriangleCount(false));
    expect(beveled.userData.gridTriangles).toBe(hexGeometryTriangleCount(true));
    expect(flat.getAttribute("normal").count).toBe(flat.getAttribute("position").count);
    expect(beveled.getAttribute("normal").count).toBe(beveled.getAttribute("position").count);

    flat.dispose();
    beveled.dispose();
  });

  it("keeps the course land bevel narrow and seam-safe", () => {
    const geometry = hexGeometry(-0.02, -1.2, true, HEX_COURSE_LAND_BEVEL);
    const positions = geometry.getAttribute("position");
    const colours = geometry.getAttribute("color");

    expect(Math.hypot(positions.getX(3), positions.getZ(3))).toBeCloseTo(
      HEX_COURSE_LAND_BEVEL.outerRadius - HEX_COURSE_LAND_BEVEL.width,
      5,
    );
    expect(Math.hypot(positions.getX(5), positions.getZ(5))).toBeCloseTo(
      HEX_COURSE_LAND_BEVEL.outerRadius,
      5,
    );
    expect(positions.getY(5)).toBeCloseTo(0.5 - HEX_COURSE_LAND_BEVEL.depth, 5);
    expect(colours.getX(0)).toBeCloseTo(HEX_TOP_CENTRE_VALUE, 5);
    expect(colours.getX(1)).toBeGreaterThanOrEqual(HEX_TOP_EDGE_VALUE - 0.02);
    expect(colours.getX(0)).toBeGreaterThan(colours.getX(1));

    geometry.dispose();
  });
});
