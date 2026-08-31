import { translate } from "../../i18n/index.js";
import { GameButton, GameCallout, GamePanel, GameSegmentedControl } from "@pieai/swimmer-ui-kit";
import {
  createUnavailablePaymentPort,
  walletGradingBalanceText,
  PLANS,
  type EntitlementReadModel,
  type PaymentExplanation,
  type PaymentAvailability,
  type PaymentOrder,
  type PaymentPort,
  type PaymentResult,
  type Plan,
  type PlanPricing,
  type WalletBalance,
} from "@pieai/university-core";
import { useEffect, useState } from "react";

import { CapabilityExplanation } from "../../capability/CapabilityExplanation.js";
import { LiquidCtaButton } from "../../cta/LiquidCtaButton.js";

/** 会员 — this surface explains the entitlement boundary and launch offer. */
export const PLANS_TITLE = translate("ui.navigation.screens.plansScreen.copy.会员");

/*
  One string rather than prose broken across source lines: JSX collapses those
  line breaks into spaces, and a space after a full-width comma reads as a typo
  on the one page where a typo costs money.
*/
const PLANS_LEDE = translate(
  "ui.navigation.screens.plansScreen.copy.所有已发布课程都能免费学-课文和关卡永远不收费-绑定邮箱后-每天有少量-AI-批改尝鲜额度-用完今天停止-明天恢",
);

const FALLBACK_PAYMENT_PORT = createUnavailablePaymentPort();

