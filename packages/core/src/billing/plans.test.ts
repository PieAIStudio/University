import { describe, expect, it } from "vitest";

import { BILLING_CONFIG, defaultPlanOf, planById, PLANS } from "./plans.js";

describe("billing configuration", () => {
  it("keeps one explicit free baseline until pricing is decided", () => {
    expect(PLANS).toHaveLength(1);
    expect(defaultPlanOf()).toBe(planById("free"));
    expect(planById("free")?.pricing).toEqual({ kind: "free" });
    expect(PLANS.some((plan) => plan.pricing.kind === "configured")).toBe(false);
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
    expect(free?.lines).toContain("全部已发布课程，全部关卡，不锁课");
  });

  it("keeps the config as the only plan collection", () => {
    expect(PLANS).toBe(BILLING_CONFIG.plans);
  });
});
