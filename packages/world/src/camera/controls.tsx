/*
  The camera, the flight and the one overlay projector — shared, with the
  reasons they are shaped this way.

  This file previously existed twice: here, and in `apps/online/src/app/`. The
  copy that landed here had every explanatory comment stripped out, and one of
  those comments was load-bearing. `Flight`'s effect is keyed on a *string* of
  the coordinates rather than on the arrays, because `to` and `look` are array
  literals with a fresh identity on every render; the stripped copy put `look`
  back in the dependency list, which re-fires the effect continuously, resets
  `elapsed` to zero, and produces a tween that never arrives. The comment was
  the only thing standing between that code and that bug, and deleting it
  deleted the fix within one commit.

  So the version with its reasons is the one that survives, and there is one of
  it.
*/
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

import {
  boxesOverlap,
  clampLabelOutOfChrome,
  FOLLOW_CLEARANCE,
  labelBox,
  placeLabels,
  type LabelAnchor,
  type LabelBox,
  type LabelCandidate,
} from "@pieai/university-world/labels.js";
import type { Marker } from "../Maps";
import { pinchDollyArmed } from "./pinch-dolly.js";
import { wheelIntent } from "./wheel-intent.js";

/**
 * MapControls only handles `TWO` as `DOLLY_PAN` or `DOLLY_ROTATE`. Assigning
 * `TOUCH.PAN` looks like "pan only" and is a silent no-op: two pointers fall
 * through to `state = NONE`, so a two-finger map move does nothing. Keep
 * `DOLLY_PAN` for the pan half, and arm dolly only after a real pinch.
 */
type TouchDollyControls = MapControls & {
  _handleTouchStartDolly: (event: PointerEvent) => void;
  _handleTouchMoveDolly: (event: PointerEvent) => void;
  _getSecondPointerPosition: (event: PointerEvent) => { x: number; y: number };
  _updateZoomParameters: (x: number, y: number) => void;
  _dollyStart: THREE.Vector2;
  _dollyEnd: THREE.Vector2;
  _dollyDelta: THREE.Vector2;
  _dollyOut: (scale: number) => void;
};

function installTouchDollyDeadzone(instance: MapControls) {
  const controls = instance as TouchDollyControls;
  const startDolly = controls._handleTouchStartDolly.bind(controls);
  let originSpan = 0;
  let armed = false;
  controls._handleTouchStartDolly = (event) => {
    startDolly(event);
    originSpan = controls._dollyStart.y;
    armed = false;
  };
  controls._handleTouchMoveDolly = (event) => {
    const other = controls._getSecondPointerPosition(event);
    const span = Math.hypot(event.pageX - other.x, event.pageY - other.y);
    if (!pinchDollyArmed(originSpan, span, armed)) return;
    if (!armed) {
      armed = true;
      controls._dollyStart.set(0, span);
      return;
    }
    controls._dollyEnd.set(0, span);
    controls._dollyDelta.set(0, Math.pow(span / controls._dollyStart.y, controls.zoomSpeed));
    controls._dollyOut(controls._dollyDelta.y);
    controls._dollyStart.copy(controls._dollyEnd);
    controls._updateZoomParameters((event.pageX + other.x) * 0.5, (event.pageY + other.y) * 0.5);
  };
}

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
export {
  MapControlsHint,
  MapEntryHint,
  mapControlsHint,
  mapEntryHint,
} from "../labels/map-controls-hint.js";
export type { MapPointer } from "../labels/map-controls-hint.js";

export const WORLD_POLAR = THREE.MathUtils.degToRad(54);
/**
 * Inside a course the eye is above the island, not down a road.
 *
 * This was 74° — a road going away from you — and every reason given for it
 * has since stopped being true. There is no climb to read as a climb, because
 * the lessons lie on one island's surface instead of on 41 islands stepping up
 * through the air; and stones overlapping into a line is what you want when
 * the line *is* the subject, not when the subject is a piece of ground with
 * markers on it. At 74° that ground is seen almost edge-on and the far half of
 * it is a sliver.
 *
 * 66° is a deliberate course-only change from the world map's 54°. It is a
 * 24° depression from the horizon: enough to put the island and the road into
 * the upper half of the frame, while the front-side eye still shows the
 * avatar's face.
 * Entering a course therefore reads as arriving on the island, not as looking
 * at the same high map from a slightly different distance.
 *
 * The tilt is pinned at both ends by `Controls`, which makes it — not the
 * camera position — the thing that decides how high the shot sits: `Flight`
 * sets the distance to the target and `MapControls.update()` then forces the
 * angle, so any offset tuned into the eye position is overwritten next frame.
 */
export const COURSE_POLAR = THREE.MathUtils.degToRad(66);