const BILLING_CYCLE_OPTIONS = [
  { id: "yearly", label: translate("ui.navigation.screens.plansScreen.copy.按年") },
  { id: "monthly", label: translate("ui.navigation.screens.plansScreen.copy.按月") },
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

/**
 * What the yearly offer saves against twelve monthly charges.
 *
 * Derived from the same pricing object the price itself comes from, so the two
 * numbers can never disagree; a hard-coded percentage would keep claiming its
 * discount after someone changed a price.
 */
function configuredYearlySaving(
  pricing: PlanPricing,
): { readonly amount: string; readonly percent: number } | null {
  if (pricing.kind !== "configured") return null;
  const { monthlyCents, yearlyCents } = pricing;
  if (monthlyCents === null || yearlyCents === null) return null;
  const twelveMonths = monthlyCents * 12;
  if (yearlyCents >= twelveMonths) return null;
  return {
    amount: formatCurrency(twelveMonths - yearlyCents, pricing.currency),
    percent: Math.round(((twelveMonths - yearlyCents) / twelveMonths) * 100),
  };
}

/**
 * The price line, or nothing when the name already said it.
 *
 * The free plan is called 「免费」 and its price was also 「免费」, printed at
 * the size of a headline. Two identical words stacked, and the loudest number
 * on a pricing page belonging to the tier nobody has to be persuaded into.
 * The free card does not need selling; the paid one does.
 */
function priceLabel(pricing: PlanPricing, yearly: boolean) {
  if (pricing.kind === "free") return null;

  const price = configuredPrice(pricing, yearly);
  if (price === null) {
    return (
      <span className="plan-card__amount">
        {translate("ui.navigation.screens.plansScreen.copy.价格暂时无法显示")}
      </span>
    );
  }

  const yearlyMonthlyPrice = yearly ? configuredYearlyMonthlyPrice(pricing) : null;
  return (
    <>
      <span className="plan-card__amount">{price}</span>
      <span className="plan-card__period">
        {yearly
          ? translate("ui.navigation.screens.plansScreen.copy.年")
          : translate("ui.navigation.screens.plansScreen.copy.月")}
      </span>
      {yearlyMonthlyPrice ? (
        <span className="plan-card__period">
          {translate("ui.navigation.screens.plansScreen.copy.折合")} {yearlyMonthlyPrice}{" "}
          {translate("ui.navigation.screens.plansScreen.copy.月-1bqki4t")}
        </span>
      ) : null}
    </>
  );
}

function planButtonLabel(pricing: PlanPricing, availability: PaymentAvailability): string {
  if (pricing.kind === "pending")
    return translate("ui.navigation.screens.plansScreen.copy.了解购买状态");
  if (availability === "anonymous")
    return translate("ui.navigation.screens.plansScreen.copy.先绑定邮箱");
  if (availability === "account-required")
    return translate("ui.navigation.screens.plansScreen.copy.先登录");
  if (availability === "unavailable")
    return translate("ui.navigation.screens.plansScreen.copy.记录购买意向");
  return translate("ui.navigation.screens.plansScreen.copy.购买");
}

function PlanCard({
  plan,
  yearly,
  busyOfferId,
  purchaseAvailability,
  onPurchase,
}: {
  readonly plan: Plan;
  readonly yearly: boolean;
  readonly busyOfferId: string | null;
  readonly purchaseAvailability: PaymentAvailability;
  readonly onPurchase: (offerId: string) => void;
}) {
  const purchasable = plan.pricing.kind !== "free";
  const saving = yearly ? configuredYearlySaving(plan.pricing) : null;

  return (
    <li className={purchasable ? "plan-card plan-card--featured" : "plan-card"}>
      <GamePanel>
        <div className="plan-card__head">
          <h2 className="plan-card__name">{plan.name}</h2>
        </div>

        {(() => {
          const price = priceLabel(plan.pricing, yearly);
          return price ? <p className="plan-card__price">{price}</p> : null;
        })()}

        {saving ? (
          <p className="plan-card__saving">
            {translate("ui.navigation.screens.plansScreen.copy.比按月付省")} {saving.amount}
            {translate("ui.navigation.screens.plansScreen.copy.也就是")} {saving.percent}%
          </p>
        ) : null}

        <ul className="plan-card__lines">
          {plan.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {purchasable ? (
          <LiquidCtaButton
            type="button"
            onClick={() => onPurchase(plan.id)}
            disabled={busyOfferId === plan.id}
          >
            {busyOfferId === plan.id
              ? translate("ui.navigation.screens.plansScreen.copy.正在检查")
              : planButtonLabel(plan.pricing, purchaseAvailability)}
          </LiquidCtaButton>
        ) : (
          <p className="plan-card__note">
            {translate("ui.navigation.screens.plansScreen.copy.你现在就在用")}
          </p>
        )}
      </GamePanel>
    </li>
  );
}

function statusLabel(status: PaymentOrder["status"]): string {
  switch (status) {
    case "pending":
      return translate("ui.navigation.screens.plansScreen.copy.等待支付");
    case "paid":
      return translate("ui.navigation.screens.plansScreen.copy.已支付-正在刷新权益");
    case "failed":
      return translate("ui.navigation.screens.plansScreen.copy.支付失败");
    case "cancelled":
      return translate("ui.navigation.screens.plansScreen.copy.已取消");
  }
}

function planNameOf(entitlement: EntitlementReadModel): string {
  return PLANS.find((plan) => plan.id === entitlement.planId)?.name ?? entitlement.planId;
}

/** Only print a number the port actually returned. A missing wallet is absent, not "登录后读取". */
function PaymentSummary({
  balance,
  entitlement,
}: {
  readonly balance: PaymentResult<WalletBalance> | null;
  readonly entitlement: PaymentResult<EntitlementReadModel> | null;
}) {
  const plan =
    entitlement?.kind === "value" ? (
      <p>
        {translate("ui.navigation.screens.plansScreen.copy.当前方案")}
        {planNameOf(entitlement.value)}
      </p>
    ) : null;
  const wallet =
    balance?.kind === "value" ? (
      <p>{walletGradingBalanceText(balance.value.availablePowerUnits)}</p>
    ) : null;
  if (!plan && !wallet) return null;
  return (
    <div className="payment-summary" aria-live="polite">
      {plan}
      {wallet}
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
    <GameCallout
      tone={order.status === "paid" ? "success" : "info"}
      heading={translate("ui.navigation.screens.plansScreen.copy.订单状态")}
    >
      <p className="payment-order__line">
        {statusLabel(order.status)} {translate("ui.navigation.screens.plansScreen.copy.订单号")}{" "}
        {order.orderId}
      </p>
      {order.checkoutUrl ? (
        <p className="payment-order__line">
          <a href={order.checkoutUrl} target="_blank" rel="noreferrer">
            {translate("ui.navigation.screens.plansScreen.copy.继续付款")}
          </a>
        </p>
      ) : null}
      {order.status === "pending" ? (
        <GameButton variant="secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing
            ? translate("ui.navigation.screens.plansScreen.copy.正在查询")
            : translate("ui.navigation.screens.plansScreen.copy.刷新订单状态")}
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
  const purchaseAvailability = payment.purchaseAvailability();

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
      setError(
        reason instanceof Error
          ? reason.message
          : translate("ui.navigation.screens.plansScreen.copy.购买请求暂时失败-请稍后再试"),
      );
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
      setError(
        reason instanceof Error
          ? reason.message
          : translate("ui.navigation.screens.plansScreen.copy.订单状态暂时读不到-请稍后再试"),
      );
    } finally {
      setRefreshingOrder(false);
    }
  }

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{PLANS_TITLE}</h1>
        <p className="shell-screen__lede">{PLANS_LEDE}</p>
      </header>

      <PaymentSummary balance={balance} entitlement={entitlement} />

      {hasConfiguredCycle ? (
        <div className="plan-toggle">
          <GameSegmentedControl
            label={translate("ui.navigation.screens.plansScreen.copy.计费周期")}
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
            purchaseAvailability={purchaseAvailability}
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
