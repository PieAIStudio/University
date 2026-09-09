type Point = readonly [number, number, number];
type FocusInput =
  | { kind: "scene"; studyId: string; alignedOnly?: boolean }
  | { kind: "calibration"; centre: Point; eye: Point; focus: Point; alignedOnly?: boolean }
  | { kind: "install" };

/** Serialized by Playwright: keep all runtime dependencies inside this function.
 * Measures actual scene transforms relative to their own planet, not the
 * world origin. Calibration points are explicitly synthetic, never a scene pass.
 */
export function planetFocusSample(input: FocusInput) {
  if (input.kind === "install") {
    (window as any).__testPlanetFocusSample = planetFocusSample;
    return null;
  }
  let centre: Point, eye: Point, focus: Point;
  let domainId: string | null = null;
  if (input.kind === "calibration") {
    ({ centre, eye, focus } = input);
  } else {
    const bag = window as any;
    const state = bag.three;
    if (bag.__planetProjection?.().selectedId !== input.studyId || !state) return null;
    const marker = state.scene.getObjectByName(`planet-study-focus-${input.studyId}`);
    if (!marker) return null;
    let root = marker.parent;
    while (root && typeof root.userData?.domainId !== "string") root = root.parent;
    if (!root) return null;
    domainId = root.userData.domainId;
    centre = root.getWorldPosition(state.camera.position.clone()).toArray();
    eye = state.camera.getWorldPosition(state.camera.position.clone()).toArray();
    focus = marker.getWorldPosition(state.camera.position.clone()).toArray();
  }
  const delta = (point: Point) => point.map((value, index) => value - centre[index]!);
  const dot = (a: readonly number[], b: readonly number[]) =>
    a.reduce((sum, value, index) => sum + value * b[index]!, 0);
  const cosine = (a: readonly number[], b: readonly number[]) => {
    const length = Math.hypot(...a) * Math.hypot(...b);
    return length > 0 ? dot(a, b) / length : null;
  };
  if (![...centre, ...eye, ...focus].every(Number.isFinite)) return null;
  const alignment = cosine(delta(focus), delta(eye));
  if (alignment === null || (input.alignedOnly && alignment <= 0.999999)) return null;
  return {
    domainId,
    centre,
    eye,
    focus,
    alignment,
    legacyWorldOriginAlignment: cosine(focus, eye),
    scope: input.kind,
  };
}
