import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { frameCourseOverview, overviewViewport } from "./course-overview.js";

describe("the learner's complete island overview", () => {
  it("chooses measured free space rather than guessing the shell's rail widths", () => {
    const obstacles = [
      { left: 16, right: 272, top: 16, bottom: 884 },
      { left: 1104, right: 1424, top: 16, bottom: 652 },
      { left: 285, right: 544, top: 16, bottom: 205 },
    ];
    const usable = overviewViewport(1440, 900, obstacles);
    expect(usable.right - usable.left).toBeGreaterThan(700);
    expect(usable.bottom - usable.top).toBeGreaterThan(600);
    for (const box of obstacles)
      expect(
        usable.left >= box.right ||
          usable.right <= box.left ||
          usable.top >= box.bottom ||
          usable.bottom <= box.top,
      ).toBe(true);
    expect(() =>
      overviewViewport(100, 100, [{ left: 0, top: 0, right: 100, bottom: 100 }]),
    ).toThrow(/visible map/);
  });

  for (const [width, height] of [
    [1440, 900],
    [375, 812],
    [812, 375],
  ]) {
    for (const angle of [-0.7, 0.7]) {
      it(`fits all top/root corners in ${width}x${height} with front-side azimuth ${angle}`, () => {
        const obstacles =
          width >= 1000
            ? [
                { left: 0, right: 272, top: 0, bottom: height },
                { left: 1104, right: width, top: 0, bottom: height },
                { left: 285, right: 545, top: 0, bottom: 205 },
              ]
            : [
                { left: 0, right: width, top: 0, bottom: 190 },
                { left: 0, right: width, top: height - 90, bottom: height },
              ];
        const usable = overviewViewport(width!, height!, obstacles);
        for (const size of [20, 48, 90]) {
          const bounds = new THREE.Box3(
            new THREE.Vector3(-size * 0.8, -size * 0.9, -size),
            new THREE.Vector3(size, size * 0.3, size * 0.8),
          );
          const polar = THREE.MathUtils.degToRad(52);
          const direction = new THREE.Vector3(
            Math.sin(polar) * Math.sin(angle),
            Math.cos(polar),
            Math.sin(polar) * Math.cos(angle),
          );
          const frame = frameCourseOverview(bounds, direction, {
            width: width!,
            height: height!,
            fov: width! < 768 ? 42 : 34,
            usable,
          });
          expect(frame.distanceRange[1] / frame.distanceRange[0]).toBeLessThanOrEqual(3);
          const camera = new THREE.PerspectiveCamera(
            width! < 768 ? 42 : 34,
            width! / height!,
            0.5,
            frame.far,
          );
          expect(frame.far).toBeGreaterThan(frame.distance + frame.radius);
          camera.position.set(...frame.cameraFrom);
          camera.lookAt(...frame.lookAt);
          camera.updateMatrixWorld(true);
          for (const x of [bounds.min.x, bounds.max.x]) {
            for (const y of [bounds.min.y, bounds.max.y]) {
              for (const z of [bounds.min.z, bounds.max.z]) {
                const p = new THREE.Vector3(x, y, z).project(camera);
                const px = ((p.x + 1) * width!) / 2;
                const py = ((1 - p.y) * height!) / 2;
                expect(px).toBeGreaterThanOrEqual(usable.left);
                expect(px).toBeLessThanOrEqual(usable.right);
                expect(py).toBeGreaterThanOrEqual(usable.top);
                expect(py).toBeLessThanOrEqual(usable.bottom);
                expect(p.z).toBeLessThan(1);
              }
            }
          }
        }
      });
    }
  }
  it("rejects absent geometry instead of framing an empty sky", () => {
    expect(() =>
      frameCourseOverview(new THREE.Box3(), new THREE.Vector3(0, 1, 1), {
        width: 375,
        height: 812,
        fov: 42,
        usable: { left: 0, top: 0, right: 375, bottom: 812 },
      }),
    ).toThrow(/Invalid/);
  });
});
