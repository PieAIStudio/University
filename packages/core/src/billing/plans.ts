/**
 * The product's entitlement configuration.
 *
 * Course access is deliberately absent here. A learner may read every
 * published course; this file only describes the AI and sync rights that a
 * future commercial plan may grant.
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

/*
  None of these three flags is read by any code today. That is not an oversight
  to be fixed by wiring them up: grading funding is already decided somewhere
  else, and decided differently.

  `apps/university-grading/src/service.ts` quotes each metered grading against a
  daily free quota first and the learner's wallet second. It never asks which
  plan the learner holds. So a plan cannot grant or withhold AI grading, and a
  plan line that says it does is selling something this file does not control.

  They are kept, rather than deleted, because the metered path is unfinished:
  the free-quota RPC fails closed until its backend lands, and the wallet has a
  balance read but no way to add money. When that path is finished, the honest
  move is to delete these flags, not to teach the grading service to read them.
*/
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
        "AI 批改按次计量，不看会员等级；计量入口还没开放，开放前谁都用不到",
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
        These lines used to promise AI grading and AI comments. They were
        removed because no code grants either right by plan, so the page was
        describing a difference that does not exist. What membership actually
        changes today is the seat count, and that is what it now says.

        The AI lines come back when metered grading is finished and membership
        buys something inside it - a larger free quota, or included wallet
        credit. Until then a line here has to be a right this file controls.
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
