import type { DispatchActivity } from "./types.js";

export interface DispatchDelivery {
  readonly cardId: string;
  readonly laneId: string;
  readonly cost: number;
  readonly cacheKey?: string;
  readonly cacheHit: boolean;
  readonly warmed: boolean;
}

export interface DispatchState {
  readonly cursor: number;
  readonly spent: number;
  readonly warmedCacheKeys: readonly string[];
  readonly deliveries: readonly DispatchDelivery[];
}

export type DispatchStatus = "active" | "completed" | "over-budget";
export type DispatchRejection =
  | "round-ended"
  | "unknown-lane"
  | "cache-unavailable"
  | "lane-not-allowed"
  | "invalid-cost";

export type DispatchMove =
  | { readonly accepted: false; readonly reason: DispatchRejection }
  | {
      readonly accepted: true;
      readonly state: DispatchState;
      readonly delivery: DispatchDelivery;
      readonly status: DispatchStatus;
    };

export function createDispatchState(): DispatchState {
  return { cursor: 0, spent: 0, warmedCacheKeys: [], deliveries: [] };
}

export function dispatchStatus(activity: DispatchActivity, state: DispatchState): DispatchStatus {
  if (state.spent > activity.budget) return "over-budget";
  return state.cursor === activity.cards.length ? "completed" : "active";
}

/** A missing key means this request requires a fresh result, even if other keys are warm. */
export function isDispatchCacheReady(
  card: DispatchActivity["cards"][number],
  state: DispatchState,
): boolean {
  return Boolean(card.cacheKey && state.warmedCacheKeys.includes(card.cacheKey));
}

/** Rejected routing leaves the same request in place and spends nothing. */
export function routeDispatch(
  activity: DispatchActivity,
  state: DispatchState,
  laneId: string,
): DispatchMove {
  if (dispatchStatus(activity, state) !== "active") {
    return { accepted: false, reason: "round-ended" };
  }
  const card = activity.cards[state.cursor];
  if (!card) return { accepted: false, reason: "round-ended" };
  const lane = activity.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) return { accepted: false, reason: "unknown-lane" };
  if (!Number.isFinite(lane.cost) || lane.cost < 0) {
    return { accepted: false, reason: "invalid-cost" };
  }

  const cacheHit = lane.id === activity.cacheLaneId;
  if (cacheHit && !isDispatchCacheReady(card, state)) {
    return { accepted: false, reason: "cache-unavailable" };
  }
  if (!cacheHit && !card.allowedLaneIds.includes(lane.id)) {
    return { accepted: false, reason: "lane-not-allowed" };
  }

  const warmed = Boolean(card.cacheKey && !state.warmedCacheKeys.includes(card.cacheKey));
  const delivery: DispatchDelivery = {
    cardId: card.id,
    laneId,
    cost: lane.cost,
    ...(card.cacheKey ? { cacheKey: card.cacheKey } : {}),
    cacheHit,
    warmed,
  };
  const next: DispatchState = {
    cursor: state.cursor + 1,
    spent: state.spent + lane.cost,
    warmedCacheKeys:
      warmed && card.cacheKey ? [...state.warmedCacheKeys, card.cacheKey] : state.warmedCacheKeys,
    deliveries: [...state.deliveries, delivery],
  };
  return { accepted: true, state: next, delivery, status: dispatchStatus(activity, next) };
}
