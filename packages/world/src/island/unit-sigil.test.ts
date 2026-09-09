import { describe, expect, it } from "vitest";

import {
  UNIT_RING_INNER,
  UNIT_RING_OUTER,
  UNIT_SIGIL_ARCS,
  unitRingGeometry,
  unitSigilArcCount,
} from "./unit-sigil.js";

describe("Unit sigil ring", () => {
  it("gives every sigil a distinct arc count so greyscale still tells units apart", () => {
    const counts = Object.values(UNIT_SIGIL_ARCS);
    expect(new Set(counts).size).toBe(counts.length);
    expect(unitSigilArcCount("leaf")).toBe(3);
    expect(unitSigilArcCount("sun")).toBe(8);
  });

  it("builds one cached, finite, upward ring per arc count", () => {
    const first = unitRingGeometry(3);
    const second = unitRingGeometry(3);
    expect(second).toBe(first);
    const position = first.getAttribute("position");
    const index = first.getIndex();
    expect(index).not.toBeNull();
    expect(position.count).toBeGreaterThan(12);
    for (let i = 0; i < position.count; i += 1) {
      expect(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i))).toBe(true);
      expect(position.getY(i)).toBeCloseTo(0, 8);
      const radius = Math.hypot(position.getX(i), position.getZ(i));
      expect(radius).toBeGreaterThan(UNIT_RING_INNER - 1e-6);
      expect(radius).toBeLessThan(UNIT_RING_OUTER + 1e-6);
    }
    const a = { x: position.getX(index!.getX(0)), z: position.getZ(index!.getX(0)) };
    const b = { x: position.getX(index!.getX(1)), z: position.getZ(index!.getX(1)) };
    const c = { x: position.getX(index!.getX(2)), z: position.getZ(index!.getX(2)) };
    // XZ winding must be negative for the face normal to point up (+Y).
    // A non-zero absolute area alone also accepts an invisible underside.
    expect((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)).toBeLessThan(0);
    const normal = first.getAttribute("normal");
    for (let i = 0; i < normal.count; i += 1) expect(normal.getY(i)).toBeGreaterThan(0.99);
  });
});
