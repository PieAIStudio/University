import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { WORLD_DISTANCE_MIN } from "./controls";
import { frameWorld } from "./frame";

describe("frameWorld", () => {
  it("aims down the road, ahead of the learner, at the near end of the range", () => {
    const learner = new THREE.Vector3(40, 0, 10);
    const framed = frameWorld(learner);

    // No lateral shift: the learner's island stays on the centre line, and the
    // road's own swing supplies whatever asymmetry the shot has.
    expect(framed.lookAt[0]).toBeCloseTo(40);
    // The study road runs along +Z, so aiming ahead means a larger z than the
    // learner's. This used to look straight at them, which put as much sea
    // behind the shot as road in front of it.
    expect(framed.lookAt[2]).toBeGreaterThan(10);

    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    expect(from.distanceTo(at)).toBeCloseTo(WORLD_DISTANCE_MIN, 5);
  });

  /*
    The learner's own island is the one thing on this map they are entitled to
    always be able to find. Aiming ahead is only safe while they stay in front
    of the camera — a look-ahead longer than the camera's own set-back would
    put their island behind the eye.
  */
  it("never aims so far ahead that the learner falls behind the camera", () => {
    const learner = new THREE.Vector3(0, 0, 0);
    const framed = frameWorld(learner);
    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    const forward = at.clone().sub(from).setY(0).normalize();
    const toLearner = learner.clone().sub(from).setY(0);
    expect(forward.dot(toLearner)).toBeGreaterThan(0);
  });

  /*
    A project nobody has opened has no learner on its road. It still has a head
    to the road, and that is what the shot has to find — the alternative is the
    old overview pose, a fixed point over an origin that no longer means
    anything now that each project sits on one.
  */
  it("frames the head of the road in a project with no learner on it", () => {
    const framed = frameWorld(null);
    expect(framed.lookAt[0]).toBeCloseTo(0);
    expect(framed.lookAt[2]).toBeGreaterThan(0);
    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    expect(from.distanceTo(at)).toBeCloseTo(WORLD_DISTANCE_MIN, 5);
  });
});
