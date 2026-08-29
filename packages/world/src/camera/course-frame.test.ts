import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { frameCourse } from "../course/course-map.js";
import { layoutCourse } from "../course/layout.js";
import type { LessonPlacement } from "../Maps.js";

/*
  The shot on a course road, checked where it went wrong: the live stone must
  end up in front of the eye, not off to one side of it.

  The regression this guards is not subtle once you look for it, and was
  invisible until someone was six lessons in. `layoutCourse` lays a serpentine
  road, so the stone four ahead of you can be most of the island's width away
  laterally while barely any distance further down the course. Aiming at that
  stone's x turned the camera by fifteen degrees, and the live stone — the one
  thing on the screen a learner is meant to click — was projected under the
  right-hand rail, which then ate the click.
*/
const road = (unitSizes: readonly number[], liveIndex: number): LessonPlacement[] =>
  layoutCourse(unitSizes).map(
    (point, index) =>
      ({
        position: new THREE.Vector3(point.x, 0, point.z),
        state: index === liveIndex ? "live" : index < liveIndex ? "done" : "idle",
      }) as unknown as LessonPlacement,
  );

describe("frameCourse", () => {
  it("stands the eye directly in front of the live stone, whatever the road is doing", () => {
    const sizes = [7, 8, 7, 7, 6, 6];
    for (const liveIndex of [0, 1, 5, 9, 20, 33, 40]) {
      const shot = frameCourse(road(sizes, liveIndex));
      expect(shot).not.toBeNull();
      // Same x for eye and target keeps the small tangent look-ahead from
      // turning the avatar out of the centre of the shot.
      expect(shot?.cameraFrom[0]).toBe(shot?.lookAt[0]);
    }
  });

  it("keeps the live stone low and the road ahead in the forward half", () => {
    const shot = frameCourse(road([7, 8, 7, 7, 6, 6], 5));
    const live = road([7, 8, 7, 7, 6, 6], 5)[5]!;
    // Teaching order runs towards +z. The eye remains on the +z/front side,
    // while the target is just behind and above the live stone. Its bounded
    // tangent step is still a forward offset, not a fixed world direction.
    expect(shot!.cameraFrom[2]).toBeGreaterThan(live.position.z);
    expect(shot!.lookAt[2]).toBeLessThan(live.position.z);
    expect(shot!.lookAt[1] - live.position.y).toBe(3);
    expect(shot!.lookAt[2]).toBeGreaterThan(live.position.z - 2);
  });

  it("takes the same bounded tangent step at the start and middle of the bend", () => {
    for (const liveIndex of [0, 20]) {
      const lessons = road([7, 8, 7, 7, 6, 6], liveIndex);
      const shot = frameCourse(lessons);
      const live = lessons[liveIndex]!;
      const next = lessons[liveIndex + 1]!;
      const offset = new THREE.Vector3(
        shot!.cameraFrom[0] - live.position.x,
        0,
        shot!.cameraFrom[2] - live.position.z - 19,
      );
      const tangent = next.position.clone().sub(live.position).setY(0);
      expect(offset.length()).toBeCloseTo(0.8, 5);
      expect(offset.dot(tangent)).toBeGreaterThan(0);
    }
  });

  it("turns an edge shot toward the island and keeps the phone target below its card", () => {
    const outline = [
      { x: -30, z: -30 },
      { x: 30, z: -30 },
      { x: 30, z: 30 },
      { x: -30, z: 30 },
    ];
    const blueprint = {
      outline,
      bounds: { halfX: 30, halfZ: 30, maxHalf: 30 },
    };
    const lessons = [
      { position: new THREE.Vector3(6, 0, -24), state: "live", blueprint },
      { position: new THREE.Vector3(10, 0, -23), state: "idle", blueprint },
    ] as unknown as LessonPlacement[];

    const desktop = frameCourse(lessons, { tier: "desktop" })!;
    const mobile = frameCourse(lessons, { tier: "mobile" })!;
    expect(desktop.cameraFrom[0]).toBeLessThan(desktop.lookAt[0]);
    expect(desktop.lookAt[1]).toBe(0.5);
    expect(mobile.lookAt[1]).toBe(3);
    expect(mobile.cameraFrom[2]).toBeGreaterThan(lessons[0]!.position.z);
  });

  it("does not invoke edge recovery while the probes remain on the island", () => {
    const outline = [
      { x: -30, z: -30 },
      { x: 30, z: -30 },
      { x: 30, z: 30 },
      { x: -30, z: 30 },
    ];
    const blueprint = {
      outline,
      bounds: { halfX: 30, halfZ: 30, maxHalf: 30 },
    };
    const lessons = [
      { position: new THREE.Vector3(0, 0, 0), state: "live", blueprint },
      { position: new THREE.Vector3(4, 0, 1), state: "idle", blueprint },
    ] as unknown as LessonPlacement[];
    const shot = frameCourse(lessons, { tier: "desktop" })!;
    expect(shot.cameraFrom[0]).toBe(shot.lookAt[0]);
    expect(shot.lookAt[1]).toBe(3);
  });

  it("has nothing to frame in a course with no stones", () => {
    expect(frameCourse([])).toBeNull();
  });
});
