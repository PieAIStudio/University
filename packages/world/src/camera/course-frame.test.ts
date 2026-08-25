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
  it("stands the eye directly behind the live stone, whatever the road is doing", () => {
    const sizes = [7, 8, 7, 7, 6, 6];
    for (const liveIndex of [0, 1, 5, 9, 20, 33, 40]) {
      const shot = frameCourse(road(sizes, liveIndex));
      expect(shot).not.toBeNull();
      // Same x for eye and target is what "the live stone is centred" means:
      // the stone, the eye and the point being aimed at are one line.
      expect(shot?.cameraFrom[0]).toBe(shot?.lookAt[0]);
    }
  });

  it("aims further down the course than the stone it stands on", () => {
    const shot = frameCourse(road([7, 8, 7, 7, 6, 6], 5));
    // The road runs towards -z, so a target further along has a smaller z than
    // the eye. Without this the shot would be looking at its own feet.
    expect(shot!.lookAt[2]).toBeLessThan(shot!.cameraFrom[2]);
  });

  it("has nothing to frame in a course with no stones", () => {
    expect(frameCourse([])).toBeNull();
  });
});
