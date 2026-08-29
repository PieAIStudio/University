import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  AVATAR_OCCLUSION_MAX_SHARE,
  AVATAR_OCCLUSION_TARGET,
  measureAvatarOcclusion,
} from "./avatar-occlusion.js";

function avatarScene(withBlocker: boolean) {
  const scene = new THREE.Scene();
  const avatar = new THREE.Group();
  avatar.name = AVATAR_OCCLUSION_TARGET;
  avatar.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial()));
  scene.add(avatar);
  if (withBlocker) {
    const blocker = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.8, 0.5),
      new THREE.MeshBasicMaterial(),
    );
    blocker.name = "test-foliage";
    blocker.position.z = 2;
    scene.add(blocker);
  }
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.3, 8);
  camera.lookAt(0, 0.2, 0);
  return { scene, camera };
}

describe("measureAvatarOcclusion", () => {
  it("reports every avatar-surface sample clear when no scene object is between camera and avatar", () => {
    const { scene, camera } = avatarScene(false);
    const report = measureAvatarOcclusion(scene, camera);
    expect(report.ready).toBe(true);
    expect(report.candidateRayCount).toBe(96);
    expect(report.avatarSurfaceRayCount).toBeGreaterThan(0);
    expect(report.blockedRayCount).toBe(0);
    expect(report.avatarOcclusionShare).toBe(AVATAR_OCCLUSION_MAX_SHARE);
  });

  it("counts a foliage-sized object before the avatar", () => {
    const { scene, camera } = avatarScene(true);
    const report = measureAvatarOcclusion(scene, camera);
    expect(report.blockedRayCount).toBeGreaterThan(0);
    expect(report.avatarOcclusionShare).toBeGreaterThan(AVATAR_OCCLUSION_MAX_SHARE);
    expect(report.blockers[0]?.object).toBe("test-foliage");
  });

  it("returns an unready report until the avatar has committed", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    expect(measureAvatarOcclusion(scene, camera)).toMatchObject({
      ready: false,
      targetFound: false,
      avatarOcclusionShare: null,
    });
  });
});
