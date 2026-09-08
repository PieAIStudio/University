import { describe, expect, it } from "vitest";
import { createDomainGlobeGeometry, createDomainSurfaceTexture } from "./globe-geometry.js";
import { domainSurfacePalette, type DomainSurfaceStyle } from "./globe-style.js";
import { prepareDomain } from "./domain-preparation.js";

describe("named domain material families share one geometry and bake", () => {
  it("changes colour, not shape, topology or the domain seed", () => {
    const shapes = (["meadow", "dawn", "iris"] as const).map((style) =>
      createDomainGlobeGeometry("same-world", style),
    );
    try {
      for (const shape of shapes) {
        expect(shape.getAttribute("position").array).toEqual(
          shapes[0]!.getAttribute("position").array,
        );
        expect(shape.getIndex()!.count / 3).toBe(3968);
        expect(
          Array.from(shape.getAttribute("color").array).every(
            (v) => Number.isFinite(v) && v >= 0 && v <= 1,
          ),
        ).toBe(true);
      }
      expect(shapes[0]!.getAttribute("color").array).not.toEqual(
        shapes[1]!.getAttribute("color").array,
      );
      expect(shapes[1]!.getAttribute("color").array).not.toEqual(
        shapes[2]!.getAttribute("color").array,
      );
    } finally {
      for (const shape of shapes) shape.dispose();
    }
  });
  it.each(["dawn", "iris"] as const)(
    "worker applies the declared %s style, with no invented courses",
    (style) => {
      const texture = createDomainSurfaceTexture("empty", style);
      try {
        const packet = prepareDomain("empty", [], 3, style);
        expect(packet.islands).toBeNull();
        expect(packet.pixels).toEqual(texture.image.data);
        expect(packet.pixels.byteLength).toBe(2 * 1024 * 1024);
      } finally {
        texture.dispose();
      }
    },
  );
  it("defaults unknown runtime metadata safely, without inherited object properties", () => {
    for (const value of ["unknown", "toString", "__proto__"]) {
      expect(domainSurfacePalette(value as DomainSurfaceStyle)).toBe(domainSurfacePalette());
    }
  });
});
