/**
 * A small, renderer-independent visibility probe for the learner avatar.
 *
 * The course camera is allowed to change as the island layout changes, so a
 * screenshot-only judgement is too easy to regress. An 8 × 12 grid samples
 * the current projected avatar bounds. Empty cells in that AABB are excluded;
 * a ray is blocked only when a non-avatar scene object is hit before the
 * avatar surface. This catches terrain and foliage without depending on
 * their colours, materials, or draw order.
 */
import * as THREE from "three";

export const AVATAR_OCCLUSION_TARGET = "university-avatar-occlusion-target";
export const AVATAR_OCCLUSION_GRID = { columns: 8, rows: 12 } as const;
export const AVATAR_OCCLUSION_MAX_SHARE = 0;

export interface AvatarOcclusionBlocker {
  readonly object: string;
  readonly distance: number;
}

export interface AvatarOcclusionReport {
  readonly ready: boolean;
  readonly targetFound: boolean;
  /** Candidate screen-space rays cast inside the avatar's projected bounds. */
  readonly candidateRayCount: number;
  /** Candidate rays that hit avatar geometry and therefore enter the denominator. */
  readonly avatarSurfaceRayCount: number;
  readonly blockedRayCount: number;
  /** 0 means every sampled path from camera to avatar is clear. */
  readonly avatarOcclusionShare: number | null;
  readonly clearRayShare: number | null;
  readonly blockers: readonly AvatarOcclusionBlocker[];
  readonly targetBounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  } | null;
}

const EMPTY_REPORT: AvatarOcclusionReport = {
  ready: false,
  targetFound: false,
  candidateRayCount: AVATAR_OCCLUSION_GRID.columns * AVATAR_OCCLUSION_GRID.rows,
  avatarSurfaceRayCount: 0,
  blockedRayCount: 0,
  avatarOcclusionShare: null,
  clearRayShare: null,
  blockers: [],
  targetBounds: null,
};

function isAvatarTarget(object: THREE.Object3D): boolean {
  return object.name === AVATAR_OCCLUSION_TARGET;
}

function isDescendantOf(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function objectLabel(object: THREE.Object3D): string {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name) return current.name;
    current = current.parent;
  }
  if (object instanceof THREE.Mesh && object.geometry.name) {
    return `geometry:${object.geometry.name}`;
  }
  if (object instanceof THREE.Mesh) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const namedMaterial = materials.find((material) => material.name);
    if (namedMaterial?.name) return `material:${namedMaterial.name}`;
  }
  return object.type;
}

function findAvatarTarget(scene: THREE.Scene): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  scene.traverse((object) => {
    if (!found && isAvatarTarget(object)) found = object;
  });
  return found;
}

function projectedBounds(box: THREE.Box3, camera: THREE.Camera) {
  const points: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        points.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  return {
    minX: Math.max(-1, Math.min(...points.map((point) => point.x))),
    maxX: Math.min(1, Math.max(...points.map((point) => point.x))),
    minY: Math.max(-1, Math.min(...points.map((point) => point.y))),
    maxY: Math.min(1, Math.max(...points.map((point) => point.y))),
  };
}

/** Measure the current scene pose. Safe to call from a DEV browser console. */
export function measureAvatarOcclusion(
  scene: THREE.Scene,
  camera: THREE.Camera,
): AvatarOcclusionReport {
  const target = findAvatarTarget(scene);
  if (!target) return EMPTY_REPORT;

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(target);
  if (bounds.isEmpty()) return { ...EMPTY_REPORT, targetFound: true };

  const boundsOnScreen = projectedBounds(bounds, camera);
  const raycaster = new THREE.Raycaster();
  const blockers: AvatarOcclusionBlocker[] = [];
  let avatarSurfaceRayCount = 0;
  for (let row = 0; row < AVATAR_OCCLUSION_GRID.rows; row += 1) {
    for (let column = 0; column < AVATAR_OCCLUSION_GRID.columns; column += 1) {
      const x =
        boundsOnScreen.minX +
        ((column + 0.5) / AVATAR_OCCLUSION_GRID.columns) *
          (boundsOnScreen.maxX - boundsOnScreen.minX);
      const y =
        boundsOnScreen.maxY -
        ((row + 0.5) / AVATAR_OCCLUSION_GRID.rows) * (boundsOnScreen.maxY - boundsOnScreen.minY);
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const avatarHit = raycaster.intersectObject(target, true)[0];
      // Empty space inside the AABB (ears, arms, or the rounded silhouette)
      // is not an occlusion. Only a ray that can actually see avatar geometry
      // enters the denominator.
      if (!avatarHit) continue;
      avatarSurfaceRayCount += 1;
      const firstSceneHit = raycaster.intersectObjects(scene.children, true)[0];
      if (
        firstSceneHit &&
        !isDescendantOf(firstSceneHit.object, target) &&
        firstSceneHit.distance < avatarHit.distance - 0.025
      ) {
        blockers.push({
          object: objectLabel(firstSceneHit.object),
          distance: Number(firstSceneHit.distance.toFixed(3)),
        });
      }
    }
  }

  const blockedRayCount = blockers.length;
  const avatarOcclusionShare =
    avatarSurfaceRayCount > 0 ? blockedRayCount / avatarSurfaceRayCount : null;
  return {
    ready: true,
    targetFound: true,
    candidateRayCount: AVATAR_OCCLUSION_GRID.columns * AVATAR_OCCLUSION_GRID.rows,
    avatarSurfaceRayCount,
    blockedRayCount,
    avatarOcclusionShare:
      avatarOcclusionShare === null ? null : Number(avatarOcclusionShare.toFixed(4)),
    clearRayShare:
      avatarOcclusionShare === null ? null : Number((1 - avatarOcclusionShare).toFixed(4)),
    blockers,
    targetBounds: {
      min: [bounds.min.x, bounds.min.y, bounds.min.z],
      max: [bounds.max.x, bounds.max.y, bounds.max.z],
    },
  };
}
