import { createContext, useCallback, useContext, useEffect } from "react";

/** A rectangle in CSS viewport pixels, as `getBoundingClientRect` reports it. */
export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Space on the map that DOM outside the stage has claimed for a while.
 *
 * Most of what labels step around lives inside the shell and is found by
 * `mapOverlayObstacles`' selectors. A floating layer that portals to the body
 * cannot be found that way, and its owner knows its bounds better than any
 * query: 涟's answer panel reports them through SwimmerUIKit's LiquidAnchor
 * `onBoundsChange` (ADR-0012). The owner writes; the label projector reads.
 * This is layout information, never a permission or a position to point at.
 */
export interface OverlayReservations {
  set(owner: string, rect: ViewportRect | null): void;
  list(): readonly ViewportRect[];
  subscribe(listener: () => void): () => void;
}

export function createOverlayReservations(): OverlayReservations {
  const rects = new Map<string, ViewportRect>();
  const listeners = new Set<() => void>();
  return {
    set(owner, rect) {
      const before = rects.get(owner);
      if (
        rect === null
          ? before === undefined
          : before !== undefined &&
            before.x === rect.x &&
            before.y === rect.y &&
            before.width === rect.width &&
            before.height === rect.height
      )
        return;
      if (rect === null) rects.delete(owner);
      else rects.set(owner, rect);
      for (const listener of listeners) listener();
    },
    list: () => [...rects.values()],
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const OverlayReservationsContext = createContext<OverlayReservations | null>(null);

/** Claim map space for `owner`; the claim ends with the component. */
export function useOverlayReservation(owner: string): (rect: ViewportRect | null) => void {
  const reservations = useContext(OverlayReservationsContext);
  useEffect(() => () => reservations?.set(owner, null), [reservations, owner]);
  return useCallback((rect) => reservations?.set(owner, rect), [reservations, owner]);
}
