import { interfaceTranslator, useI18n } from "../../i18n/index.js";
import {
  GameAssetIcon,
  GameButton,
  GameCallout,
  GamePanel,
  GameSegmentedControl,
} from "@pieai/swimmer-ui-kit";
import {
  createUnavailablePaymentPort,
  walletGradingBalanceText,
  PLANS,
  planCopyForLocale,
  toPath,
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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CapabilityExplanation } from "../../capability/CapabilityExplanation.js";

/** 会员 — this surface explains the entitlement boundary and launch offer. */
export const PLANS_TITLE = interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.会员");

const FALLBACK_PAYMENT_PORT = createUnavailablePaymentPort(() => interfaceTranslator.locale);
const NO_SUBSCRIPTION = () => () => undefined;
const UNSCOPED_ACCOUNT = () => "unconfigured";
const CYCLE_KEY = "university.purchase-cycle.v1";
function readYearlyChoice(): boolean {
  try {
    return globalThis.localStorage.getItem(CYCLE_KEY) !== "monthly";
  } catch {
    return true;
  }
}

const BILLING_CYCLE_OPTIONS = [
  { id: "yearly", label: interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.按年") },
  { id: "monthly", label: interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.按月") },
] as const;

function formatCurrency(cents: number, currency: string): string {
  return interfaceTranslator.currency(cents / 100, currency);
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
        {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.价格暂时无法显示")}
      </span>
    );
  }

  const yearlyMonthlyPrice = yearly ? configuredYearlyMonthlyPrice(pricing) : null;
  return (
    <>
      <span className="plan-card__amount">{price}</span>
      <span className="plan-card__period">
        {yearly
          ? interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.年")
          : interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.月")}
      </span>
      {yearlyMonthlyPrice ? (
        <span className="plan-card__period">
          {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.折合")}{" "}
          {yearlyMonthlyPrice}{" "}
          {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.月-1bqki4t")}
        </span>
      ) : null}
    </>
  );
}

function planButtonLabel(pricing: PlanPricing, availability: PaymentAvailability): string {
  if (pricing.kind === "pending")
    return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.了解购买状态");
  if (availability === "anonymous")
    return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.先绑定邮箱");
  if (availability === "account-required")
    return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.先登录");
  return interfaceTranslator.t("product.billing.upgrade");
}

function PlanCard({
  plan,
  yearly,
  busyOfferId,
  purchaseAvailability,
  canManageSubscription,
  currentPlanId,
  onPurchase,
}: {
  readonly plan: Plan;
  readonly yearly: boolean;
  readonly busyOfferId: string | null;
  readonly purchaseAvailability: PaymentAvailability;
  readonly canManageSubscription: boolean;
  readonly currentPlanId: string | null;
  readonly onPurchase: (offerId: string) => void;
}) {
  const interfaceTranslator = useI18n();
  const purchasable = plan.pricing.kind !== "free";
  const saving = yearly ? configuredYearlySaving(plan.pricing) : null;
  const current = plan.id === currentPlanId;
  const copy = planCopyForLocale(plan, interfaceTranslator.locale);

  return (
    <li className={purchasable ? "plan-card plan-card--featured" : "plan-card"}>
      <GamePanel>
        <div className="plan-card__head">
          {purchasable ? <GameAssetIcon icon="crown" size="md" /> : null}
          <h2 className="plan-card__name">{copy.name}</h2>
        </div>

        {(() => {
          const price = priceLabel(plan.pricing, yearly);
          return price ? <p className="plan-card__price">{price}</p> : null;
        })()}

        {saving ? (
          <p className="plan-card__saving">
            {interfaceTranslator.t("product.billing.saving", { percent: saving.percent })}
          </p>
        ) : null}

        <ul className="plan-card__lines">
          {copy.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {purchasable ? (
          <p className="plan-card__terms">
            {yearly
              ? interfaceTranslator.t("product.billing.yearlyShort")
              : interfaceTranslator.t("product.billing.monthlyShort")}
            <br />
            {interfaceTranslator.t("product.billing.walletShort")}
          </p>
        ) : null}

        {purchasable && current ? (
          <p className="plan-card__note" data-current-membership>
            {interfaceTranslator.t("product.billing.currentMember")}
          </p>
        ) : purchasable ? (
          <>
            {/* Both the order channel and the actual management entry must exist.
                Opening a portal never means cancellation or refund succeeded. */}
            {purchaseAvailability === "available" && canManageSubscription ? (
              <p className="plan-card__cancellation" data-plan-cancellation="true">
                {interfaceTranslator.t(
                  "ui.navigation.screens.plansScreen.copy.随时可以取消-取消之后不再扣费",
                )}
              </p>
            ) : null}
            <GameButton
              variant="primary"
              surface="liquid"
              liquidFinish="glossy"
              className="university-cta"
              fullWidth
              type="button"
              onClick={() => onPurchase(plan.id)}
              disabled={busyOfferId === plan.id}
            >
              {busyOfferId === plan.id
                ? interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.正在检查")
                : planButtonLabel(plan.pricing, purchaseAvailability)}
            </GameButton>
          </>
        ) : (
          <p className="plan-card__note">
            {currentPlanId === "member"
              ? interfaceTranslator.t("product.billing.freeIncluded")
              : interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.你现在就在用")}
          </p>
        )}
      </GamePanel>
    </li>
  );
}

function statusLabel(status: PaymentOrder["status"]): string {
  switch (status) {
    case "pending":
      return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.等待支付");
    case "paid":
      return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.已支付-正在刷新权益");
    case "failed":
      return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.支付失败");
    case "cancelled":
      return interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.已取消");
  }
}

function planNameOf(entitlement: EntitlementReadModel): string {
  const plan = PLANS.find((candidate) => candidate.id === entitlement.planId);
  return plan ? planCopyForLocale(plan, interfaceTranslator.locale).name : entitlement.planId;
}

/** Only print a number the port actually returned. A missing wallet is absent, not "登录后读取". */
function PaymentSummary({
  balance,
  entitlement,
}: {
  readonly balance: PaymentResult<WalletBalance> | null;
  readonly entitlement: PaymentResult<EntitlementReadModel> | null;
}) {
  const interfaceTranslator = useI18n();
  const plan =
    entitlement?.kind === "value" ? (
      <p>
        {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.当前方案")}
        {planNameOf(entitlement.value)}
      </p>
    ) : null;
  const wallet =
    balance?.kind === "value" ? (
      <p>
        {walletGradingBalanceText(balance.value.availablePowerUnits, interfaceTranslator.locale)}
      </p>
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
  const interfaceTranslator = useI18n();
  return (
    <GameCallout
      tone={order.status === "paid" ? "success" : "info"}
      heading={interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.订单状态")}
    >
      <p className="payment-order__line">
        {statusLabel(order.status)}{" "}
        {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.订单号")} {order.orderId}
      </p>
      {order.quote ? (
        <div className="payment-order__quote">
          <p>
            {interfaceTranslator.t("product.billing.quote")} ·{" "}
            {order.quote.billingCycle === "yearly"
              ? interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.按年")
              : interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.按月")}
          </p>
          <p>
            {interfaceTranslator.t("product.billing.subtotal")}：
            {formatCurrency(order.quote.subtotalCents, order.quote.currency)}
          </p>
          <p>
            {interfaceTranslator.t("product.billing.tax")}：
            {formatCurrency(order.quote.taxCents, order.quote.currency)}
          </p>
          <p>
            {interfaceTranslator.t("product.billing.total")}：
            {formatCurrency(order.quote.totalCents, order.quote.currency)}
          </p>
        </div>
      ) : null}
      {order.checkoutUrl && order.status === "pending" ? (
        <p className="payment-order__line">
          <a href={order.checkoutUrl} target="_blank" rel="noreferrer">
            {interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.继续付款")}
          </a>
        </p>
      ) : null}
      {order.status === "pending" || order.status === "paid" ? (
        <GameButton variant="secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing
            ? interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.正在查询")
            : interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.刷新订单状态")}
        </GameButton>
      ) : null}
    </GameCallout>
  );
}

export function PlansScreen({ paymentPort }: { readonly paymentPort?: PaymentPort } = {}) {
  const payment = paymentPort ?? FALLBACK_PAYMENT_PORT;
  const accountKey = useSyncExternalStore(
    payment.subscribe ?? NO_SUBSCRIPTION,
    payment.accountKey ?? UNSCOPED_ACCOUNT,
    payment.accountKey ?? UNSCOPED_ACCOUNT,
  );
  return <PlansSession key={accountKey} payment={payment} />;
}

function PlansSession({ payment }: { readonly payment: PaymentPort }) {
  const interfaceTranslator = useI18n();
  const [yearly, setYearly] = useState(readYearlyChoice);
  const [recovering, setRecovering] = useState(
    Boolean(payment.resumePurchase && payment.accountKey?.().startsWith("signed_in:")),
  );
  const [balance, setBalance] = useState<PaymentResult<WalletBalance> | null>(null);
  const [entitlement, setEntitlement] = useState<PaymentResult<EntitlementReadModel> | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [refreshingOrder, setRefreshingOrder] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [explanation, setExplanation] = useState<PaymentExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const purchaseBusy = useRef(false);
  const managementBusy = useRef(false);
  const [managing, setManaging] = useState(false);
  const hasConfiguredCycle = PLANS.some((plan) => plan.pricing.kind === "configured");
  const purchaseAvailability = payment.purchaseAvailability();
  const canManageSubscription = Boolean(
    payment.manageSubscription && payment.managementAvailability?.() === "available",
  );

  useEffect(() => {
    let active = true;
    void (payment.resumePurchase?.() ?? Promise.resolve(null))
      .then((result) => {
        if (!active || !result) return;
        if (result.kind === "explanation") setExplanation(result);
        else {
          setOrder(result.value);
          if (result.value.quote) setYearly(result.value.quote.billingCycle === "yearly");
        }
      })
      .catch(() => {
        if (active) setError(interfaceTranslator.t("product.billing.readFailed"));
      })
      .finally(() => {
        if (active) setRecovering(false);
      });
    void Promise.all([payment.readBalance(), payment.readEntitlements()]).then(
      ([nextBalance, nextEntitlement]) => {
        if (!active) return;
        setBalance(nextBalance);
        setEntitlement(nextEntitlement);
      },
      () => {
        if (active) setError(interfaceTranslator.t("product.billing.readFailed"));
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
    if (purchaseBusy.current || recovering) return;
    if (order?.status === "pending") {
      setError(interfaceTranslator.t("product.billing.pending"));
      return;
    }
    purchaseBusy.current = true;
    setBusyOfferId(offerId);
    setError(null);
    try {
      const result = await payment.initiatePurchase({
        offerId,
        billingCycle: yearly ? "yearly" : "monthly",
      });
      if (result.kind === "explanation") {
        if (payment.purchaseAvailability() === "unavailable") {
          setError(interfaceTranslator.t("product.billing.purchaseFailed"));
          return;
        }
        setExplanation(result);
        return;
      }
      setOrder(result.value);
      if (result.value.status === "paid") await refreshAfterPayment();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : interfaceTranslator.t(
              "ui.navigation.screens.plansScreen.copy.购买请求暂时失败-请稍后再试",
            ),
      );
    } finally {
      purchaseBusy.current = false;
      setBusyOfferId(null);
    }
  }

  async function manageSubscription() {
    if (!payment.manageSubscription || !canManageSubscription || managementBusy.current) return;
    managementBusy.current = true;
    setManaging(true);
    setPortalUrl(null);
    try {
      const result = await payment.manageSubscription();
      if (result.kind === "explanation") setExplanation(result);
      else setPortalUrl(result.value.url);
    } catch {
      setError(interfaceTranslator.t("product.billing.readFailed"));
    } finally {
      managementBusy.current = false;
      setManaging(false);
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
          : interfaceTranslator.t(
              "ui.navigation.screens.plansScreen.copy.订单状态暂时读不到-请稍后再试",
            ),
      );
    } finally {
      setRefreshingOrder(false);
    }
  }

  return (
    <section className="shell-screen plans-screen" data-payment-availability={purchaseAvailability}>
      <header className="shell-screen__head">
        <h1>{interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.会员")}</h1>
        <p className="shell-screen__lede">{interfaceTranslator.t("product.value.whyAi")}</p>
      </header>

      {hasConfiguredCycle ? (
        <div className="plan-toggle">
          <GameSegmentedControl
            label={interfaceTranslator.t("ui.navigation.screens.plansScreen.copy.计费周期")}
            activeId={yearly ? "yearly" : "monthly"}
            options={BILLING_CYCLE_OPTIONS}
            onSelect={(id) => {
              if (purchaseBusy.current || recovering || order?.status === "pending") return;
              setYearly(id === "yearly");
              try {
                globalThis.localStorage.setItem(CYCLE_KEY, id);
              } catch {
                /* Selection still works for this page. */
              }
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="payment-order__error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="plan-grid">
        {[
          ...PLANS.filter((plan) => plan.pricing.kind !== "free"),
          ...PLANS.filter((plan) => plan.pricing.kind === "free"),
        ].map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            yearly={yearly}
            busyOfferId={recovering ? plan.id : busyOfferId}
            purchaseAvailability={purchaseAvailability}
            canManageSubscription={canManageSubscription}
            currentPlanId={entitlement?.kind === "value" ? entitlement.value.planId : null}
            onPurchase={(offerId) => void startPurchase(offerId)}
          />
        ))}
      </ul>
      <details className="product-details" data-billing-details>
        <summary>{interfaceTranslator.t("product.billing.details")}</summary>
        <p>{interfaceTranslator.t("product.billing.yearlyTotal")}</p>
        <p>{interfaceTranslator.t("product.billing.walletSeparate")}</p>
        <p>{interfaceTranslator.t("product.billing.renewalDetails")}</p>
      </details>
      <nav className="learner-destinations" aria-label={interfaceTranslator.t("support.documents")}>
        <a
          data-billing-help
          href={`${toPath({ kind: "support", page: "help" })}?lang=${encodeURIComponent(interfaceTranslator.locale)}`}
        >
          {interfaceTranslator.t("support.help.title")}
        </a>
        <a
          data-billing-refunds
          href={`${toPath({ kind: "support", page: "refunds" })}?lang=${encodeURIComponent(interfaceTranslator.locale)}`}
        >
          {interfaceTranslator.t("support.refunds.title")}
        </a>
      </nav>
      <PaymentSummary balance={balance} entitlement={entitlement} />
      {canManageSubscription ? (
        <GameButton
          static
          variant="secondary"
          data-subscription-management
          disabled={managing}
          onClick={() => void manageSubscription()}
        >
          {interfaceTranslator.t("product.billing.manage")}
        </GameButton>
      ) : null}
      {portalUrl ? (
        <p>
          <a href={portalUrl} target="_blank" rel="noreferrer">
            {interfaceTranslator.t("product.billing.portal")}
          </a>
          <br />
          {interfaceTranslator.t("product.billing.portalHint")}
        </p>
      ) : null}

      {order ? (
        <PaymentOrderNotice
          order={order}
          refreshing={refreshingOrder}
          onRefresh={() => void refreshOrder()}
        />
      ) : null}
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </section>
  );
}
