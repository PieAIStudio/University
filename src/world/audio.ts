/**
 * The audio latch.
 *
 * Baseline rule 5: never call `resume()` before a real gesture. Browsers start
 * an AudioContext suspended and only a user gesture may start it; calling
 * `resume()` on load does not fail loudly — it leaves a context that says
 * "running" on some browsers and stays mute on others, which is the worst of
 * both, because the bug then only appears on someone else's machine.
 *
 * This product has no sounds yet. The latch exists anyway, and it exists now
 * rather than later, because the rule is about *when* the first call happens
 * and that is decided by the shape of the code long before there is anything to
 * play. Adding a sound later means calling `unlocked()` — not rediscovering
 * this problem.
 */
let context: AudioContext | null = null;
let armed = false;

/** Has a gesture happened yet? Callers must not start audio before this. */
export function isUnlocked(): boolean {
  return context !== null && context.state === "running";
}

/**
 * Arm the latch. Safe to call on mount: it only registers listeners, and the
 * context itself is not constructed until the first gesture arrives.
 */
export function armAudioUnlock(): () => void {
  if (armed) return () => undefined;
  armed = true;
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const unlock = () => {
    context ??= new AudioContext();
    void context.resume();
    for (const event of events) window.removeEventListener(event, unlock);
  };
  for (const event of events) window.addEventListener(event, unlock, { passive: true });
  return () => {
    for (const event of events) window.removeEventListener(event, unlock);
    armed = false;
  };
}

/** The context, or null when no gesture has happened. Never constructs one. */
export function audioContext(): AudioContext | null {
  return context;
}
