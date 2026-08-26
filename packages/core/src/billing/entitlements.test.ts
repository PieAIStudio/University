import { describe, expect, it } from "vitest";

import { createIdentityPort } from "../ports/identity.js";
import { readEntitlements } from "./entitlements.js";
import { BILLING_CONFIG, type BillingConfig } from "./plans.js";

const SIGNED_OUT = { kind: "signed_out" } as const;
const SIGNED_IN = {
  kind: "signed_in",
  user: { id: "learner-1", email: "learner@example.com" },
} as const;

const CONFIG_WITH_PENDING_PLAN: BillingConfig = {
  ...BILLING_CONFIG,
  plans: [
    ...BILLING_CONFIG.plans,
    {
      id: "studio",
      name: "工作室",
      pricing: { kind: "pending" },
      ai: {
        deterministicGrading: true,
        structuredGrading: true,
        openTutoring: true,
        openTutoringTurnsPerDay: 20,
      },
      sync: { included: true, seats: 1 },
      lines: [],
    },
  ],
};

describe("readEntitlements", () => {
  it("falls back to local learning when identity and remote are unconfigured", () => {
    const identity = createIdentityPort(null);
    const model = readEntitlements({ identity: identity.status(), remoteAvailable: false });

    expect(model).toEqual({
      planId: "free",
      source: "baseline",
      ai: {
        deterministicGrading: true,
        structuredGrading: false,
        openTutoring: false,
        openTutoringTurnsPerDay: null,
      },
      sync: {
        entitled: true,
        available: false,
        reason: "not-signed-in",
      },
    });
    expect("course" in model).toBe(false);
  });

  it("does not accept a remote grant without a signed-in remote session", () => {
    const model = readEntitlements(
      {
        identity: SIGNED_OUT,
        remoteAvailable: true,
        grant: { planId: "studio" },
      },
      CONFIG_WITH_PENDING_PLAN,
    );

    expect(model.planId).toBe("free");
    expect(model.source).toBe("baseline");
    expect(model.sync).toEqual({ entitled: true, available: false, reason: "not-signed-in" });
  });

  it("ignores a grant when the remote adapter is unavailable", () => {
    const model = readEntitlements(
      {
        identity: SIGNED_IN,
        remoteAvailable: false,
        grant: { planId: "studio" },
      },
      CONFIG_WITH_PENDING_PLAN,
    );

    expect(model.planId).toBe("free");
    expect(model.source).toBe("baseline");
    expect(model.ai.openTutoring).toBe(false);
    expect(model.sync).toEqual({
      entitled: true,
      available: false,
      reason: "remote-unavailable",
    });
  });

  it("uses a known remote plan for AI and sync rights", () => {
    const model = readEntitlements(
      {
        identity: SIGNED_IN,
        remoteAvailable: true,
        grant: { planId: "studio" },
      },
      CONFIG_WITH_PENDING_PLAN,
    );

    expect(model).toEqual({
      planId: "studio",
      source: "remote",
      ai: {
        deterministicGrading: true,
        structuredGrading: true,
        openTutoring: true,
        openTutoringTurnsPerDay: 20,
      },
      sync: { entitled: true, available: true, reason: "available" },
    });
  });

  it("fails closed to the baseline for an unknown remote plan", () => {
    const model = readEntitlements({
      identity: SIGNED_IN,
      remoteAvailable: true,
      grant: { planId: "deleted-plan" },
    });

    expect(model.planId).toBe("free");
    expect(model.source).toBe("baseline");
    expect(model.ai.openTutoring).toBe(false);
  });
});
