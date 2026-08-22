import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

import {
  boxesOverlap,
  labelBox,
  placeLabels,
  type LabelAnchor,
  type LabelBox,
  type LabelCandidate,
} from "@pieai/university-world/labels.js";
import type { Marker } from "@pieai/university-world/Maps.js";

import type { View } from "../url-state";

/**
 * Camera rig. Still MapControls, but with the map idiom's two habits removed.
 *
 * This used to be free-orbit with the tilt allowed down to 83°, and the eye
 * deliberately placed low so the horizon was in shot. That was a considered
 * choice for a landscape, and it is the wrong one for a screen whose job is
 * "where do I go now". Level-select maps that answer that in eight seconds —
 * Duolingo, Mario's world map, Candy Crush — all refuse to let you turn the
 * map, because the answer has to be in the same place every time you look.
 *
 * Three specific things went wrong when the map could be turned:
 *
 *  - The lit beacon marking the next course has an orientation. Turn far
 *    enough and it is behind its own island.
 *  - Every change of azimuth re-lays out all 41 DOM labels, which is part of
 *    why they were seen stacking.
 *  - On a trackpad the rotation was not even requested. MapControls binds
 *    right-drag to rotate, a two-finger tap *is* a right-click, and a pinch is
 *    `TOUCH.DOLLY_ROTATE`, so any twist during a zoom turns the world.
 *
 * Mapbox ships an official "disable rotation" example and Apple Maps hides
 * rotation behind the compass rather than putting it on the trackpad. This
 * follows them.
 */
/**
 * The only two views the 3D map is part of.
 *
 * This used to be the opposite list — every view that had to *hide* the stage,
 * enumerated one `||` at a time. That shape is wrong in a way that is invisible
 * when you write it and expensive later: a new route is correct only if
 * whoever adds it remembers to come back here, and `concepts` and `concept`
 * were both added without that, so two full-page surfaces spent their life
 * rendering on top of a live WebGL canvas nobody could see.
 *
 * Stated as "who uses the map", a forgotten route hides the canvas, which is
 * the safe direction to be wrong in.
 */
export const SHOWS_THE_MAP = new Set<View["kind"]>(["world", "course"]);

export const MAP_CONTROLS_HINT = "拖动平移 · 滚轮缩放 · 点岛进入";

export const WORLD_POLAR = THREE.MathUtils.degToRad(54);
/**
 * Inside a course the eye is on the road, not above it.
 *
 * This tilt is pinned at both ends by `Controls`, which makes it — not the
 * camera position — the thing that decides how high the shot sits: `Flight`
 * sets the distance to the target and `MapControls.update()` then forces the
 * angle, so every offset tuned into the eye position was being overwritten on
 * the next frame. Fifty degrees off vertical is a level-select map looking
 * down at its own layout. Seventy-four is a road going away from you, which is
 * the only angle at which the stones ahead overlap into a line, the fog does
 * anything, and the climb reads as a climb.
 */
export const COURSE_POLAR = THREE.MathUtils.degToRad(74);

/**
 * How far the eye sits from the look target inside a course.
 *
 * App.tsx still aims four stones ahead; this is the radius MapControls is
 * allowed to keep. 76 (the old `from`) made each stone ~6% of the viewport.
 * 38 is the distance at which a stone reads as a button (~12%) while five
 * still fit, given COURSE_STEP. Height is not a lever — polar is pinned.
 */
export const COURSE_DISTANCE = 38;
export const COURSE_DISTANCE_MIN = 22;
export const COURSE_DISTANCE_MAX = 48;
/**
 * App.tsx aims four stones ahead. Dolly-in toward that far look drops the
 * live stone under the chrome. Pulling the target back along the ground
 * toward the eye (about two stones) keeps the live stone in the lower
 * third with road still visible behind it.
 */
export const COURSE_LOOK_PULL = 12;

