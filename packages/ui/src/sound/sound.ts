/**
 * The one place this product makes a noise.
 *
 * Three separate problems get solved here, and they are only in one file
 * because solving any of them alone produces something that does not work.
 *
 * **The latch.** Browsers start an `AudioContext` suspended and only a real
 * user gesture may start it. Calling `resume()` on load does not fail loudly —
 * it leaves a context reporting "running" on some browsers and silent on
 * others, so the bug appears on a stranger's machine and not on yours. This is
 * Web3D capability baseline rule 5, and it is the one thing this product took
 * from the WOC donor: donors.md grants University WOC's *audio unlock*, a code
 * pattern, and never its sounds, which are CC BY-NC and cannot ship in a paid
 * product.
 *
 * **The engine.** Not ours. `uisfx` is MIT, its audio is CC0, it has no
 * dependencies, and it *synthesises every cue from a deterministic recipe*
 * rather than fetching a file. That last property is why the audio problem
 * stopped being a licensing-and-logistics problem: there is nothing to
 * download, nothing to host, no attribution file to maintain, and no looped
 * MP3 with an encoder gap at the seam. Verified by reading the bundle: the
 * only occurrence of the string `fetch` in it is the word "fetches" inside a
 * cue description.
 *
 * **One context, not two.** The latch used to construct its own
 * `AudioContext`, and `uisfx` constructs one lazily too. Two contexts is a
 * wasted hardware voice on mobile and a browser limit waiting to be hit, so
 * the latch no longer owns a context — it owns the *timing*, and asks the
 * player to unlock the one context there is.
 */
import { createUISFX, type PlayOptions, type UISFXPlayer } from "uisfx";

import { CUE_FOR, INCIDENTAL, type SoundMoment } from "./cues.js";

/**
 * `zen` out of the twelve packs, and the pack's own brief is why: "pure tones,
 * dry wood, brief washi detail", for "mindfulness, reading, writing, calm
 * productivity". This product is a reading surface someone sits with for
 * twenty minutes. `arcade` would be funnier for ten of those minutes.
 */
const PACK = "zen" as const;

/** Incidental moments play here. See `INCIDENTAL` for why they are held down. */
const INCIDENTAL_GAIN = 0.35;

const SOUND_KEY = "university.sound";

let player: UISFXPlayer | null = null;
let armed = false;
let unlocked = false;
let enabled = readSoundEnabled();

/**
 * Sound is on unless the learner said otherwise.
 *
 * Defaulting on is defensible only because of the latch: nothing can make a
 * sound before the learner has clicked something, so this cannot ambush a
 * person who opened a tab in a quiet room. Without the latch the honest
 * default would be off.
 */
export function readSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundEnabled(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  } catch {
    // Storage disabled still gets the toggle, just not the memory.
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * The player, constructed on first use.
 *
 * `createUISFX` does not touch `AudioContext` — it is built lazily inside the
 * player, on the first `unlock()` or `play()`. Importing this module therefore
 * costs nothing and, more to the point, violates nothing.
 */
function ensurePlayer(): UISFXPlayer | null {
  if (typeof window === "undefined") return null;
  player ??= createUISFX({ pack: PACK });
  return player;
}

/** Has a gesture happened and the context actually started? */
export function isUnlocked(): boolean {
  return unlocked;
}

/**
 * Arm the latch. Safe to call on mount: it registers listeners and nothing
 * else. Returns its own disarm function, so a component can own it in an
 * effect without a second cleanup path.
 */
export function armSoundUnlock(): () => void {
  if (armed || typeof window === "undefined") return () => undefined;
  armed = true;
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const unlock = () => {
    for (const event of events) window.removeEventListener(event, unlock);
    const active = ensurePlayer();
    if (!active) return;
    void active.unlock().then((ok) => {
      unlocked = ok;
    });
  };
  for (const event of events) window.addEventListener(event, unlock, { passive: true });
  return () => {
    for (const event of events) window.removeEventListener(event, unlock);
    armed = false;
  };
}

/**
 * Play a product moment.
 *
 * Never throws and never awaits. A component asking for a sound is decorating
 * something that already happened, so a failure here — no context, a browser
 * with Web Audio switched off, a cue that got renamed — must be silence and
 * not an exception that takes the render down with it.
 */
export function playSound(moment: SoundMoment): void {
  if (!enabled || !unlocked) return;
  const active = ensurePlayer();
  if (!active) return;
  const options: PlayOptions | undefined = INCIDENTAL.has(moment)
    ? { volume: INCIDENTAL_GAIN }
    : undefined;
  try {
    active.play(CUE_FOR[moment], options);
  } catch {
    // Decoration. It is allowed to fail; it is not allowed to be loud about it.
  }
}

/** Testing seam: forget the latch, the player and the cached preference. */
export function resetSoundForTests(): void {
  player = null;
  armed = false;
  unlocked = false;
  enabled = readSoundEnabled();
}
