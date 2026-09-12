import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { WORLD_HOME_DISTANCE } from "./controls";
import { frameWorld } from "./frame";

describe("frameWorld", () => {
  it("aims toward actual nearby islands, at the near end of the unchanged range", () => {
    const learner = new THREE.Vector3(40, 0, 10);
    const framed = frameWorld(learner, [
      { position: learner },
      { position: new THREE.Vector3(32, 0, 8) },
    ]);

    // No lateral shift: the learner's island stays on the centre line, and the
    // road's own swing supplies whatever asymmetry the shot has.
    expect(framed.lookAt[0]).toBeLessThan(40);
    // The study road runs along +Z, so aiming ahead means a larger z than the
    // learner's. This used to look straight at them, which put as much sea
    // behind the shot as road in front of it.
    expect(framed.lookAt[2]).toBeLessThan(10);

    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    expect(from.distanceTo(at)).toBeCloseTo(WORLD_HOME_DISTANCE, 5);
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
  it("does not invent a positive-Z road in an empty or single-island catalogue", () => {
    const framed = frameWorld(null);
    expect(framed.lookAt[0]).toBeCloseTo(0);
    expect(framed.lookAt[2]).toBe(0);
    const from = new THREE.Vector3(...framed.cameraFrom);
    const at = new THREE.Vector3(...framed.lookAt);
    expect(from.distanceTo(at)).toBeCloseTo(WORLD_HOME_DISTANCE, 5);
    const only = new THREE.Vector3(7, 2, -14);
    expect(frameWorld(only, [{ position: only }]).lookAt).toEqual(only.toArray());
  });

  it("keeps focus bounded around the current island and stable under input reversal", () => {
    const current = new THREE.Vector3(-30, 2, 15);
    const peers = Array.from({ length: 20 }, (_, i) => ({
      position: new THREE.Vector3(i * 60, 2, i * -43),
    }));
    const before = peers.map((p) => p.position.toArray());
    const frame = frameWorld(current, peers);
    expect(new THREE.Vector3(...frame.lookAt).distanceTo(current)).toBeLessThanOrEqual(8 + 1e-8);
    expect(frameWorld(current, [...peers].reverse())).toEqual(frame);
    expect(peers.map((p) => p.position.toArray())).toEqual(before);
  });
});
