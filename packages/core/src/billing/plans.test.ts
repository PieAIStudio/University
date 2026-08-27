import { describe, expect, it } from "vitest";

import { BILLING_CONFIG, defaultPlanOf, planById, PLANS } from "./plans.js";

describe("billing configuration", () => {
  /*
    The overseas launch has a named price now. Keep the paid plan's currency
    and both billing cycles pinned here so a future edit cannot silently turn
    the membership page back into an unpriced offer. The free baseline remains
    free and is intentionally not part of the paid pricing table.
  */
  it("keeps the launch prices configured and the free baseline free", () => {
    expect(defaultPlanOf()).toBe(planById("free"));
    expect(planById("free")?.pricing).toEqual({ kind: "free" });
    expect(planById("member")?.pricing).toEqual({
      kind: "configured",
      currency: "USD",
      monthlyCents: 1900,
      yearlyCents: 14900,
    });
    expect(PLANS.some((plan) => plan.pricing.kind === "configured")).toBe(true);
  });

  it("sells the paid plan on what the free one cannot do", () => {
    const free = planById("free");
    const member = planById("member");
    expect(free?.ai.structuredGrading).toBe(false);
    expect(member?.ai.structuredGrading).toBe(true);
    expect(member?.ai.openTutoring).toBe(true);
    expect(member!.sync.seats).toBeGreaterThan(free!.sync.seats);
  });

  it("makes the free baseline's scope explicit", () => {
    const free = planById("free");
    expect(free?.ai).toEqual({
      deterministicGrading: true,
      structuredGrading: false,
      openTutoring: false,
      openTutoringTurnsPerDay: null,
    });
    expect(free?.sync).toEqual({ included: true, seats: 1 });
    expect(free?.lines).toContain("全部已发布课程、全部关卡，课文永远不收费");
  });

  it("keeps the config as the only plan collection", () => {
    expect(PLANS).toBe(BILLING_CONFIG.plans);
  });
});
