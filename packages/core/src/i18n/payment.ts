import { createI18n } from "@pieai/swimmer-i18n-kit";
import source from "./payment-catalogs/zh-CN/messages.json" with { type: "json" };
import type { PaymentExplanation } from "../ports/payment.js";
/** This capability currently has source copy only; missing languages fall back as a whole. */
export const paymentI18n = createI18n({ sourceLocale: "zh-CN", source, catalogs: {} });
export function paymentExplanations(locale?: string) {
  const { t } = paymentI18n.translator(locale);
  return {
    INTENT_UNAVAILABLE: {
      kind: "explanation",
      title: t("payment.intent_unavailable.title"),
      whatItDoes: t("payment.intent_unavailable.whatItDoes"),
      whyUnavailable: t("payment.intent_unavailable.whyUnavailable"),
      futureSupport: t("payment.intent_unavailable.futureSupport"),
    },
    DEFAULT_NO_CHANNEL_EXPLANATION: {
      kind: "explanation",
      title: t("payment.default_no_channel_explanation.title"),
      whatItDoes: t("payment.default_no_channel_explanation.whatItDoes"),
      whyUnavailable: t("payment.default_no_channel_explanation.whyUnavailable"),
      futureSupport: t("payment.default_no_channel_explanation.futureSupport"),
      action: { label: t("payment.default_no_channel_explanation.action.label"), href: "#/" },
    },
    ACCOUNT_REQUIRED_EXPLANATION: {
      kind: "explanation",
      title: t("payment.account_required_explanation.title"),
      whatItDoes: t("payment.account_required_explanation.whatItDoes"),
      whyUnavailable: t("payment.account_required_explanation.whyUnavailable"),
      futureSupport: t("payment.account_required_explanation.futureSupport"),
      /*
    Without this the buyer is told to log in and handed no way to do it: the
    anonymous case next door already carries its action, and this one is the
    same dead end one step earlier.
  */
      action: { label: t("payment.account_required_explanation.action.label"), href: "#/me" },
    },
    ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION: {
      kind: "explanation",
      title: t("payment.anonymous_account_required_explanation.title"),
      whatItDoes: t("payment.anonymous_account_required_explanation.whatItDoes"),
      whyUnavailable: t("payment.anonymous_account_required_explanation.whyUnavailable"),
      futureSupport: t("payment.anonymous_account_required_explanation.futureSupport"),
      action: {
        label: t("payment.anonymous_account_required_explanation.action.label"),
        href: "#/me",
      },
    },
    BALANCE_UNAVAILABLE_EXPLANATION: {
      kind: "explanation",
      title: t("payment.balance_unavailable_explanation.title"),
      whatItDoes: t("payment.balance_unavailable_explanation.whatItDoes"),
      whyUnavailable: t("payment.balance_unavailable_explanation.whyUnavailable"),
      futureSupport: t("payment.balance_unavailable_explanation.futureSupport"),
    },
    ENTITLEMENT_UNAVAILABLE_EXPLANATION: {
      kind: "explanation",
      title: t("payment.entitlement_unavailable_explanation.title"),
      whatItDoes: t("payment.entitlement_unavailable_explanation.whatItDoes"),
      whyUnavailable: t("payment.entitlement_unavailable_explanation.whyUnavailable"),
      futureSupport: t("payment.entitlement_unavailable_explanation.futureSupport"),
    },
    ORDER_STATUS_UNAVAILABLE_EXPLANATION: {
      kind: "explanation",
      title: t("payment.order_status_unavailable_explanation.title"),
      whatItDoes: t("payment.order_status_unavailable_explanation.whatItDoes"),
      whyUnavailable: t("payment.order_status_unavailable_explanation.whyUnavailable"),
      futureSupport: t("payment.order_status_unavailable_explanation.futureSupport"),
    },
    INVALID_ORDER_EXPLANATION: {
      kind: "explanation",
      title: t("payment.invalid_order_explanation.title"),
      whatItDoes: t("payment.invalid_order_explanation.whatItDoes"),
      whyUnavailable: t("payment.invalid_order_explanation.whyUnavailable"),
      futureSupport: t("payment.invalid_order_explanation.futureSupport"),
    },
    MANAGEMENT_UNAVAILABLE: {
      kind: "explanation",
      title: t("payment.management_unavailable.title"),
      whatItDoes: t("payment.management_unavailable.whatItDoes"),
      whyUnavailable: t("payment.management_unavailable.whyUnavailable"),
      futureSupport: t("payment.management_unavailable.futureSupport"),
    },
  } satisfies Record<string, PaymentExplanation>;
}
