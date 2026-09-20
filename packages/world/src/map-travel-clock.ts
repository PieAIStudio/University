import { createContext } from "react";
import { HOP_DURATION_MS } from "./avatar/hop.js";

/** One viewport-local choice, shared by its cloud and rider. It contains no
 * navigation or progress state and never starts a move by itself. */
export interface MapTravelClock {
  request: { readonly key: string; readonly at: number } | null;
}

export const MapTravelClockContext = createContext<MapTravelClock | null>(null);

export function recordMapTravel(clock: MapTravelClock | null, key: string, at: number): void {
  if (clock && Number.isFinite(at) && at >= 0) {
    clock.request = { key: key.replace(/^kind:/, ""), at };
  }
}

/** Catch up time spent committing the selected destination, not time before
 * an unrelated old click. Programmatic arrivals keep their existing clock.
 * The animation duration and the click-to-arrival limit are unchanged. */
export function mapTravelStartTime(
  clock: MapTravelClock | null,
  key: string | null,
  committedAt: number,
): number {
  const request = clock?.request;
  return request &&
    key !== null &&
    request.key === key.replace(/^kind:/, "") &&
    Number.isFinite(request.at) &&
    request.at >= 0 &&
    request.at <= committedAt &&
    committedAt - request.at <= HOP_DURATION_MS
    ? request.at
    : committedAt;
}
