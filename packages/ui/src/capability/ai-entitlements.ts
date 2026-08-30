import {
  aiEntitlementPolicyOf,
  BILLING_CONFIG,
  defaultPlanOf,
  toPath,
  type AiEntitlementConfig,
  type EntitlementReadModel,
  type PaymentExplanation,
  type PaymentResult,
} from "@pieai/university-core";

/** The UI reads this through the shared payment/account assembly. */
export type EntitlementReader = () => Promise<PaymentResult<EntitlementReadModel>>;

/** Tests and an unassembled surface fail closed to the configured free plan. */
export const DEFAULT_AI_ENTITLEMENTS: AiEntitlementConfig = defaultPlanOf(BILLING_CONFIG).ai;

const MEMBERSHIP_ACTION = { label: "查看会员方案", href: toPath({ kind: "plans" }) } as const;

export function openTutoringExplanation(ai: AiEntitlementConfig): PaymentExplanation | null {
  const policy = aiEntitlementPolicyOf(ai);
  if (policy.openTutoring) return null;

  const zeroAllowance = ai.openTutoring && policy.openTutoringTurnsPerDay === 0;
  return {
    kind: "explanation",
    title: zeroAllowance ? "今天的开放式辅导次数已用完" : "开放式辅导属于会员权益",
    whatItDoes: "它会把这张复习卡交给 AI，用自己的话再讲一遍，直到你真的弄明白。",
    whyUnavailable: zeroAllowance
      ? "当前账号的开放式辅导每日次数是 0，所以这个请求不会发给 AI。"
      : "免费方案不包含开放式辅导；课文、关卡和今天的免费结构化批改尝试仍然可用。",
    futureSupport: zeroAllowance
      ? "每日次数恢复或方案更新后，这里会重新检查，不需要把卡片重新做一遍。"
      : "开通会员后，这个按钮会按账号当前方案开放；没有会员也不会影响复习卡本身。",
    action: MEMBERSHIP_ACTION,
  };
}

export function openTutoringReadFailureExplanation(result: PaymentExplanation): PaymentExplanation {
  return {
    ...result,
    title: "开放式辅导权益暂时读不到",
    whyUnavailable: `${result.whyUnavailable} 因此页面不会猜测你是否有会员，也不会把请求发给 AI。`,
    futureSupport: "权益服务恢复后，重新点击这个按钮就会按账号方案判断。",
    action: MEMBERSHIP_ACTION,
  };
}
