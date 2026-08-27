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
        "全部已发布课程、全部关卡，课文永远不收费",
        "答案对不对，能当场判的当场判",
        "登录后进度存进账号；没登录也能一直学下去",
      ],
    },
    /*
      The paid plan's rights are already decided by the journey; only its price
      is not. `pricing: "pending"` is what that state looks like, and the page
      renders the rights with 「待产品确认」 where the number will go — which is
      more honest than an empty page and lets a learner see what they would be
      buying before anyone has to name a number.

      `openTutoringTurnsPerDay: null` is not "unlimited". Open tutoring is
      metered against the wallet, so the wallet is the cap; a second turn cap
      here would be a limit nobody had a reason for.
    */
    {
      id: "member",
      name: "会员",
      pricing: { kind: "pending" },
      ai: {
        deterministicGrading: true,
        structuredGrading: true,
        openTutoring: true,
        openTutoringTurnsPerDay: null,
      },
      sync: { included: true, seats: 3 },
      lines: [
        "AI 读得懂你用中文写的答案，告诉你哪一步想岔了",
        "卡住时可以一直追问，直到这件事真的弄明白",
        "换手机、换电脑接着学，进度和复习计划都跟着走",
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
