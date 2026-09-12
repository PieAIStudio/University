import * as THREE from "three";
import type { LabelBox } from "../labels/labels.js";

export interface CourseOverviewFrame {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly distanceRange: readonly [number, number];
  readonly distance: number;
  readonly radius: number;
  readonly far: number;
  readonly viewport: LabelBox;
}

/**
 * Largest unobstructed rectangle, sampled only when a framing action/resize occurs.
 * The small chrome set owns its measured rectangles; no rail width is duplicated.
 */
export function overviewViewport(
  width: number,
  height: number,
  obstacles: readonly LabelBox[],
  subjectAspect?: number,
): LabelBox {
  const margin = 12;
  const full = { left: margin, top: margin, right: width - margin, bottom: height - margin };
  const blocked = obstacles
    .map((box) => ({
      left: Math.max(full.left, box.left - 8),
      top: Math.max(full.top, box.top - 8),
      right: Math.min(full.right, box.right + 8),
      bottom: Math.min(full.bottom, box.bottom + 8),
    }))
    .filter((box) => box.right > box.left && box.bottom > box.top);
  const xs = [
    ...new Set([full.left, full.right, ...blocked.flatMap((box) => [box.left, box.right])]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([full.top, full.bottom, ...blocked.flatMap((box) => [box.top, box.bottom])]),
  ].sort((a, b) => a - b);
  let best: LabelBox | null = null;
  let area = 0;
  for (let l = 0; l < xs.length - 1; l++) {
    for (let r = l + 1; r < xs.length; r++) {
      for (let t = 0; t < ys.length - 1; t++) {
        for (let b = t + 1; b < ys.length; b++) {
          const rect = { left: xs[l]!, right: xs[r]!, top: ys[t]!, bottom: ys[b]! };
          // Area alone prefers a tall narrow strip after a compact toolbar
          // moves down. Fit the subject instead: empty sky is not useful area.
          const next =
            subjectAspect && Number.isFinite(subjectAspect) && subjectAspect > 0
              ? Math.min((rect.right - rect.left) / subjectAspect, rect.bottom - rect.top) ** 2
              : (rect.right - rect.left) * (rect.bottom - rect.top);
          if (
            next <= area ||
            blocked.some(
              (box) =>
                rect.left < box.right &&
                rect.right > box.left &&
                rect.top < box.bottom &&
                rect.bottom > box.top,
            )
          )
            continue;
          best = rect;
          area = next;
        }
      }
    }
  }
  // A covered canvas is not a valid overview and must not silently frame behind chrome.
  if (!best || best.right - best.left < 24 || best.bottom - best.top < 24)
    throw new Error("No visible map area for a course overview");
  return best;
}

/** Fits the actual top AND root with the unchanged lens and course polar angle. */
export function frameCourseOverview(
  bounds: THREE.Box3,
  eyeDirection: THREE.Vector3,
  view: {
    readonly width: number;
    readonly height: number;
    readonly fov: number;
    readonly usable: LabelBox;
  },
  supportPoints?: readonly THREE.Vector3[],
): CourseOverviewFrame {
  if (
    bounds.isEmpty() ||
    ![...bounds.min.toArray(), ...bounds.max.toArray(), view.width, view.height, view.fov].every(
      Number.isFinite,
    ) ||
    view.width <= 0 ||
    view.height <= 0 ||
    view.fov <= 0 ||
    view.fov >= 170
  )
    throw new Error("Invalid course overview bounds or viewport");
  const eye = eyeDirection.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), eye).normalize();
  const up = new THREE.Vector3().crossVectors(eye, right).normalize();
  if (right.lengthSq() < 0.5 || eye.lengthSq() < 0.5)
    throw new Error("Invalid overview eye direction");
  const center = bounds.getCenter(new THREE.Vector3());
  const points =
    supportPoints ??
    [bounds.min.x, bounds.max.x].flatMap((x) =>
      [bounds.min.y, bounds.max.y].flatMap((y) =>
        [bounds.min.z, bounds.max.z].map((z) => new THREE.Vector3(x, y, z)),
      ),
    );
  if (!points.length || points.some((p) => !Number.isFinite(p.x + p.y + p.z)))
    throw new Error("Invalid course overview support points");
  const tanY = Math.tan(THREE.MathUtils.degToRad(view.fov / 2));
  const tanX = (tanY * view.width) / view.height;
  const fitX = (tanX * (view.usable.right - view.usable.left)) / view.width;
  const fitY = (tanY * (view.usable.bottom - view.usable.top)) / view.height;
  if (fitX <= 0 || fitY <= 0) throw new Error("Invalid visible overview rectangle");
  let distance = 1;
  const corner = new THREE.Vector3();
  for (const support of points) {
    corner.copy(support).sub(center);
    const near = corner.dot(eye);
    distance = Math.max(
      distance,
      near + Math.abs(corner.dot(right)) / fitX,
      near + Math.abs(corner.dot(up)) / fitY,
    );
  }
  // Perspective magnifies off-centre points at the near side. Reserving a
  // screen margin and fitting again below includes that asymmetric shift.
  const centerX = (view.usable.left + view.usable.right - view.width) / view.width;
  const centerY = (view.usable.top + view.usable.bottom - view.height) / view.height;
  const shiftPerDistance = right
    .clone()
    .multiplyScalar(-centerX * tanX)
    .addScaledVector(up, centerY * tanY);
  for (const support of points) {
    const point = corner.copy(support).sub(center);
    const depth = point.dot(eye);
    distance = Math.max(
      distance,
      depth + Math.abs(point.dot(right) - depth * shiftPerDistance.dot(right)) / fitX,
      depth + Math.abs(point.dot(up) - depth * shiftPerDistance.dot(up)) / fitY,
    );
  }
  distance *= 1.08;
  const target = center.clone().addScaledVector(shiftPerDistance, distance);
  const position = target.clone().addScaledVector(eye, distance);
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  return {
    cameraFrom: position.toArray(),
    lookAt: target.toArray(),
    distanceRange: [distance / 2, distance * 1.4],
    distance,
    radius,
    far: Math.max(1200, distance * 1.4 + radius * 2 + 1),
    viewport: view.usable,
  };
}
