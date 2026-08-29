import { GameButton, GameCallout, GamePanel, GameSegmentedControl } from "@pieai/swimmer-ui-kit";
import {
  createUnavailablePaymentPort,
  walletGradingBalanceText,
  PLANS,
  type EntitlementReadModel,
  type PaymentExplanation,
  type PaymentOrder,
  type PaymentPort,
  type PaymentResult,
  type Plan,
  type PlanPricing,
  type WalletBalance,
} from "@pieai/university-core";
import { useEffect, useState } from "react";

import { CapabilityExplanation } from "../../capability/CapabilityExplanation.js";

/** 会员 — this surface explains the entitlement boundary and launch offer. */
export const PLANS_TITLE = "会员";

const FALLBACK_PAYMENT_PORT = createUnavailablePaymentPort();

const BILLING_CYCLE_OPTIONS = [
  { id: "yearly", label: "按年" },
  { id: "monthly", label: "按月" },
] as const;

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function configuredPrice(pricing: PlanPricing, yearly: boolean): string | null {
  if (pricing.kind !== "configured") return null;
  const cents = yearly ? pricing.yearlyCents : pricing.monthlyCents;
  if (cents === null) return null;
  return formatCurrency(cents, pricing.currency);
}

function configuredYearlyMonthlyPrice(pricing: PlanPricing): string | null {
  if (pricing.kind !== "configured" || pricing.yearlyCents === null) return null;
  return formatCurrency(pricing.yearlyCents / 12, pricing.currency);
}

function priceLabel(pricing: PlanPricing, yearly: boolean) {
  if (pricing.kind === "free") {
    return <span className="plan-card__amount">免费</span>;
  }

  const price = configuredPrice(pricing, yearly);
  if (price === null) {
    return <span className="plan-card__amount">价格暂时无法显示</span>;
  }

  const yearlyMonthlyPrice = yearly ? configuredYearlyMonthlyPrice(pricing) : null;
  return (
    <>
      <span className="plan-card__amount">{price}</span>
      <span className="plan-card__period">{yearly ? " / 年" : " / 月"}</span>
      {yearlyMonthlyPrice ? (
        <span className="plan-card__period">（折合 {yearlyMonthlyPrice} / 月）</span>
      ) : null}
    </>
  );
}

function planButtonLabel(pricing: PlanPricing): string {
  if (pricing.kind === "pending") return "购买入口";
  return "购买";
}

