import { describe, expect, it } from "vitest";

import {
  createDispatchState,
  dispatchStatus,
  isDispatchCacheReady,
  routeDispatch,
  type DispatchState,
} from "./dispatch.js";
import type { DispatchActivity } from "./types.js";

const activity: DispatchActivity = {
  id: "website",
  kind: "dispatch",
  title: "Website requests",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "Specification", url: "https://example.com/specification" },
  lanes: [
    { id: "cache", label: "Cache", note: "", cost: 0 },
    { id: "static", label: "Static", note: "", cost: 1 },
    { id: "live", label: "Live", note: "", cost: 3 },
  ],
  cacheLaneId: "cache",
  budget: 8,
  seconds: 60,
  cards: [
    {
      id: "hero-1",
      label: "Hero",
      detail: "",
      allowedLaneIds: ["static", "live"],
      cacheKey: "hero",
      why: "",
    },
    { id: "price", label: "Fresh price", detail: "", allowedLaneIds: ["live"], why: "" },
    {
      id: "css-1",
      label: "CSS",
      detail: "",
      allowedLaneIds: ["static", "live"],
      cacheKey: "css",
      why: "",
    },
    {
      id: "hero-2",
      label: "Hero again",
      detail: "",
      allowedLaneIds: ["static", "live"],
      cacheKey: "hero",
      why: "",
    },
    { id: "stock", label: "Fresh stock", detail: "", allowedLaneIds: ["live"], why: "" },
    {
      id: "css-2",
      label: "CSS again",
      detail: "",
      allowedLaneIds: ["static", "live"],
      cacheKey: "css",
      why: "",
    },
    {
      id: "hero-3",
      label: "Hero again",
      detail: "",
      allowedLaneIds: ["static", "live"],
      cacheKey: "hero",
      why: "",
    },
  ],
};

function move(state: DispatchState, lane: string, spec = activity): DispatchState {
  const result = routeDispatch(spec, state, lane);
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("request dispatch", () => {
  it("starts cold and cannot manufacture a cache hit", () => {
    const state = createDispatchState();
    expect(routeDispatch(activity, state, "cache")).toEqual({
      accepted: false,
      reason: "cache-unavailable",
    });
    expect(state).toEqual({ cursor: 0, spent: 0, warmedCacheKeys: [], deliveries: [] });
  });

  it("warms only the exact key after a legitimate delivery, without mutating history", () => {
    const before = createDispatchState();
    const after = move(before, "static");
    expect(after.warmedCacheKeys).toEqual(["hero"]);
    expect(after.deliveries[0]).toMatchObject({ cardId: "hero-1", cacheHit: false, warmed: true });
    expect(isDispatchCacheReady(activity.cards[2]!, after)).toBe(false);
    expect(isDispatchCacheReady(activity.cards[3]!, after)).toBe(true);
    expect(before.cursor).toBe(0);
    expect(before.deliveries).toEqual([]);
  });

  it("keeps a wrongly routed request in place and never caches a realtime request", () => {
    const state = move(createDispatchState(), "static");
    expect(routeDispatch(activity, state, "static")).toEqual({
      accepted: false,
      reason: "lane-not-allowed",
    });
    expect(routeDispatch(activity, state, "cache")).toEqual({
      accepted: false,
      reason: "cache-unavailable",
    });
    expect(state.cursor).toBe(1);
    expect(state.spent).toBe(1);
    const next = move(state, "live");
    expect(next.warmedCacheKeys).toEqual(["hero"]);
  });

  it("accepts an expensive but legitimate choice", () => {
    const state = move(createDispatchState(), "live");
    expect(state.spent).toBe(3);
    expect(state.cursor).toBe(1);
    expect(state.warmedCacheKeys).toEqual(["hero"]);
  });

  it("completes only after all requests are served within budget", () => {
    let state = createDispatchState();
    for (const lane of ["static", "live", "static", "cache", "live", "cache"]) {
      state = move(state, lane);
      expect(dispatchStatus(activity, state)).toBe("active");
    }
    state = move(state, "cache");
    expect(dispatchStatus(activity, state)).toBe("completed");
    expect(state.spent).toBe(8);
    expect(state.deliveries.filter((delivery) => delivery.cacheHit)).toHaveLength(3);
    expect(routeDispatch(activity, state, "cache")).toEqual({
      accepted: false,
      reason: "round-ended",
    });
  });

  it("allows cached results even when that lane was not a permitted producer", () => {
    let state = createDispatchState();
    for (const lane of ["static", "live", "static"]) state = move(state, lane);
    expect(activity.cards[state.cursor]!.allowedLaneIds).not.toContain("cache");
    state = move(state, "cache");
    expect(state.deliveries.at(-1)).toMatchObject({ cacheHit: true, warmed: false, cost: 0 });
    expect(state.warmedCacheKeys).toEqual(["hero", "css"]);
  });

  it("ends an over-budget round without treating served requests as a win", () => {
    let state = createDispatchState();
    for (const lane of ["live", "live", "static", "cache", "live"]) state = move(state, lane);
    expect(dispatchStatus(activity, state)).toBe("over-budget");
    expect(state.spent).toBe(10);
    expect(state.cursor).toBe(5);
    expect(routeDispatch(activity, state, "cache")).toEqual({
      accepted: false,
      reason: "round-ended",
    });
    expect(dispatchStatus({ ...activity, cards: activity.cards.slice(0, 5) }, state)).toBe(
      "over-budget",
    );
  });

  it("rejects unknown lanes and invalid costs without delivering a card", () => {
    expect(routeDispatch(activity, createDispatchState(), "missing")).toEqual({
      accepted: false,
      reason: "unknown-lane",
    });
    const broken = { ...activity, lanes: [{ id: "static", label: "", note: "", cost: -1 }] };
    expect(routeDispatch(broken, createDispatchState(), "static")).toEqual({
      accepted: false,
      reason: "invalid-cost",
    });
  });
});
