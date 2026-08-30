/**
 * The product's entitlement configuration.
 *
 * Course access is deliberately absent here. A learner may read every
 * published course; this file only describes the AI and sync rights that a
 * plan may grant.
 *
 * Keep prices as configuration in this module. A paid plan is added by filling
 * its rights and `pricing` object here; the reader and the entitlement model do
 * not need a second list.
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
        // A signed-in free learner gets the server-authoritative daily trial;
        // the quota, not this boolean, is what caps the trial.
        structuredGrading: true,
        openTutoring: false,
        openTutoringTurnsPerDay: null,
      },
      sync: { included: false, seats: 0 },
      lines: [
        "全部已发布课程、全部关卡，课文永远不收费",
        "答案对不对，能当场判的当场判",
        "绑定邮箱后每天有少量结构化 AI 批改尝鲜额度，用完今天停止，明天恢复",
      ],
    },
    /*
      The overseas launch hypothesis is $19 monthly or $149 yearly. Keeping
      the number beside the paid rights makes the membership page show the same
      offer that entitlement checks describe; the yearly page can calculate its
      effective monthly comparison from this source.

      `openTutoringTurnsPerDay: null` is not "unlimited". Open tutoring is
      metered against the wallet, so the wallet is the cap; a second turn cap
      here would be a limit nobody had a reason for.
    */
    {
      id: "member",
      name: "会员",
      pricing: {
        kind: "configured",
        currency: "USD",
        monthlyCents: 1900,
        yearlyCents: 14900,
      },
      ai: {
        deterministicGrading: true,
        structuredGrading: true,
        openTutoring: true,
        openTutoringTurnsPerDay: null,
      },
      sync: { included: true, seats: 3 },
      /*
        The structured-grading right this plan is built around is deliberately
        absent from this list. The funding path is implemented and tested here
        — service.ts reads the plan before it reaches quota or wallet — but
        SwimmerBackend exposes no University plan-grant read yet, so production
        cannot recognise a paying member and falls back to the free baseline.

        A plans page is a promise. This project has already shipped one that
        the code could not keep, and removing those lines is what made the rest
        of this page trustworthy. The line goes back the day the backend can
        answer "is this account a member", and not before.
      */
      lines: [
        "换手机也不用从头来：登录同一账号，进度和复习卡接着走",
        "同时登录三台设备，手机、电脑、平板都算一台",
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
