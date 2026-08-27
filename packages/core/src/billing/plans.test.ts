import { describe, expect, it } from "vitest";

import { BILLING_CONFIG, defaultPlanOf, planById, PLANS } from "./plans.js";

describe("billing configuration", () => {
  /*
    The guard that matters is not how many plans exist — it is that nobody
    invents a price. Rights and price are separate decisions: the paid plan's
    rights come from the journey and are configured, while its price is still
    the product's to name, which is what `pending` means. An earlier version of
    this test asserted a plan count instead, which would have been satisfied by
    a plan carrying a made-up number.
  */
  it("configures rights but never a price the product has not named", () => {
    expect(defaultPlanOf()).toBe(planById("free"));
    expect(planById("free")?.pricing).toEqual({ kind: "free" });
    expect(planById("member")?.pricing).toEqual({ kind: "pending" });
    expect(PLANS.some((plan) => plan.pricing.kind === "configured")).toBe(false);
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