/**
 * How far the eye sits from the look target inside a course.
 *
 * The course contact sheet showed that the old 36-unit landing shot made the
 * avatar a background landmark. The selected 23-unit shot is the first close
 * composition where the face, the live node and a short readable run of the
 * road share the frame on both desktop and phone. The 18-unit end remains
 * available for inspecting the immediate ground; 54 keeps enough reach to
 * look ahead without returning to an island overview.
 *
 * The span is exactly 3×, the same ceiling used by the world map. Height is
 * not a lever — polar is pinned — so the route frame and this range are tuned
 * together.
 */
export const COURSE_DISTANCE = 23;
export const COURSE_DISTANCE_MIN = 18;
export const COURSE_DISTANCE_MAX = 54;
/**
 * World-map dolly range. The lever is distance, not camera height: polar is
 * pinned, and MapControls rebuilds position from (target, distance, azimuth).
 *
 * These were 6 and 460 once — a 76× span that let the eye sit inside an
 * island's mesh — then 90 and 270, tuned against a radial tree that spread a
 * study across a disc. The study is a road now: eleven units wide and as long
 * as it has courses. Ninety units back from a road that narrow spends most of
 * the frame on sea, and the islands come out at about 4% of the viewport.
 *
 * 62 puts a course island at roughly the size a lesson marker gets inside a
 * course, which is the size at which a thing reads as something you click. The
 * span is 2.9×, inside the ≤3× rule; polar is 54°, so camera height at min is
 * `WORLD_DISTANCE_MIN * cos(polar)` ≈ 36, well above the largest island.
 */
