import * as THREE from "three";

/**
 * Where the camera stands so an arena fills the stage (ADR-0011, scene layer).
 *
 * The frame lays hearts, score and the round's question over the top of the
 * canvas, so the arena is fitted into the band below them rather than the
 * whole canvas. A tall phone looks down more steeply than a wide screen, which
 * spends its height on depth instead of on sky.
 */
export interface ArenaBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface StageFit {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly fov: number;
}

export interface FitOptions {
  readonly fov?: number;
  /** Share of the canvas height covered at the top (HUD and question). */
  readonly top?: number;
  /** Share of the canvas height left clear at the bottom. */
  readonly bottom?: number;
  /** Share of the canvas width left clear at each side. */
  readonly side?: number;
}

function corners(box: ArenaBox): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [box.min[0], box.max[0]])
    for (const y of [box.min[1], box.max[1]])
      for (const z of [box.min[2], box.max[2]]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/** Pitch below the horizon, by aspect: steeper for tall stages. */
export function stagePitch(aspect: number): number {
  const t = Math.min(1, Math.max(0, (1.3 - aspect) / 0.8));
  return THREE.MathUtils.degToRad(50 + 14 * t);
}

export function fitStage(box: ArenaBox, aspect: number, options: FitOptions = {}): StageFit {
  const fov = options.fov ?? 36;
  const top = options.top ?? 0.2;
  const bottom = options.bottom ?? 0.03;
  const side = options.side ?? 0.03;
  const pitch = stagePitch(aspect);
  const direction = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400);
  const points = corners(box);
  const target = new THREE.Vector3(
    (box.min[0] + box.max[0]) / 2,
    box.min[1],
    (box.min[2] + box.max[2]) / 2,
  );
  // The band the arena may use, in normalised device coordinates.
  const yHigh = 1 - 2 * top;
  const yLow = -1 + 2 * bottom;
  const xLimit = 1 - 2 * side;
  const project = (distance: number) => {
    camera.position.copy(target).addScaledVector(direction, -distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let xMax = 0,
      yMin = Infinity,
      yMax = -Infinity;
    for (const point of points) {
      const p = point.clone().project(camera);
      xMax = Math.max(xMax, Math.abs(p.x));
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
    return { xMax, yMin, yMax };
  };
  const closest = () => {
    let near = 2,
      far = 200;
    for (let i = 0; i < 40; i += 1) {
      const mid = (near + far) / 2;
      const { xMax, yMin, yMax } = project(mid);
      if (xMax <= xLimit && yMax - yMin <= yHigh - yLow) far = mid;
      else near = mid;
    }
    return far;
  };
  // Alternate: find the closest distance that fits, then slide the target so
  // the arena sits in the middle of its band; refit after the last slide.
  const span = box.max[2] - box.min[2];
  for (let round = 0; round < 4; round += 1) {
    const { yMin, yMax } = project(closest());
    const offset = (yMin + yMax) / 2 - (yHigh + yLow) / 2;
    // Sliding the target toward the camera lowers the arena on screen.
    target.z -= offset * span * 0.5;
  }
  const fitted = closest();
  // A slide can leave the band a hair short; step back until nothing pokes out.
  let distance = fitted;
  for (let i = 0; i < 20; i += 1) {
    const { xMax, yMin, yMax } = project(distance);
    if (xMax <= xLimit && yMax <= yHigh && yMin >= yLow) break;
    distance *= 1.01;
  }
  project(distance);
  return { position: camera.position.clone(), target: target.clone(), fov };
}
