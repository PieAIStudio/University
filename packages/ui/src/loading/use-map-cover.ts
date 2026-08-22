import { useEffect, useRef, useState } from "react";

/** How long a later suspend may last before the overlay is allowed back. */
export const MAP_COVER_REOPEN_MS = 200;

/**
 * A stuck overlay is worse than a black canvas. If the scene never reports
 * ready, this is the last moment the cover is allowed to stay up.
 */
export const MAP_COVER_GIVE_UP_MS = 20_000;

/**
 * Whether the DOM loading overlay should be in the tree.
 *
 * First busy: cover immediately, because the first frame of the canvas is
 * what reads as a broken page. Later busy (a course scene suspending after
 * the world has already painted): wait a beat, so a cached GLTF does not
 * flash the overlay for one frame. Hide the instant busy ends. Unmount, do
 * not opacity-0 — an invisible overlay still steals clicks.
 */
export function useMapCover(busy: boolean): boolean {
  const [cover, setCover] = useState(busy);
  const seenReady = useRef(false);

  useEffect(() => {
    if (!busy) {
      seenReady.current = true;
      setCover(false);
      return;
    }

    if (!seenReady.current) {
      setCover(true);
      const giveUp = window.setTimeout(() => setCover(false), MAP_COVER_GIVE_UP_MS);
      return () => window.clearTimeout(giveUp);
    }

    const showLater = window.setTimeout(() => setCover(true), MAP_COVER_REOPEN_MS);
    const giveUp = window.setTimeout(() => setCover(false), MAP_COVER_GIVE_UP_MS);
    return () => {
      window.clearTimeout(showLater);
      window.clearTimeout(giveUp);
    };
  }, [busy]);

  return cover;
}