export function Controls({
  target,
  polar,
}: {
  target: readonly [number, number, number];
  /** The one tilt this view is allowed, in radians from straight down. */
  polar: number;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<MapControls | null>(null);

  const polarRef = useRef(polar);
  polarRef.current = polar;

  useEffect(() => {
    const instance = new MapControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    instance.enableRotate = false;
    instance.minDistance = 6;
    instance.maxDistance = 460;
    // Two fingers zoom. They do not also rotate, which is what DOLLY_ROTATE
    // would do with any accidental twist.
    instance.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.current = instance;
    if (import.meta.env.DEV) {
      (globalThis as unknown as { mapControls?: MapControls }).mapControls = instance;
    }
    return () => {
      instance.dispose();
      if (import.meta.env.DEV) {
        const bag = globalThis as unknown as { mapControls?: MapControls };
        if (bag.mapControls === instance) delete bag.mapControls;
      }
    };
  }, [camera, gl]);

  // Pinning both ends is what makes the tilt a property of the view rather
  // than of whatever the last drag happened to leave behind.
  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    instance.minPolarAngle = polar;
    instance.maxPolarAngle = polar;
    if (Math.abs(polar - COURSE_POLAR) < 1e-6) {
      instance.minDistance = COURSE_DISTANCE_MIN;
      instance.maxDistance = COURSE_DISTANCE_MAX;
    } else {
      instance.minDistance = 6;
      instance.maxDistance = 460;
    }
  }, [polar]);

  /**
   * A two-finger trackpad swipe pans.
   *
   * The browser reports that swipe as a `wheel` event, and MapControls reads
   * every `wheel` as zoom — so on a laptop, the gesture every Mac user makes
   * to move a map was zooming it instead. A pinch is distinguishable: the
   * browser sets `ctrlKey` on it, which is how Apple Maps and Mapbox tell the
   * two apart, so a pinch still falls through to the zoom MapControls does.
   *
   * The listener sits on the canvas's parent in the capture phase because
   * MapControls binds its own to the canvas. Registering on the same element
   * would leave the order to chance.
   */
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // a pinch — let it zoom
      const instance = controls.current;
      if (!instance) return;
      event.preventDefault();
      event.stopPropagation();
      // Pan in the ground plane, scaled by how far away the camera is, so the
      // gesture moves the same amount of *map* at every zoom level.
      const reach = camera.position.distanceTo(instance.target) * 0.0016;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const shift = right
        .multiplyScalar(event.deltaX * reach)
        .addScaledVector(forward, -event.deltaY * reach);
      camera.position.add(shift);
      instance.target.add(shift);
    };
    host.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => host.removeEventListener("wheel", onWheel, { capture: true });
  }, [camera, gl]);

  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    instance.target.set(...target);
    // The course road is laid out in −Z. Pulling the look back along +Z
    // (toward the live stone) does not depend on where the eye currently is,
    // so a world→course flight cannot aim the target at the old archipelago.
    if (Math.abs(polarRef.current - COURSE_POLAR) < 1e-6) {
      instance.target.z += COURSE_LOOK_PULL;
    }
  }, [target]);

  useFrame((_, delta) => {
    const instance = controls.current;
    if (!instance) return;
    // Flight runs at priority 0 and snaps the eye to App.tsx's `from`, which
    // is ~65–76 units from the look target. MapControls then rebuilds position
    // from (target, distance, polar) — so the lever is distance, not height.
    if (Math.abs(polarRef.current - COURSE_POLAR) < 1e-6) {
      const dist = camera.position.distanceTo(instance.target);
      if (dist > COURSE_DISTANCE_MAX + 0.05) {
        const dir = camera.position.clone().sub(instance.target);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
          // Coming from the world map the eye is hundreds of units out; damp
          // so the drill-down is a dolly, not a teleport. App's course `from`
          // is just outside max — snap that, or the first URL frame is the
          // old landscape shot.
          const next =
            dist > 90 ? THREE.MathUtils.damp(dist, COURSE_DISTANCE, 2.6, delta) : COURSE_DISTANCE;
          camera.position.copy(instance.target).addScaledVector(dir, next);
        }
      }
    }
    instance.update();
  }, 0.5);
  return null;
}

/**
 * A camera move, eased, with no tween library.
 *
 * The drill-down from world to level is the one motion this product has to get
 * right, because it is what tells a learner that the lesson they are entering
 * is the island they just pointed at.
 */
