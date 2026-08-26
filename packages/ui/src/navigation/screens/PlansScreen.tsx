import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  createUnavailablePaymentPort,
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

/**
 * 会员 — this surface explains the entitlement boundary. Price and paid
 * tiers stay in the shared billing configuration until the product decision
 * exists; this offer is only the visible hand-off to that future decision.
 */
export const PLANS_TITLE = "会员";

/** Not a priced plan. It keeps the purchase place visible before pricing exists. */
export const PENDING_PURCHASE_OFFER_ID = "paid-entitlement-pending";

const FALLBACK_PAYMENT_PORT = createUnavailablePaymentPort();

function configuredPrice(pricing: PlanPricing, yearly: boolean): string | null {
  if (pricing.kind !== "configured") return null;
  const cents = yearly ? pricing.yearlyCents : pricing.monthlyCents;
  if (cents === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: pricing.currency,
  }).format(cents / 100);
}

function priceLabel(pricing: PlanPricing, yearly: boolean) {
  if (pricing.kind === "free") {
    return <span className="plan-card__amount">免费</span>;
  }

  const price = configuredPrice(pricing, yearly);
  if (price === null) {
    return <span className="plan-card__amount">待产品确认</span>;
  }

  return (
    <>
      <span className="plan-card__amount">{price}</span>
      <span className="plan-card__period">{yearly ? " / 年" : " / 月"}</span>
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
          <p className="plan-card__note">当前基线</p>
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
        当前权益：
        {entitlement?.kind === "value" ? planNameOf(entitlement.value) : "登录后读取"}
      </p>
      <p>
        钱包余额：
        {balance?.kind === "value" ? `${balance.value.balancePowerUnits} 个额度单位` : "登录后读取"}
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
          课文不设付费墙，所有已发布课程都能学。权益只描述 AI 和同步；价格与具体档位等产品决定。
        </p>
      </header>

      <PaymentSummary balance={balance} entitlement={entitlement} />

      {hasConfiguredCycle ? (
        <div className="plan-toggle" role="group" aria-label="计费周期">
          <GameButton
            variant={yearly ? "primary" : "secondary"}
            type="button"
            onClick={() => setYearly(true)}
            aria-pressed={yearly}
          >
            按年
          </GameButton>
          <GameButton
            variant={yearly ? "secondary" : "primary"}
            type="button"
            onClick={() => setYearly(false)}
            aria-pressed={!yearly}
          >
            按月
          </GameButton>
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
        <li className="plan-card plan-card--pending">
          <GamePanel>
            <div className="plan-card__head">
              <h2 className="plan-card__name">付费权益</h2>
            </div>
            <p className="plan-card__price">
              <span className="plan-card__amount">待产品确认</span>
            </p>
            <p className="plan-card__note">具体权益、价格和可用渠道都还没有定案。</p>
            <ul className="plan-card__lines">
              <li>购买请求只交给服务端处理</li>
              <li>成功后从账号重新读取权益</li>
            </ul>
            <GameButton
              variant="ghost"
              type="button"
              onClick={() => void startPurchase(PENDING_PURCHASE_OFFER_ID)}
              disabled={busyOfferId === PENDING_PURCHASE_OFFER_ID}
            >
              {busyOfferId === PENDING_PURCHASE_OFFER_ID ? "正在检查…" : "查看购买入口"}
            </GameButton>
          </GamePanel>
        </li>
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

      <GameCallout tone="info" heading="当前权益基线">
        现在只配置了免费基线：确定性判题继续可用；登录并且有远端时同步进度；没有远端时继续本机学习。
        付费档位和价格尚未填入，所以这里不会先做购买承诺。
      </GameCallout>

      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </section>
  );
}
