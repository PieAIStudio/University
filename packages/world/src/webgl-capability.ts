let cached: boolean | undefined;

/**
 * Probe once per document/scene attempt whether the browser can create a WebGL context.
 * Every small avatar viewport shares this answer with the world Stage, so a
 * browser without WebGL does not create secondary R3F errors after the map has
 * already explained the recovery path. A human retry may explicitly clear it.
 */
export function hasWebGLContext(): boolean {
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  try {
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/** Let the recovery button re-probe after a transient browser/GPU failure. */
export function resetWebGLContextProbe(): void {
  cached = undefined;
}