export function Flight({
  to,
  look,
}: {
  to: readonly [number, number, number];
  look: readonly [number, number, number];
}) {
  const { camera } = useThree();
  const from = useRef({ position: new THREE.Vector3(), target: new THREE.Vector3(), elapsed: 0 });
  const first = useRef(true);

  // Keyed on the numbers, not on the arrays.
  //
  // `to` and `look` are array literals, so they are a new identity on every
  // render. With them as dependencies this effect re-fired constantly, resetting
  // `elapsed` to zero and the start point to wherever the camera had crept to —
  // a tween that restarts sixty times a second never arrives. It was invisible
  // while every view change came from a click that also changed something else;
  // opening a course straight from a URL made it obvious, as a camera still
  // framed on the world map staring at empty water.
  const key = `${to.join()}|${look.join()}`;
  useEffect(() => {
    from.current = {
      position: camera.position.clone(),
      target: new THREE.Vector3(...look),
      elapsed: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, camera]);

  useFrame((_, delta) => {
    const flight = from.current;
    if (flight.elapsed >= 1) return;
    // Arriving from a URL has no previous shot to fly out of, so there is
    // nothing to animate — snap, and let the flight be for navigation the
    // learner actually performed.
    if (first.current) {
      first.current = false;
      camera.position.set(...to);
      flight.elapsed = 1;
      return;
    }
    flight.elapsed = Math.min(1, flight.elapsed + delta / 0.85);
    const raw = flight.elapsed;
    const eased = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
    camera.position.lerpVectors(flight.position, new THREE.Vector3(...to), eased);
  });
  return null;
}

/**
 * The one overlay projector. Course names, lesson titles, kind icons and
 * unit names all go through this pass: one place decides "this thing is on
 * screen at this position with this opacity".
 *
 * Not through React state, and that is the whole point of the file. Positions
 * change every frame; routing them through `setState` re-renders the tree sixty
 * times a second, which here fed back into the camera memo and sent the view
 * drifting off to the horizon on its own. Per-frame data belongs on refs.
 *
 * The component sits inside the Canvas so it can read the camera and renders
 * nothing there. Baseline rule 7 in one place: geometry moves the eye, the DOM
 * carries the words.
 */
function originOf(marker: Marker): string {
  return marker.origin === "start" ? "translate(0, -50%)" : "translate(-50%, -50%)";
}

function defaultWeight(marker: Marker): number {
  if (marker.kind === "study" || marker.kind === "unit") return 2;
  if (marker.kind === "lesson") return 0;
  return 1;
}

function writePlacement(
  element: HTMLElement,
  marker: Marker,
  x: number,
  y: number,
  visible: boolean,
) {
  element.style.transform = `translate(${x}px, ${y}px) ${originOf(marker)}`;
  // A custom property rather than `opacity`, so a stylesheet can still have
  // an opinion. An inline opacity wins against every rule that is not
  // `!important`, which would make `.label--quiet` unenforceable.
  element.style.setProperty("--placed", visible ? "1" : "0");
  element.classList.toggle("is-visible", visible);
}

export function LabelProbe({
  markers,
  limit,
  nodes,
}: {
  markers: readonly Marker[];
  limit: number;
  nodes: Map<string, HTMLElement>;
}) {
  const { camera, size } = useThree();
  const scratch = useRef(new THREE.Vector3());

  useFrame(() => {
    // Project first, then let `placeLabels` decide who survives.
    //
    // The old pass ranked by depth and kept the nearest few, which on a
    // forty-one-lesson course map produced a legible top and an unreadable
    // stack at the bottom — the names were all "near", they were just on top of
    // one another. Overlap is a screen-space problem and has to be solved in
    // screen space, with the boxes the labels actually occupy.
    //
    // Quiet markers never enter the contest. They are drawn at zero opacity
    // until something focuses them, so an overlap between two of them is not a
    // defect anybody can see — but letting them compete spends the visible
    // budget on names nobody is reading, and on a forty-one stone road they
    // took every slot and left the one loud name unplaced. Invisible things do
    // not get to win arguments about space.
    //
    // Pinned markers (kind icons) stay on their stone. They occupy a box so
    // names go around them, and they do not spend the name budget.
    const candidates: LabelCandidate[] = [];
    const reserved: LabelBox[] = [];
    const pinned: {
      marker: Marker;
      element: HTMLElement;
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      anchor: LabelAnchor;
    }[] = [];
    // Every marker that projected this frame, quiet or not. The reset below
    // keys off this rather than off `candidates`, which no longer holds the
    // quiet ones — without it the reset immediately undoes the transform the
    // quiet branch just wrote, and nothing on the road can ever be focused.
    const projectedIds = new Set<string>();
    const viewport = { width: size.width, height: size.height };
    for (const marker of markers) {
      const projected = scratch.current.copy(marker.position).project(camera);
      if (projected.z >= 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const element = nodes.get(marker.id);
      if (!element) continue;
      const x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      projectedIds.add(marker.id);
      if (marker.quiet) {
        writePlacement(element, marker, x, y, false);
        // Quiet still needs `--placed: 1` so focus-visible can fade it in.
        element.style.setProperty("--placed", "1");
        continue;
      }
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const anchor: LabelAnchor = marker.origin === "start" ? "start" : "center";
      if (marker.pinned) {
        pinned.push({ marker, element, x, y, z: projected.z, width, height, anchor });
        continue;
      }
      candidates.push({
        id: marker.id,
        x,
        y,
        z: projected.z,
        // Measured, not guessed: a Chinese lesson title and a study name are
        // different widths, and a fixed box would either clip or over-reserve.
        width,
        height,
        // A study name orients the whole view, so it outranks any one course.
        weight: marker.weight ?? defaultWeight(marker),
        anchor,
      });
    }

    pinned.sort((left, right) => left.z - right.z);
    for (const item of pinned) {
      const onScreen =
        item.x >= 0 && item.y >= 0 && item.x <= viewport.width && item.y <= viewport.height;
      const box = labelBox({ x: item.x, y: item.y }, item.width, item.height, item.anchor);
      const free = onScreen && !reserved.some((other) => boxesOverlap(box, other, 4));
      writePlacement(item.element, item.marker, item.x, item.y, free);
      if (free) reserved.push(box);
    }

    for (const placement of placeLabels(candidates, viewport, {
      maxVisible: limit,
      reserved,
    })) {
      const element = nodes.get(placement.id);
      if (!element) continue;
      const marker = markers.find((entry) => entry.id === placement.id);
      if (!marker) continue;
      writePlacement(element, marker, placement.x, placement.y, placement.visible);
    }
    // Anything that did not project at all this frame is behind the camera or
    // off the far plane, and must not keep the position it had last frame.
    for (const [id, element] of nodes) {
      if (projectedIds.has(id)) continue;
      element.style.setProperty("--placed", "0");
      element.classList.remove("is-visible");
    }
  }, 2);

  return null;
}