function PlanCard({
  plan,
  yearly,
  busyOfferId,
  onPurchase,
}: {
  readonly plan: Plan;
  readonly yearly: boolean;
  readonly busyOfferId: string | null;
  readonly onPurchase: (offerId: string) => void;
}) {
  const purchasable = plan.pricing.kind !== "free";

  return (
    <li className="plan-card">
      <GamePanel>
        <div className="plan-card__head">
          <h2 className="plan-card__name">{plan.name}</h2>
        </div>

        <p className="plan-card__price">{priceLabel(plan.pricing, yearly)}</p>

        <ul className="plan-card__lines">
          {plan.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {purchasable ? (
          <GameButton
            variant="ghost"
            type="button"
            onClick={() => onPurchase(plan.id)}
            disabled={busyOfferId === plan.id}
          >
            {busyOfferId === plan.id ? "正在检查…" : planButtonLabel(plan.pricing)}
          </GameButton>
        ) : (
          <p className="plan-card__note">你现在就在用</p>
        )}
      </GamePanel>
    </li>
  );
}

function statusLabel(status: PaymentOrder["status"]): string {
  switch (status) {
    case "pending":
      return "等待支付";
    case "paid":
      return "已支付，正在刷新权益";
    case "failed":
      return "支付失败";
    case "cancelled":
      return "已取消";
  }
}

function planNameOf(entitlement: EntitlementReadModel): string {
  return PLANS.find((plan) => plan.id === entitlement.planId)?.name ?? entitlement.planId;
}

function PaymentSummary({
  balance,
  entitlement,
}: {
  readonly balance: PaymentResult<WalletBalance> | null;
  readonly entitlement: PaymentResult<EntitlementReadModel> | null;
}) {
  return (
    <div className="payment-summary" aria-live="polite">
      <p>
        当前方案：
        {entitlement?.kind === "value" ? planNameOf(entitlement.value) : "登录后读取"}
      </p>
      <p>
        {balance?.kind === "value"
          ? walletGradingBalanceText(balance.value.availablePowerUnits)
          : "钱包余额：登录后读取"}
      </p>
    </div>
  );
}

function PaymentOrderNotice({
  order,
  refreshing,
  onRefresh,
}: {
  readonly order: PaymentOrder;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}) {
  return (
    <GameCallout tone={order.status === "paid" ? "success" : "info"} heading="订单状态">
      <p className="payment-order__line">
        {statusLabel(order.status)} · 订单号 {order.orderId}
      </p>
      {order.checkoutUrl ? (
        <p className="payment-order__line">
          <a href={order.checkoutUrl} target="_blank" rel="noreferrer">
            继续付款
          </a>
        </p>
      ) : null}
      {order.status === "pending" ? (
        <GameButton variant="secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "正在查询…" : "刷新订单状态"}
        </GameButton>
      ) : null}
    </GameCallout>
  );
}

export function PlansScreen({ paymentPort }: { readonly paymentPort?: PaymentPort } = {}) {
  const payment = paymentPort ?? FALLBACK_PAYMENT_PORT;
  const [yearly, setYearly] = useState(true);
  const [balance, setBalance] = useState<PaymentResult<WalletBalance> | null>(null);
  const [entitlement, setEntitlement] = useState<PaymentResult<EntitlementReadModel> | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [refreshingOrder, setRefreshingOrder] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [explanation, setExplanation] = useState<PaymentExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasConfiguredCycle = PLANS.some((plan) => plan.pricing.kind === "configured");

  useEffect(() => {
    let active = true;
    void Promise.all([payment.readBalance(), payment.readEntitlements()]).then(
      ([nextBalance, nextEntitlement]) => {
        if (!active) return;
        setBalance(nextBalance);
        setEntitlement(nextEntitlement);
      },
    );
    return () => {
      active = false;
    };
  }, [payment]);

  async function refreshAfterPayment(): Promise<void> {
    const next = await payment.refreshEntitlements();
    if (next.kind === "value") {
      setEntitlement(next);
    } else {
      setExplanation(next);
    }
  }

  async function startPurchase(offerId: string): Promise<void> {
    setBusyOfferId(offerId);
    setError(null);
    try {
      const result = await payment.initiatePurchase({ offerId });
      if (result.kind === "explanation") {
        setExplanation(result);
        return;
      }
      setOrder(result.value);
      if (result.value.status === "paid") await refreshAfterPayment();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "购买请求暂时失败，请稍后再试。");
    } finally {
      setBusyOfferId(null);
    }
  }

  async function refreshOrder(): Promise<void> {
    if (!order) return;
    setRefreshingOrder(true);
    setError(null);
    try {
      const result = await payment.getOrderStatus(order.orderId);
      if (result.kind === "explanation") {
        setExplanation(result);
        return;
      }
      setOrder(result.value);
      if (result.value.status === "paid") await refreshAfterPayment();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "订单状态暂时读不到，请稍后再试。");
    } finally {
      setRefreshingOrder(false);
    }
  }

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{PLANS_TITLE}</h1>
        <p className="shell-screen__lede">
          所有已发布课程都能免费学，课文和关卡永远不收费。会员买的是账号那一半：
          登录同一账号后，换手机或电脑也能接着学，最多三台设备同时在线。 AI
          批改按每次用量计费，跟会员等级无关。不买会员，本地学习也不会被挡住。
        </p>
      </header>

      <PaymentSummary balance={balance} entitlement={entitlement} />

      {hasConfiguredCycle ? (
        <div className="plan-toggle">
          <GameSegmentedControl
            label="计费周期"
            activeId={yearly ? "yearly" : "monthly"}
            options={BILLING_CYCLE_OPTIONS}
            onSelect={(id) => setYearly(id === "yearly")}
          />
        </div>
      ) : null}

      <ul className="plan-grid">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            yearly={yearly}
            busyOfferId={busyOfferId}
            onPurchase={(offerId) => void startPurchase(offerId)}
          />
        ))}
      </ul>

      {order ? (
        <PaymentOrderNotice
          order={order}
          refreshing={refreshingOrder}
          onRefresh={() => void refreshOrder()}
        />
      ) : null}
      {error ? (
        <p className="payment-order__error" role="alert">
          {error}
        </p>
      ) : null}

      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </section>
  );
}