export const WORLD_DISTANCE_MIN = 62;
export const WORLD_DISTANCE_MAX = 180;
export function Controls({
  target,
  polar,
  fixedCamera,
  onInteract,
}: {
  target: readonly [number, number, number];
  /** The one tilt this view is allowed, in radians from straight down. */
  polar: number;
  /** DEV-only fixed pose for a look-contract capture. */
  fixedCamera?: {
    readonly cameraFrom: readonly [number, number, number];
    readonly lookAt: readonly [number, number, number];
  } | null;
  readonly onInteract?: () => void;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<MapControls | null>(null);
  const fixedCameraRef = useRef(fixedCamera ?? null);
  const onInteractRef = useRef(onInteract);

  const polarRef = useRef(polar);
  polarRef.current = polar;
  fixedCameraRef.current = fixedCamera ?? null;
  onInteractRef.current = onInteract;

  useEffect(() => {
    const instance = new MapControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    instance.enableRotate = false;
    instance.enabled = fixedCameraRef.current === null;
    instance.minDistance = WORLD_DISTANCE_MIN;
    instance.maxDistance = WORLD_DISTANCE_MAX;
    instance.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    installTouchDollyDeadzone(instance);
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
      instance.minDistance = WORLD_DISTANCE_MIN;
      instance.maxDistance = WORLD_DISTANCE_MAX;
    }
  }, [polar]);

  /**
   * A two-finger trackpad swipe pans. A mouse wheel zooms.
   *
   * The browser reports that swipe as a `wheel` event, and MapControls reads
   * every `wheel` as zoom — so on a laptop, the gesture every Mac user makes
   * to move a map was zooming it instead. A pinch is distinguishable: the
   * browser sets `ctrlKey` on it, which is how Apple Maps and Mapbox tell the
   * two apart, so a pinch still falls through to the zoom MapControls does.
   *
   * A mouse wheel is the same `wheel` event without `ctrlKey`. The split is
   * `wheelIntent` in `wheel-intent.ts` — measured, not guessed. Events this
   * classifies as zoom are left for MapControls; pans are applied here.
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
      const wheelDeltaY = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
      if (
        wheelIntent({
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          wheelDeltaY,
        }) === "zoom"
      ) {
        onInteractRef.current?.();
        return;
      }
      const instance = controls.current;
      if (!instance) return;
      onInteractRef.current?.();
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
    const fixed = fixedCameraRef.current;
    // `frameCourse` already supplies the live marker plus a bounded local
    // tangent. Keep that target intact so the learner's face and the road move
    // together after a route change; there is no second hidden offset here.
    instance.target.set(...(fixed?.lookAt ?? target));
  }, [fixedCamera, target]);

  useFrame((_, delta) => {
    const instance = controls.current;
    if (!instance) return;
    const fixed = fixedCameraRef.current;
    if (fixed) {
      instance.enabled = false;
      instance.target.set(...fixed.lookAt);
      camera.position.set(...fixed.cameraFrom);
      camera.lookAt(new THREE.Vector3(...fixed.lookAt));
      return;
    }
    instance.enabled = true;
    // Flight runs at priority 0 and snaps the eye to App.tsx's route-anchored
    // `from`. MapControls then rebuilds position from (target, distance,
    // polar) — so the lever is distance, not height. A world-to-course flight
    // that arrives outside the course zoom range is eased to the 23-unit
    // landing distance; a normal course URL starts inside the same range.
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
  fixed = false,
}: {
  to: readonly [number, number, number];
  look: readonly [number, number, number];
  /** DEV-only fixed-shot switch; the normal route flight is unchanged. */
  fixed?: boolean;
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
    if (fixed) return;
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

function readRailBox(stage: HTMLElement, rail: HTMLElement): LabelBox | null {
  const stageRect = stage.getBoundingClientRect();
  const railRect = rail.getBoundingClientRect();
  if (railRect.width <= 0 || railRect.height <= 0) return null;
  return {
    left: railRect.left - stageRect.left,
    top: railRect.top - stageRect.top,
    right: railRect.right - stageRect.left,
    bottom: railRect.bottom - stageRect.top,
  };
}

/**
 * Read only surfaces that can paint over the follow card.
 *
 * The rail, counter capsule, context aside and tab bar live in shell stacking
 * contexts above the stage. The next-up panel shares the stage overlay layer.
 * Transient hints are below the follow card, so treating them as obstacles can
 * exhaust both side slots for a tall card and trigger a fallback at the island
 * itself.
 */
function readChromeBoxes(stage: HTMLElement, shell: HTMLElement): readonly LabelBox[] {
  return [
    ...shell.querySelectorAll<HTMLElement>(
      ".nav-rail, .counter-row, .app-shell__aside, .nextup, .tab-bar",
    ),
  ]
    .map((element) => readRailBox(stage, element))
    .filter((box): box is LabelBox => box !== null);
}

function readCssNumber(element: HTMLElement, property: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
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
  followId = null,
  followNode,
}: {
  markers: readonly Marker[];
  limit: number;
  nodes: Map<string, HTMLElement>;
  /**
   * Marker id of the island the follow card is about. Null hides it.
   *
   * The card is the same problem as a name — a world point becomes a
   * screen-space box — so it goes through this projector rather than a
   * second one. CSS `right:` on `.picked` was a different answer to the
   * same question, and it is why collapsing the context rail stacked the
   * card on the collapse capsule.
   */
  followId?: string | null;
  followNode?: { readonly current: HTMLElement | null };
}) {
  const { camera, gl, size } = useThree();
  const scratch = useRef(new THREE.Vector3());
  const chromeBoxesRef = useRef<readonly LabelBox[]>([]);
  const followViewportHeightRef = useRef<number | null>(null);
  const labelLimitRef = useRef(limit);
  const labelGapRef = useRef(4);
  useEffect(() => {
    const stage = gl.domElement.closest<HTMLElement>(".stagewrap");
    const shell = stage?.closest<HTMLElement>(".app-shell");
    if (!stage || !shell) return;

    const update = () => {
      chromeBoxesRef.current = readChromeBoxes(stage, shell);
      labelLimitRef.current = Math.max(
        1,
        Math.floor(readCssNumber(stage, "--map-label-limit", limit)),
      );
      labelGapRef.current = Math.max(0, readCssNumber(stage, "--map-label-gap", 4));
      const tabBar = shell.querySelector<HTMLElement>(".tab-bar");
      const tabBarBox = tabBar ? readRailBox(stage, tabBar) : null;
      followViewportHeightRef.current = tabBarBox ? Math.max(0, tabBarBox.top) : null;
    };
    update();
    window.addEventListener("resize", update);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resizeObserver?.observe(shell);

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && shell) {
      mutationObserver = new MutationObserver(update);
      mutationObserver.observe(shell, {
        attributes: true,
        attributeFilter: ["data-rail-collapsed", "data-aside-collapsed"],
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [gl, limit]);
  // R3F's tree is a second React root. The follow node lives in the DOM
  // root, and this callback must not close over a stale `followId` from the
  // render that created the Canvas children the first time.
  const followIdRef = useRef(followId);
  const followNodeRef = useRef(followNode);
  followIdRef.current = followId;
  followNodeRef.current = followNode;

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
    const quietLabels: {
      marker: Marker;
      element: HTMLElement;
      x: number;
      y: number;
      width: number;
      height: number;
      anchor: LabelAnchor;
    }[] = [];
    // Every marker that projected this frame, quiet or not. The reset below
    // keys off this rather than off `candidates`, which no longer holds the
    // quiet ones — without it the reset immediately undoes the transform the
    // quiet branch just wrote, and nothing on the road can ever be focused.
    const projectedIds = new Set<string>();
    const projectedById = new Map<string, { x: number; y: number; z: number }>();
    const viewport = { width: size.width, height: size.height };
    for (const marker of markers) {
      const projected = scratch.current.copy(marker.position).project(camera);
      if (projected.z >= 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const element = nodes.get(marker.id);
      if (!element) continue;
      const x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      projectedIds.add(marker.id);
      projectedById.set(marker.id, { x, y, z: projected.z });
      if (marker.quiet) {
        quietLabels.push({
          marker,
          element,
          x,
          y,
          width: element.offsetWidth,
          height: element.offsetHeight,
          anchor: marker.origin === "start" ? "start" : "center",
        });
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
      const free =
        onScreen && !reserved.some((other) => boxesOverlap(box, other, labelGapRef.current));
      writePlacement(item.element, item.marker, item.x, item.y, free);
      if (free) reserved.push(box);
    }

    // The card lives in the DOM root; this loop runs in the Canvas root.
    // The ref is the contract. A document.querySelector would find "a"
    // follow card, not "the" follow card this probe is placing — two
    // shells on one page is not the product, but a test of this file is.
    const follow = followNodeRef.current?.current ?? null;
    const followNow = followIdRef.current;
    const hideFollow = () => {
      if (!follow) return;
      follow.style.setProperty("--placed", "0");
      follow.classList.remove("is-visible");
    };
    if (follow && followNow) {
      let at = projectedById.get(followNow);
      if (!at) {
        const marker = markers.find((entry) => entry.id === followNow);
        if (marker) {
          const projected = scratch.current.copy(marker.position).project(camera);
          if (!(projected.z >= 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1)) {
            at = {
              x: ((projected.x + 1) / 2) * size.width,
              y: ((1 - projected.y) / 2) * size.height,
              z: projected.z,
            };
          }
        }
      }
      if (!at) {
        hideFollow();
      } else {
        const followViewport = {
          width: viewport.width,
          // The fixed mobile tab bar is inside the browser viewport but above
          // the stage's visual floor. Keep the scrollable card above it.
          height: followViewportHeightRef.current ?? viewport.height,
        };
        follow.style.setProperty("--follow-viewport-height", `${followViewport.height}px`);
        const width = Math.max(follow.offsetWidth, 260);
        const height = Math.max(follow.offsetHeight, 120);
        // The card is an overlay relative to labels: it lands beside the
        // island it is about and does not reserve space from neighbouring
        // names. Opaque shell chrome is a real obstruction, though, so the
        // card must flip around it when a readable side exists. A click on one
        // island must not either hide its card or make three other titles jump.
        const [card] = placeLabels(
          [
            {
              id: "__follow",
              x: at.x,
              y: at.y,
              z: at.z,
              width,
              height,
              weight: 100,
              anchor: "aside",
              clearance: FOLLOW_CLEARANCE,
              overlay: true,
            },
          ],
          followViewport,
          { maxVisible: 1, gap: 8, obstacles: [...chromeBoxesRef.current] },
        );
        if (card?.visible) {
          follow.style.transform = `translate(${card.x}px, ${card.y}px) translate(-50%, -50%)`;
          follow.style.setProperty("--placed", "1");
          follow.classList.add("is-visible");
        } else {
          hideFollow();
        }
      }
    } else {
      hideFollow();
    }

    const namePlaced = placeLabels(candidates, viewport, {
      maxVisible: labelLimitRef.current,
      gap: labelGapRef.current,
      reserved: [...chromeBoxesRef.current, ...reserved],
    });
    for (const placement of namePlaced) {
      const element = nodes.get(placement.id);
      if (!element) continue;
      const marker = markers.find((entry) => entry.id === placement.id);
      if (!marker) continue;
      writePlacement(element, marker, placement.x, placement.y, placement.visible);
      if (placement.visible) {
        const candidate = candidates.find((entry) => entry.id === placement.id);
        if (candidate) {
          reserved.push(
            labelBox(
              { x: placement.x, y: placement.y },
              candidate.width,
              candidate.height,
              candidate.anchor,
            ),
          );
        }
      }
    }

    // Quiet names stay outside the normal avoidance contest. They are not
    // visible until focus, but their focus reveal must not land underneath the
    // opaque chrome. A focused name also gets the closest free vertical slot
    // so the boundary fix does not cover a visible icon or unit name.
    for (const item of quietLabels) {
      let position = { x: item.x, y: item.y };
      for (const chrome of chromeBoxesRef.current) {
        position = clampLabelOutOfChrome(
          { ...item, x: position.x, y: position.y },
          chrome,
          viewport,
          { reserved, labelGap: labelGapRef.current },
        );
      }
      writePlacement(item.element, item.marker, position.x, position.y, false);
      // Quiet still needs `--placed: 1` so focus-visible can fade it in.
      item.element.style.setProperty("--placed", "1");
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
