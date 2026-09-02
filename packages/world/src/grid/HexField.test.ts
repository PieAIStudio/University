import { describe, expect, it } from "vitest";
import {
  HEX_BEVEL_GEOMETRY_TRIANGLES,
  HEX_GEOMETRY_TRIANGLES,
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
});
