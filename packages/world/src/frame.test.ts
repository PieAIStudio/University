import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { WORLD_DISTANCE_MAX, WORLD_DISTANCE_MIN } from "./controls";
import { frameWorld } from "./frame";

describe("frameWorld", () => {
  it("looks at the study when focusing one sea, at a distance inside the 3× range", () => {
    const look = new THREE.Vector3(40, 0, 10);
    const centre = new THREE.Vector3(30, 0, 0);
    const framed = frameWorld(look, centre);
    expect(framed.lookAt[0]).toBeCloseTo(40);
    expect(framed.lookAt[2]).toBeCloseTo(10);
    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    expect(from.distanceTo(at)).toBeCloseTo(WORLD_DISTANCE_MIN, 5);
  });

  it("pulls back to the origin at max distance for 看全部四片海", () => {
    const framed = frameWorld(new THREE.Vector3(40, 0, 10), new THREE.Vector3(30, 0, 0), {
      overview: true,
    });
    expect(framed.lookAt).toEqual([0, 0, 0]);
    const from = new THREE.Vector3(...framed.cameraFrom);
    expect(from.distanceTo(new THREE.Vector3(0, 0, 0))).toBeCloseTo(WORLD_DISTANCE_MAX, 5);
  });
});
