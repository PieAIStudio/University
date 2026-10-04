import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { setCameraOverride } from "../camera/camera-override.js";
import { chooseCloseUpHeading, type Footprint } from "./close-up-heading.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";

/** How far the eye sits from what it frames, in blueprint units (the learner is 1.8 tall). */
export const CLOSE_UP_DISTANCE = 7.5;
/** Nearly level (V7: 「放低到差不多平视」): degrees above the horizon. */
export const CLOSE_UP_ELEVATION = 24;
const IN_SECONDS = 1.1;
const OUT_SECONDS = 0.9;
const LOOK_HEIGHT = 0.75;

/** Perspective fit for the first-meeting pair, including the avatar/chest
 * silhouettes. Use actual FOV and aspect, not a separate phone camera. */
export function introductoryCameraReach(
  separation: number,
  fovDegrees: number,
  aspect: number,
): number {
  const halfFov = THREE.MathUtils.degToRad(Math.max(10, Math.min(120, fovDegrees))) / 2;
  const halfWidth = Math.max(0, separation) / 2 + 1.6;
  const availableTangent = Math.tan(halfFov) * Math.min(1, Math.max(0.1, aspect)) * 0.8;
  return Math.max(CLOSE_UP_DISTANCE, halfWidth / availableTangent + separation / 2);
}

const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Settles the camera beside the learner's avatar and the chest it is about to
 * open, keeping the map's heading so the island does not swing round, and
 * returns it to exactly where it was when `active` goes false. Under reduced
 * motion the camera does not move (V7: 「镜头不动」).
 */
export function CloseUpCamera({
  active,
  subject,
  other,
  obstacles = [],
  onSettled,
  fitIntroduction = false,
}: {
  readonly active: boolean;
  /** The avatar: kept in frame on the near side. */
  readonly subject: THREE.Vector3;
  /** The chest, or the monster a star is thrown at: framed with the avatar. */
  readonly other: THREE.Vector3;
  /** What stands on the island, so the eye is not put behind a tent (close-up-heading.ts). */
  readonly obstacles?: readonly Footprint[];
  readonly onSettled?: () => void;
  /** Keep the first lesson's avatar and unopened chest inside a narrow viewport. */
  readonly fitIntroduction?: boolean;
}) {
  const { camera, scene } = useThree();
  const reducedMotion = usePrefersReducedMotion();
  const move = useRef<{
    fromPosition: THREE.Vector3;
    fromLook: THREE.Vector3;
    home: { position: THREE.Vector3; look: THREE.Vector3 } | null;
    heading: THREE.Vector3;
    t: number;
    direction: 1 | -1;
    arrived: boolean;
  }>({
    fromPosition: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    home: null,
    heading: new THREE.Vector3(0, 0, 1),
    t: 1,
    direction: -1,
    arrived: false,
  });
  const settled = useRef(onSettled);
  settled.current = onSettled;

  const framing = () => {
    // A portrait screen needs breathing room under the pair for 涟's short
    // DOM card. Looking a little lower raises both subjects together without
    // changing their world positions or the ordinary chest ceremony.
    const portraitClearance =
      fitIntroduction && camera instanceof THREE.PerspectiveCamera
        ? Math.max(0, 1 - camera.aspect) * 1.6
        : 0;
    const look = subject
      .clone()
      .lerp(other, fitIntroduction ? 0.5 : 0.62)
      .setY(Math.max(subject.y, other.y) + LOOK_HEIGHT - portraitClearance);
    // Far enough back to keep both in frame however far apart they stand.
    const separation = Math.hypot(other.x - subject.x, other.z - subject.z);
    const reach =
      fitIntroduction && camera instanceof THREE.PerspectiveCamera
        ? introductoryCameraReach(separation, camera.fov, camera.aspect)
        : Math.max(CLOSE_UP_DISTANCE, separation * 1.7 + 3);
    return { look, reach };
  };
  /** Turn off the map's heading only as far as it takes to see past what stands. */
  const chooseHeading = () => {
    const state = move.current;
    if (!state.home) return;
    const home = state.home.position.clone().sub(state.home.look).setY(0);
    if (home.lengthSq() < 1e-6) home.set(0, 0, 1);
    const { look, reach } = framing();
    const up = THREE.MathUtils.degToRad(CLOSE_UP_ELEVATION);
    const heading = chooseCloseUpHeading({
      home: home.normalize(),
      look,
      reach: Math.cos(up) * reach,
      subjects: [subject, other],
      obstacles,
    });
    state.heading.set(heading.x, 0, heading.z);
  };

  /** Where the camera is looking on the ground plane at height `y`. */
  const lookPoint = (y: number) => {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const t = Math.abs(forward.y) > 1e-4 ? (y - camera.position.y) / forward.y : 20;
    return camera.position.clone().addScaledVector(forward, Math.max(1, t));
  };

  useEffect(() => {
    const state = move.current;
    if (reducedMotion) {
      if (active) settled.current?.();
      return;
    }
    if (active) {
      state.home ??= { position: camera.position.clone(), look: lookPoint(subject.y) };
      state.fromPosition.copy(camera.position);
      state.fromLook.copy(lookPoint(subject.y));
      state.t = 0;
      state.direction = 1;
      state.arrived = false;
      chooseHeading();
    } else if (state.home) {
      state.fromPosition.copy(camera.position);
      state.fromLook.copy(lookPoint(subject.y));
      state.t = 0;
      state.direction = -1;
    }
    // Starts once per change of `active`; the subject is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion]);
  useEffect(() => () => setCameraOverride(scene, null), [scene]);
  // A new thing to frame beside the avatar (the monster a star is thrown at):
  // ease over to it from wherever the camera is now.
  useEffect(() => {
    const state = move.current;
    if (!active || reducedMotion || !state.home || state.direction !== 1) return;
    const override = scene.userData.cameraOverride as
      | { from: THREE.Vector3; look: THREE.Vector3 }
      | undefined;
    if (!override) return;
    state.fromPosition.copy(override.from);
    state.fromLook.copy(override.look);
    state.t = 0;
    chooseHeading();
    // The close-up heading is chosen from the current override at transition
    // start, so only the target coordinates restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [other.x, other.z]);

  useFrame((_, delta) => {
    const state = move.current;
    if (reducedMotion || !state.home) return;
    const going = state.direction === 1;
    state.t = Math.min(1, state.t + Math.min(delta, 0.05) / (going ? IN_SECONDS : OUT_SECONDS));
    const k = ease(state.t);
    let targetPosition: THREE.Vector3;
    let targetLook: THREE.Vector3;
    if (going) {
      const { look, reach } = framing();
      targetLook = look;
      const up = THREE.MathUtils.degToRad(CLOSE_UP_ELEVATION);
      targetPosition = targetLook
        .clone()
        .addScaledVector(state.heading, Math.cos(up) * reach)
        .add(new THREE.Vector3(0, Math.sin(up) * reach, 0));
    } else {
      targetPosition = state.home.position;
      targetLook = state.home.look;
    }
    setCameraOverride(scene, {
      from: state.fromPosition.clone().lerp(targetPosition, k),
      look: state.fromLook.clone().lerp(targetLook, k),
    });
    if (state.t < 1) return;
    if (going && !state.arrived) {
      state.arrived = true;
      settled.current?.();
    }
    if (!going) {
      // Home: hand the camera back to the map exactly where it was.
      setCameraOverride(scene, null);
      state.home = null;
    }
  });
  return null;
}
