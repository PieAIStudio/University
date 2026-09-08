import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  domainCameraDistance,
  domainLabelWidth,
  DOMAIN_OUTER_RADIUS,
  DOMAIN_VIEW_FRONT,
  layoutDomainPlan,
} from "./domain-layout.js";

describe("same-level domain layout", () => {
  it("bounds complete labels by projected spacing on narrow short viewports", () => {
    // Read spacing from the planner instead of keeping another layout constant.
    const peers = layoutDomainPlan(["a", "b", "c", "d"]);
    const spacing = Math.abs(peers[1]!.viewX - peers[0]!.viewX);
    for (const pixelsPerUnit of [0.8, 1.2, 1.8, 2.2, 3, 6, 12]) {
      expect(domainLabelWidth(pixelsPerUnit)).toBeLessThan(spacing * pixelsPerUnit);
      expect(domainLabelWidth(pixelsPerUnit)).toBeLessThanOrEqual(176);
      expect(domainLabelWidth(pixelsPerUnit)).toBeGreaterThan(0);
    }
  });
  it("is empty-safe and stable under source ordering", () => {
    expect(layoutDomainPlan([])).toEqual([]);
    expect(layoutDomainPlan(["a"])[0]?.position).toEqual([-0, 0, 0]);
    expect(layoutDomainPlan(["d", "b", "a", "c"])).toEqual(layoutDomainPlan(["a", "b", "c", "d"]));
    expect(() => layoutDomainPlan(["a", "a"])).toThrow(/unique/);
  });

  it.each([1, 2, 4, 20, 30])(
    "keeps %i domains separated, coplanar and at one physical scale",
    (count) => {
      const placed = layoutDomainPlan(Array.from({ length: count }, (_, i) => `domain-${i}`));
      for (let i = 0; i < placed.length; i++) {
        const position = new THREE.Vector3(...placed[i]!.position);
        expect(Math.abs(position.dot(DOMAIN_VIEW_FRONT))).toBeLessThan(1e-10);
        for (let j = 0; j < i; j++) {
          expect(position.distanceTo(new THREE.Vector3(...placed[j]!.position))).toBeGreaterThan(
            DOMAIN_OUTER_RADIUS * 2,
          );
        }
      }
    },
  );

  it.each([
    { width: 1440, height: 900, left: 284, right: 348 },
    { width: 1024, height: 768, left: 284, right: 348 },
    { width: 375, height: 276, left: 0, right: 0 },
  ])(
    "fits the entire 4-domain field at $width x $height, including panel insets",
    ({ width, height, left, right }) => {
      const placements = layoutDomainPlan(["a", "b", "c", "d"]);
      const usableWidth = width - left - right - 36;
      const usableHeight = height - 36;
      const distance = domainCameraDistance(placements, {
        height,
        usableWidth,
        usableHeight,
        fovDegrees: 45,
      });
      const halfH = Math.atan((Math.tan(Math.PI / 8) * usableWidth) / height);
      const halfV = Math.atan((Math.tan(Math.PI / 8) * usableHeight) / height);
      for (const placement of placements) {
        const horizontalClearance =
          distance * Math.sin(halfH) - Math.abs(placement.viewX) * Math.cos(halfH);
        const verticalClearance =
          distance * Math.sin(halfV) - Math.abs(placement.viewY) * Math.cos(halfV);
        expect(horizontalClearance).toBeGreaterThanOrEqual(DOMAIN_OUTER_RADIUS - 1e-10);
        expect(verticalClearance).toBeGreaterThanOrEqual(DOMAIN_OUTER_RADIUS - 1e-10);
      }
    },
  );
});
