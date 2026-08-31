import { useEffect, useRef, useState } from "react";

/** How long a later suspend may last before the overlay is allowed back. */
export const MAP_COVER_REOPEN_MS = 200;

/**
 * A stuck overlay is worse than a black canvas. If the scene never reports
 * ready, this is the last moment the cover is allowed to stay up.
 */
export const MAP_COVER_GIVE_UP_MS = 20_000;

export interface MapCoverState {
  readonly cover: boolean;
  readonly timedOut: boolean;
}

/**
 * Whether the DOM loading overlay should be in the tree.
 *
 * First busy: cover immediately, because the first frame of the canvas is
 * what reads as a broken page. Later busy (a course scene suspending after
 * the world has already painted): wait a beat, so a cached GLTF does not
 * flash the overlay for one frame. Hide the instant busy ends. Unmount, do
 * not opacity-0 — an invisible overlay still steals clicks.
 */
export function useMapCoverState(busy: boolean, attempt = 0): MapCoverState {
  const [state, setState] = useState<MapCoverState>({ cover: busy, timedOut: false });
  const seenReady = useRef(false);
  const previousAttempt = useRef(attempt);

  useEffect(() => {
    const restarted = previousAttempt.current !== attempt;
    previousAttempt.current = attempt;

    if (!busy) {
      seenReady.current = true;
      setState({ cover: false, timedOut: false });
      return;
    }

    const coverImmediately = !seenReady.current || restarted;
    setState({ cover: coverImmediately, timedOut: false });

    if (coverImmediately) {
      // The cover gives way to RecoveryState at this boundary, not to a blank
      // canvas. That preserves the first-frame protection without trapping a
      // learner behind an overlay that can no longer explain itself.
      const giveUp = window.setTimeout(
        () => setState({ cover: false, timedOut: true }),
        MAP_COVER_GIVE_UP_MS,
      );
      return () => window.clearTimeout(giveUp);
    }

    const showLater = window.setTimeout(
      () => setState((current) => ({ ...current, cover: true })),
      MAP_COVER_REOPEN_MS,
    );
    const giveUp = window.setTimeout(
      () => setState({ cover: false, timedOut: true }),
      MAP_COVER_GIVE_UP_MS,
    );
    return () => {
      window.clearTimeout(showLater);
      window.clearTimeout(giveUp);
    };
  }, [attempt, busy]);

  return state;
}

export function useMapCover(busy: boolean): boolean {
  return useMapCoverState(busy).cover;
}
