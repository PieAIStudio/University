/**
 * Camera rig and the one overlay projector.
 *
 * These lived in the delivery shell. The authoring shell taking the same
 * scene means they live next to it: one MapControls, one label pass. A
 * second copy of either is two answers to "where is the camera" and "which
 * names are on screen".
 */
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
} from "./labels";
import type { Marker } from "./Maps";

export const MAP_CONTROLS_HINT = "拖动平移 · 滚轮缩放 · 点岛进入";

export const WORLD_POLAR = THREE.MathUtils.degToRad(54);
/**
 * Inside a course the eye is on the road, not above it.
 *
 * This tilt is pinned at both ends by `Controls`, which makes it — not the
 * camera position — the thing that decides how high the shot sits.
 */
export const COURSE_POLAR = THREE.MathUtils.degToRad(74);

export const COURSE_DISTANCE = 38;
export const COURSE_DISTANCE_MIN = 22;
export const COURSE_DISTANCE_MAX = 48;
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

  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const instance = controls.current;
      if (!instance) return;
      event.preventDefault();
      event.stopPropagation();
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
    if (Math.abs(polarRef.current - COURSE_POLAR) < 1e-6) {
      instance.target.z += COURSE_LOOK_PULL;
    }
  }, [target]);

  useFrame((_, delta) => {
    const instance = controls.current;
    if (!instance) return;
    if (Math.abs(polarRef.current - COURSE_POLAR) < 1e-6) {
      const dist = camera.position.distanceTo(instance.target);
      if (dist > COURSE_DISTANCE_MAX + 0.05) {
        const dir = camera.position.clone().sub(instance.target);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
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

  const key = `${to.join()}|${look.join()}`;
  useEffect(() => {
    from.current = {
      position: camera.position.clone(),
      target: new THREE.Vector3(...look),
      elapsed: 0,
    };
  }, [key, camera, look]);

  useFrame((_, delta) => {
    const flight = from.current;
    if (flight.elapsed >= 1) return;
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
        width,
        height,
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
    for (const [id, element] of nodes) {
      if (projectedIds.has(id)) continue;
      element.style.setProperty("--placed", "0");
      element.classList.remove("is-visible");
    }
  }, 2);

  return null;
}
