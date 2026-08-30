import { describe, expect, it } from "vitest";

import { aiEntitlementPolicyOf } from "./ai-entitlements.js";

const baseline = {
  deterministicGrading: true,
  structuredGrading: true,
  openTutoring: false,
  openTutoringTurnsPerDay: null,
} as const;

describe("aiEntitlementPolicyOf", () => {
  it("keeps free structured grading as the quota-backed trial but closes tutoring", () => {
    expect(aiEntitlementPolicyOf(baseline)).toEqual({
      structuredGrading: true,
      openTutoring: false,
      openTutoringTurnsPerDay: 0,
    });
  });

  it("keeps member tutoring open when the plan uses wallet metering", () => {
    expect(
      aiEntitlementPolicyOf({
        ...baseline,
        openTutoring: true,
      }),
    ).toEqual({
      structuredGrading: true,
      openTutoring: true,
      openTutoringTurnsPerDay: null,
    });
  });

  it("treats a zero daily tutoring allowance as closed", () => {
    expect(
      aiEntitlementPolicyOf({
        ...baseline,
        openTutoring: true,
        openTutoringTurnsPerDay: 0,
      }),
    ).toMatchObject({ openTutoring: false, openTutoringTurnsPerDay: 0 });
  });
});
