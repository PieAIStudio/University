/** This function is serialized into the opaque-origin iframe, never called in the host. */
export function prototypeRuntime() {
  const realFrame = window.requestAnimationFrame.bind(window);
  const cancelFrame = window.cancelAnimationFrame.bind(window);
  const now = performance.now.bind(performance);
  const epoch = Date.now();
  let clock = now(),
    previous = clock,
    paused = false,
    muted = true,
    stopped = false,
    nextId = 0,
    pump = 0;
  const started = clock;
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, { fn: () => void; due: number; interval: number }>();
  const contexts = new Set<AudioContext>();
  const Audio = window.AudioContext;
  if (Audio) {
    class IsolatedAudio extends Audio {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.add(this);
        if (muted || paused) void this.suspend();
      }
      override resume() {
        return muted || paused || stopped ? Promise.resolve() : super.resume();
      }
    }
    window.AudioContext = IsolatedAudio;
  }
  Object.defineProperty(performance, "now", { value: () => clock });
  Date.now = () => epoch + clock - started;
  window.requestAnimationFrame = (fn) => {
    const id = ++nextId;
    frames.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const schedule = (fn: TimerHandler, delay = 0, interval = 0, args: unknown[] = []) => {
    if (typeof fn !== "function") throw new TypeError("Only function timers are supported");
    const id = ++nextId;
    timers.set(id, { fn: () => fn(...args), due: clock + Math.max(0, delay), interval });
    return id;
  };
  window.setTimeout = ((fn: TimerHandler, delay?: number, ...args: unknown[]) =>
    schedule(fn, delay, 0, args)) as typeof window.setTimeout;
  window.setInterval = ((fn: TimerHandler, delay = 0, ...args: unknown[]) =>
    schedule(fn, delay, Math.max(1, delay), args)) as typeof window.setInterval;
  window.clearTimeout = window.clearInterval = (id) => {
    if (typeof id === "number") timers.delete(id);
  };
  function tick() {
    if (stopped) return;
    const time = now();
    if (!paused && !document.hidden) {
      clock += time - previous;
      const pending = [...frames];
      frames.clear();
      for (const [, fn] of pending) fn(clock);
      // A callback may schedule another zero-delay timer. Snapshot this tick
      // rather than allowing newly inserted timers to loop within one frame.
      const pendingTimers = Array.from(timers);
      for (const [id, timer] of pendingTimers)
        if (timer.due <= clock && timers.has(id)) {
          if (timer.interval) timer.due = clock + timer.interval;
          else timers.delete(id);
          timer.fn();
        }
    }
    previous = time;
    pump = realFrame(tick);
  }
  function silence() {
    for (const context of contexts) if (context.state !== "closed") void context.suspend();
  }
  function stop() {
    stopped = true;
    cancelFrame(pump);
    frames.clear();
    timers.clear();
    for (const context of contexts) if (context.state !== "closed") void context.close();
  }
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", () => {
    previous = now();
    if (document.hidden) silence();
    else if (!paused && !muted && !stopped)
      for (const context of contexts) if (context.state === "suspended") void context.resume();
  });
  for (const name of ["click", "pointerdown", "pointerup", "keydown", "keyup", "touchstart"])
    document.addEventListener(
      name,
      (event) => {
        if (paused || stopped) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true, passive: false },
    );
  window.addEventListener("message", (event) => {
    // Opaque srcdoc origins require '*'. Trust the window identity and a closed message vocabulary.
    if (
      event.source !== parent ||
      !event.data ||
      event.data.type !== "university-prototype-settings"
    )
      return;
    const data = event.data;
    if (data.stop === true) {
      stop();
      return;
    }
    if (
      typeof data.paused !== "boolean" ||
      typeof data.muted !== "boolean" ||
      !["light", "night"].includes(data.theme) ||
      !data.tokens ||
      typeof data.tokens !== "object"
    )
      return;
    paused = data.paused;
    muted = data.muted;
    document.documentElement.dataset.gameUiTheme = data.theme;
    for (const [key, value] of Object.entries(data.tokens)) {
      if (
        /^--game-ui-[a-z0-9-]+$/.test(key) &&
        typeof value === "string" &&
        value.length < 500 &&
        !/[<>;{}]|url\s*\(/i.test(value)
      )
        document.documentElement.style.setProperty(key, value);
    }
    document.documentElement.toggleAttribute("data-paused", paused);
    if (paused || muted) silence();
    else for (const context of contexts) if (context.state === "suspended") void context.resume();
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]"))
        event.preventDefault();
    },
    true,
  );
  // Remove decoration only; physical movement that is part of a game remains playable and pausable.
  const animate = Element.prototype.animate;
  if (animate)
    Element.prototype.animate = function (frames, options) {
      return animate.call(
        this,
        frames,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? { duration: 1 } : options,
      );
    };
  pump = realFrame(tick);
}

export function buildPrototypeDocument(
  source: string,
  presentation: string,
  entryId?: string,
): string {
  if (entryId !== undefined && !/^[a-z0-9-]+$/.test(entryId))
    throw new Error("Invalid prototype ID");
  // The only source is committed HTML imported by the app. No HTML entered by a learner is accepted.
  const body = source
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  return `<!doctype html><html lang="zh-CN"${entryId ? ' data-single-prototype="true"' : ""}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<script>window.__PLAY_CATALOG_ENTRY__=${JSON.stringify(entryId ?? "")};(${prototypeRuntime.toString()})();</script>
</head><body>${body}<style>${presentation}</style></body></html>`;
}
