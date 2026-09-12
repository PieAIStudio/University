import type { Page } from "@playwright/test";

/** Diagnostic timer around the EXISTING complete Stage callback, not a new
 * renderer or an isolated renderer.render(scene, camera) benchmark. */
export async function measureStageGpu(page: Page) {
  return page.evaluate(async () => {
    const state = (window as any).three;
    const gl = state.gl.getContext() as WebGL2RenderingContext;
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as any;
    const owners = state.internal.subscribers.filter((s: any) => s.priority === 1);
    const scope =
      "Warm current Stage callback including shadows and post; excludes DOM compositing, other canvases and driver memory. GPU milliseconds, not FPS.";
    if (!ext || owners.length !== 1) return { available: false, scope };
    const owner = owners[0],
      original = owner.ref.current;
    const pending: WebGLQuery[] = [],
      samples: number[] = [];
    let issued = 0;
    const begun = performance.now();
    owner.ref.current = (...args: any[]) => {
      const query = issued < 48 && !gl.getParameter(ext.GPU_DISJOINT_EXT) ? gl.createQuery() : null;
      if (query) {
        issued++;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      }
      try {
        return original(...args);
      } finally {
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push(query);
        }
      }
    };
    try {
      while (samples.length < 32 && performance.now() - begun < 15000) {
        await new Promise(requestAnimationFrame);
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          pending.splice(0).forEach((q) => gl.deleteQuery(q));
          continue;
        }
        for (let i = pending.length - 1; i >= 0; i--) {
          const query = pending[i]!;
          if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
          const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
          if (Number.isFinite(ms) && ms >= 0) samples.push(ms);
          gl.deleteQuery(query);
          pending.splice(i, 1);
        }
      }
    } finally {
      owner.ref.current = original;
      pending.forEach((q) => gl.deleteQuery(q));
    }
    samples.sort((a, b) => a - b);
    return {
      available: samples.length >= 32,
      scope,
      issued,
      samples,
      medianMs: samples[Math.floor(samples.length / 2)] ?? null,
      p95Ms: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] ?? null,
    };
  });
}
