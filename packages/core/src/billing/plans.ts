/**
 * The product's entitlement configuration.
 *
 * Course access is deliberately absent here. A learner may read every
 * published course; this file only describes the AI and sync rights that a
 * future commercial plan may grant.
 *
 * Keep prices as configuration in this module. Until the product decision is
 * made, the only configured plan is the free baseline. A paid plan can be
 * added by filling its rights and `pricing` object here; the reader and the
 * entitlement model do not need a second list.
 */

export type PlanId = string;

export type PlanPricing =
  | { readonly kind: "free" }
  | { readonly kind: "pending" }
  | {
      readonly kind: "configured";
      readonly currency: string;
      readonly monthlyCents: number | null;
      readonly yearlyCents: number | null;
    };

export interface AiEntitlementConfig {
  /** Tier-one answer checking that does not call a model. */
  readonly deterministicGrading: boolean;
  /** Structured, bounded model grading. */
  readonly structuredGrading: boolean;
  /** Open-ended tutoring, which is always metered when enabled. */
  readonly openTutoring: boolean;
  readonly openTutoringTurnsPerDay: number | null;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly pricing: PlanPricing;
  readonly ai: AiEntitlementConfig;
  /** Account sync is a right; actual availability also needs an account and remote. */
  readonly sync: {
    readonly included: boolean;
    readonly seats: number;
  };
  readonly lines: readonly string[];
}

export interface BillingConfig {
  readonly defaultPlanId: PlanId;
  readonly plans: readonly Plan[];
}

export const BILLING_CONFIG = {
  defaultPlanId: "free",
  plans: [
    {
      id: "free",
      name: "免费",
      pricing: { kind: "free" },
      ai: {
        deterministicGrading: true,
        structuredGrading: false,
        openTutoring: false,
        openTutoringTurnsPerDay: null,
      },
      // This preserves the existing account contract: a signed-in learner
      // can sync without waiting for a future price decision.
      sync: { included: true, seats: 1 },
      lines: [
        "全部已发布课程，全部关卡，不锁课",
        "确定性判题",
        "登录且有远端时同步进度；没有远端时继续本机学习",
      ],
    },
  ],
} satisfies BillingConfig;

export const PLANS: readonly Plan[] = BILLING_CONFIG.plans;

export function planById(id: PlanId, config: BillingConfig = BILLING_CONFIG): Plan | undefined {
  return config.plans.find((plan) => plan.id === id);
}

export function defaultPlanOf(config: BillingConfig = BILLING_CONFIG): Plan {
  return planById(config.defaultPlanId, config) ?? config.plans[0] ?? BILLING_CONFIG.plans[0];
}
