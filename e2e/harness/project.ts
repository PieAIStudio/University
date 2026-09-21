/**
 * One NDC → viewport-pixel conversion for the e2e suite.
 *
 * Sixteen call sites each wrote `.project(camera)` and then guessed the rest:
 * some added `canvas.getBoundingClientRect()` left/top, some used `size` or
 * `window.innerWidth`, some compared the result to a DOM box. `island-pick`
 * spent five rounds mixing stage coordinates with viewport coordinates
 * (see the "One step from the island" comment there). One implementation
 * here, so the next test does not guess again.
 *
 * These functions run inside `page.evaluate`. Playwright cannot close over
 * Node imports, so `withProject` rehydrates this factory from its source.
 */

export type ViewportPoint = { readonly x: number; readonly y: number; readonly z: number };

export type ViewportRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type Projectable = {
  clone(): { project(camera: unknown): { x: number; y: number; z: number } };
};

type CanvasSource =
  | { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
  | { getBoundingClientRect(): { left: number; top: number; width: number; height: number } };

type CameraSource = {
  position: { clone(): { set(x: number, y: number, z: number): Projectable } };
};

type SceneSource = { getObjectByName(name: string): object | undefined | null };

export type ProjectHelpers = {
  readonly projectWorldToViewport: (
    worldPoint: Projectable,
    camera: unknown,
    canvas: CanvasSource,
  ) => ViewportPoint;
  readonly projectObjectViewportRect: (
    objectOrName: string | object,
    camera: CameraSource,
    canvas: CanvasSource,
    scene?: SceneSource,
  ) => ViewportRect;
};

function createProjectHelpers(): ProjectHelpers {
  function canvasRect(canvas: CanvasSource) {
    return "getBoundingClientRect" in canvas ? canvas.getBoundingClientRect() : canvas;
  }

  function projectWorldToViewport(
    worldPoint: Projectable,
    camera: unknown,
    canvas: CanvasSource,
  ): ViewportPoint {
    const rect = canvasRect(canvas);
    const ndc = worldPoint.clone().project(camera);
    return {
      x: rect.left + ((ndc.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - ndc.y) * rect.height) / 2,
      z: ndc.z,
    };
  }

  function projectObjectViewportRect(
    objectOrName: string | object,
    camera: CameraSource,
    canvas: CanvasSource,
    scene?: SceneSource,
  ): ViewportRect {
    const object: any =
      typeof objectOrName === "string" ? scene?.getObjectByName(objectOrName) : objectOrName;
    if (!object) throw new Error(`No object to project (${String(objectOrName)})`);
    object.updateWorldMatrix?.(true, true);
    let box: any;
    object.traverse?.((child: any) => {
      if (box) return;
      child.geometry?.computeBoundingBox?.();
      if (child.geometry?.boundingBox) box = child.geometry.boundingBox.clone().makeEmpty();
    });
    if (!box) throw new Error(`No bounding box to project (${String(objectOrName)})`);
    box.setFromObject(object);
    const scratch = camera.position.clone();
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const pixel = projectWorldToViewport(scratch.set(x, y, z), camera, canvas);
          left = Math.min(left, pixel.x);
          right = Math.max(right, pixel.x);
          top = Math.min(top, pixel.y);
          bottom = Math.max(bottom, pixel.y);
        }
    return { left, right, top, bottom };
  }

  return { projectWorldToViewport, projectObjectViewportRect };
}

/** World point → viewport pixels, including the canvas offset on the page. */
export function projectWorldToViewport(
  worldPoint: Projectable,
  camera: unknown,
  canvas: CanvasSource,
): ViewportPoint {
  return createProjectHelpers().projectWorldToViewport(worldPoint, camera, canvas);
}

/**
 * Object3D (by name or by an existing reference) world AABB corners →
 * viewport-pixel `{left, right, top, bottom}`.
 */
export function projectObjectViewportRect(
  objectOrName: string | object,
  camera: CameraSource,
  canvas: CanvasSource,
  scene?: SceneSource,
): ViewportRect {
  return createProjectHelpers().projectObjectViewportRect(objectOrName, camera, canvas, scene);
}

/**
 * Bind the two helpers into a `page.evaluate` callback. Playwright serializes
 * the returned function by `toString`; Node closures never arrive in the page.
 */
export function withProject<Result, Arg = void>(
  fn: (project: ProjectHelpers, arg: Arg) => Result,
): (arg: Arg) => Result {
  // Playwright evaluate cannot close over this module. The page runs the
  // source of this function, which reconstructs the same factory.
  return new Function(
    "arg",
    `const project = (${createProjectHelpers.toString()})(); return (${fn.toString()})(project, arg);`,
  ) as (arg: Arg) => Result;
}
