import { describe, expect, it } from "vitest";

import { BILLING_CONFIG, defaultPlanOf, planById, PLANS, type Plan, type PlanId } from "./plans.js";

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

  it("never falls back to a plan someone has to pay for", () => {
    /*
      `defaultPlanOf` resolves `defaultPlanId`, and if that lookup misses it
      takes `plans[0]`. Both of those are position- and string-dependent, and
      neither is checked anywhere else. Reordering this array, or renaming the
      default, would hand every signed-out visitor a paid plan for nothing —
      silently, because a plan object is a plan object and nothing would throw.

      A payment audit on 2026-08-29 found no live path by which a user could
      hold a paid entitlement without paying. This test is what keeps that
      true through the next edit to the array above.
    */
    /*
      Free is a pricing *kind*, not a price of zero. "pending" means the price
      is undecided, which is not the same as free and must never be what a
      user silently lands on either.
    */
    const isFree = (plan: Plan): boolean => plan.pricing.kind === "free";

    expect(isFree(defaultPlanOf())).toBe(true);
    expect(isFree(BILLING_CONFIG.plans[0] as Plan)).toBe(true);

    const brokenDefault = { ...BILLING_CONFIG, defaultPlanId: "no-such-plan" as PlanId };
    expect(isFree(defaultPlanOf(brokenDefault))).toBe(true);
  });
});
