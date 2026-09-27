import { paymentExplanations } from "../i18n/payment.js";
/**
 * The browser-facing payment contract.
 *
 * Payment is not one of the two shells' answers to where AI or lesson material
 * comes from, so it is not a mode port. Both builds call this one coordinator.
 * It knows how to require an account, generate and retain an order id, and
 * turn an unavailable server capability into an explanation. It does not know
 * Supabase, a payment provider, or a database table.
 *
 * The browser can read a balance and request an order. It cannot grant,
 * reserve, commit, or refund wallet units. Those mutations belong to the
 * server-side payment adapter and its verified webhook transaction.
 */

import {
  readEntitlements,
  type EntitlementGrant,
  type EntitlementReadModel,
} from "../billing/entitlements.js";
import { BILLING_CONFIG, planById, type BillingConfig } from "../billing/plans.js";
import { createIdentityPort, type IdentityPort, type IdentityStatus } from "./identity.js";

export interface WalletBalance {
  readonly availablePowerUnits: string;
  readonly balancePowerUnits: string;
  readonly reservedPowerUnits: string;
}

export type PaymentOrderStatus = "pending" | "paid" | "failed" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

/** Server quote: base offer, any tax, and payable total stay distinct. */
export interface PaymentQuote {
  readonly billingCycle: BillingCycle;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
}

export interface PaymentOrder {
  readonly orderId: string;
  /** A product-owned offer key, not a payment-provider or channel name. */
  readonly offerId: string;
  readonly status: PaymentOrderStatus;
  /** Null when the server has not created a checkout action yet. */
  readonly checkoutUrl: string | null;
  /** Old historical reads may lack this; a NEW purchase may not. */
  readonly quote?: PaymentQuote;
}

/** The state a purchase CTA can explain before a learner presses it. */
export type PaymentAvailability = "available" | "anonymous" | "account-required" | "unavailable";

/** A learner-facing explanation for an unavailable payment capability. */
export interface PaymentExplanation {
  readonly kind: "explanation";
  readonly title: string;
  readonly whatItDoes: string;
  readonly whyUnavailable: string;
  readonly futureSupport: string;
  readonly action?: {
    readonly label: string;
    readonly href: string;
  };
}

export type PaymentResult<Value> =
  | { readonly kind: "value"; readonly value: Value }
  | PaymentExplanation;

/**
 * The only network-facing methods the browser coordinator may call.
 *
 * The order and entitlement methods are optional because the backend release
 * is staged: the existing wallet balance RPC can be available before the
 * University order/webhook surface is. An adapter must never fill the gap by
 * putting provider SDK calls in the browser.
 */
export interface PaymentTransport {
  readonly readBalance?: (userId: string) => Promise<WalletBalance>;
  readonly readEntitlement?: (userId: string) => Promise<EntitlementGrant | null>;
  readonly createOrder?: (input: {
    readonly userId: string;
    readonly orderId: string;
    readonly offerId: string;
    readonly billingCycle: BillingCycle;
  }) => Promise<PaymentOrder>;
  readonly getOrderStatus?: (input: {
    readonly userId: string;
    readonly orderId: string;
  }) => Promise<PaymentOrder>;
  /** Authenticated server creates a session in its actual subscription portal. */
  readonly createSubscriptionPortal?: (userId: string) => Promise<string>;
}

export interface PaymentPort {
  /** Stable identity boundary for clearing visible wallet/order data on account changes. */
  accountKey?(): string;
  subscribe?(listener: () => void): () => void;
  /**
   * A presentational hint only. `initiatePurchase` remains the authority and
   * returns a PaymentExplanation when the state changed or is unavailable.
   */
  purchaseAvailability(): PaymentAvailability;
  readBalance(): Promise<PaymentResult<WalletBalance>>;
  readEntitlements(): Promise<PaymentResult<EntitlementReadModel>>;
  initiatePurchase(input: {
    readonly offerId: string;
    readonly billingCycle?: BillingCycle;
    /** Tests and durable retry flows may reuse the id the browser generated. */
    readonly orderId?: string;
  }): Promise<PaymentResult<PaymentOrder>>;
  getOrderStatus(orderId: string): Promise<PaymentResult<PaymentOrder>>;
  refreshEntitlements(): Promise<PaymentResult<EntitlementReadModel>>;
  /** Query a retained intent; never create an order merely by opening a page. */
  resumePurchase?(): Promise<PaymentResult<PaymentOrder> | null>;
  manageSubscription?(): Promise<PaymentResult<{ readonly url: string }>>;
}

export interface CreatePaymentPortOptions {
  /** Host selection, read when returning a user-facing explanation. */
  readonly locale?: () => string;
  readonly identity: IdentityPort;
  readonly transport: PaymentTransport | null;
  readonly billingConfig?: BillingConfig;
  readonly orderIdFactory?: () => string;
  readonly intentStore?: {
    read(userId: string): string | null;
    write(userId: string, raw: string): void;
  };
}

interface PurchaseIntent {
  readonly orderId: string;
  readonly offerId: string;
  readonly billingCycle: BillingCycle;
}

/** Redirects come from the authenticated backend, never from URL query input. */
export function safePaymentUrl(value: string): boolean {
  try {
    // The core does not depend on DOM or Node declarations. Both supported
    // runtimes supply the standard parser; a missing parser fails closed.
    const Url = (
      globalThis as unknown as {
        URL: new (value: string) => {
          protocol: string;
          hostname: string;
          username: string;
          password: string;
        };
      }
    ).URL;
    const url = new Url(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      host.includes(".") &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local") &&
      !/^\d+(?:\.\d+){3}$/u.test(host) &&
      !host.includes(":")
    );
  } catch {
    return false;
  }
}

function validateOrder(
  order: PaymentOrder,
  expected?: { offerId: string; billingCycle: BillingCycle },
  config = BILLING_CONFIG as BillingConfig,
): void {
  if (expected && order.offerId !== expected.offerId)
    throw new Error("Payment order offer does not match the request");
  if (!["pending", "paid", "failed", "cancelled"].includes(order.status))
    throw new Error("Payment order status is invalid");
  if (order.checkoutUrl !== null && !safePaymentUrl(order.checkoutUrl))
    throw new Error("Payment checkout URL is unsafe");
  const quote = order.quote;
  if (!expected && !quote) return; // Read-only legacy orders are not new purchases.
  const plan = planById(expected?.offerId ?? order.offerId, config);
  const cycle = expected?.billingCycle ?? quote?.billingCycle;
  const pricing = plan?.pricing;
  const price =
    pricing?.kind === "configured"
      ? cycle === "yearly"
        ? pricing.yearlyCents
        : pricing.monthlyCents
      : null;
  if (
    !quote ||
    (cycle !== "monthly" && cycle !== "yearly") ||
    !pricing ||
    pricing.kind !== "configured" ||
    price === null ||
    quote.billingCycle !== cycle ||
    quote.currency !== pricing.currency ||
    quote.subtotalCents !== price ||
    ![quote.subtotalCents, quote.taxCents, quote.totalCents].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    quote.totalCents !== quote.subtotalCents + quote.taxCents
  ) {
    throw new Error("Payment quote does not match the selected offer / 订单报价与所选方案不一致");
  }
}

function accountRequiredExplanation(status: IdentityStatus, locale?: string): PaymentExplanation {
  const explanations = () => paymentExplanations(locale);
  return status.kind === "anonymous"
    ? explanations().ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION
    : explanations().ACCOUNT_REQUIRED_EXPLANATION;
}

/**
 * One account-bound coordinator for both browser modes.
 *
 * Successful order creations stay in a small in-memory cache so a double click
 * or a retry in the same page sends one request. The server must still enforce
 * a unique `(user_id, order_id)` (or equivalent idempotency key), because a
 * browser can be reloaded and cannot be the final authority.
 */
export function createPaymentPort(options: CreatePaymentPortOptions): PaymentPort {
  const explanations = () => paymentExplanations(options.locale?.());
  const requests = new Map<
    string,
    {
      readonly offerId: string;
      readonly billingCycle: BillingCycle;
      readonly result: Promise<PaymentResult<PaymentOrder>>;
    }
  >();
  // A transport timeout is not proof that the backend did not create an order.
  // Keep the retry identity until this page's caller deliberately chooses a new intent.
  const intents = new Map<string, PurchaseIntent | null>();
  function loadIntent(userId: string): PurchaseIntent | null {
    if (intents.has(userId)) return intents.get(userId) ?? null;
    const raw = options.intentStore?.read(userId);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (value === null) return null;
    if (typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid purchase intent");
    const item = value as Record<string, unknown>;
    if (
      typeof item.orderId !== "string" ||
      !item.orderId.trim() ||
      item.orderId.length > 200 ||
      typeof item.offerId !== "string" ||
      !item.offerId.trim() ||
      item.offerId.length > 200 ||
      (item.billingCycle !== "monthly" && item.billingCycle !== "yearly")
    )
      throw new Error("Invalid purchase intent");
    const intent: PurchaseIntent = {
      orderId: item.orderId,
      offerId: item.offerId,
      billingCycle: item.billingCycle,
    };
    intents.set(userId, intent);
    return intent;
  }
  function saveIntent(userId: string, intent: PurchaseIntent | null): void {
    // Persist before sending. A write failure must not create an untraceable order.
    options.intentStore?.write(userId, JSON.stringify(intent));
    intents.set(userId, intent);
  }
  const completeChannel = () =>
    Boolean(
      options.transport?.createOrder &&
      options.transport.getOrderStatus &&
      options.transport.createSubscriptionPortal,
    );

  const userIdOf = (): string | null => {
    const status = options.identity.status();
    return status.kind === "signed_in" ? status.user.id : null;
  };

  const requestKeyOf = (userId: string, orderId: string): string => `${userId}\u0000${orderId}`;

  const readEntitlementResult = async (): Promise<PaymentResult<EntitlementReadModel>> => {
    const status = options.identity.status();
    if (status.kind === "anonymous") return explanations().ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION;
    let grant: EntitlementGrant | null | undefined;
    if (status.kind === "signed_in" && options.transport?.readEntitlement) {
      try {
        grant = await options.transport.readEntitlement(status.user.id);
        if (userIdOf() !== status.user.id)
          return explanations().ENTITLEMENT_UNAVAILABLE_EXPLANATION;
      } catch {
        return explanations().ENTITLEMENT_UNAVAILABLE_EXPLANATION;
      }
    }

    return {
      kind: "value",
      value: readEntitlements(
        {
          identity: status,
          remoteAvailable: options.transport !== null,
          grant,
        },
        options.billingConfig,
      ),
    };
  };

  return {
    accountKey: () => {
      const status = options.identity.status();
      return status.kind === "signed_in" || status.kind === "anonymous"
        ? `${status.kind}:${status.user.id}`
        : status.kind;
    },
    subscribe: (listener) => options.identity.subscribe(listener),
    purchaseAvailability() {
      if (!completeChannel()) return "unavailable";
      const status = options.identity.status();
      if (status.kind === "anonymous") return "anonymous";
      if (status.kind !== "signed_in") return "account-required";
      return "available";
    },

    async readBalance() {
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status, options.locale?.());
      const readBalance = options.transport?.readBalance;
      if (!readBalance) return explanations().BALANCE_UNAVAILABLE_EXPLANATION;
      try {
        const value = await readBalance(userId);
        if (userIdOf() !== userId) return explanations().BALANCE_UNAVAILABLE_EXPLANATION;
        return { kind: "value", value };
      } catch {
        return explanations().BALANCE_UNAVAILABLE_EXPLANATION;
      }
    },

    readEntitlements: readEntitlementResult,

    async initiatePurchase(input) {
      if (!completeChannel()) return explanations().DEFAULT_NO_CHANNEL_EXPLANATION;
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status, options.locale?.());
      const createOrder = options.transport?.createOrder;
      if (!createOrder) return explanations().DEFAULT_NO_CHANNEL_EXPLANATION;

      const offerId = input.offerId.trim();
      if (!offerId) throw new Error("Payment offerId must not be empty");
      const billingCycle = input.billingCycle;
      if (billingCycle !== "monthly" && billingCycle !== "yearly")
        throw new Error("请选择按月或按年，再继续购买。");
      let previous: PurchaseIntent | null;
      try {
        previous = loadIntent(userId);
      } catch {
        return explanations().INTENT_UNAVAILABLE;
      }
      if (
        previous &&
        (previous.offerId !== offerId ||
          previous.billingCycle !== billingCycle ||
          (input.orderId && input.orderId.trim() !== previous.orderId))
      )
        return explanations().INTENT_UNAVAILABLE;
      const orderId = previous?.orderId || input.orderId?.trim() || options.orderIdFactory?.();
      if (!orderId) throw new Error("Payment orderId must not be empty");
      try {
        saveIntent(userId, { orderId, offerId, billingCycle });
      } catch {
        return explanations().INTENT_UNAVAILABLE;
      }

      const requestKey = requestKeyOf(userId, orderId);
      const existing = requests.get(requestKey);
      if (existing) {
        if (existing.offerId !== offerId || existing.billingCycle !== billingCycle) {
          throw new Error("Payment order id cannot be reused for a different offer");
        }
        return existing.result;
      }

      const result = (async (): Promise<PaymentResult<PaymentOrder>> => {
        const order = await createOrder({ userId, orderId, offerId, billingCycle });
        if (userIdOf() !== userId)
          return accountRequiredExplanation(options.identity.status(), options.locale?.());
        if (order.orderId !== orderId || order.offerId !== offerId) {
          throw new Error("Payment backend returned an order for a different request");
        }
        validateOrder(order, { offerId, billingCycle }, options.billingConfig);
        if (order.status === "failed" || order.status === "cancelled") saveIntent(userId, null);
        return { kind: "value", value: order };
      })();
      requests.set(requestKey, { offerId, billingCycle, result });
      if (requests.size > 40) requests.delete(requests.keys().next().value!);

      try {
        return await result;
      } catch (error) {
        requests.delete(requestKey);
        throw error;
      }
    },

    async getOrderStatus(orderId) {
      const normalizedOrderId = orderId.trim();
      if (!normalizedOrderId) return explanations().INVALID_ORDER_EXPLANATION;
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status, options.locale?.());
      const getOrderStatus = options.transport?.getOrderStatus;
      if (!getOrderStatus) return explanations().ORDER_STATUS_UNAVAILABLE_EXPLANATION;
      try {
        const order = await getOrderStatus({ userId, orderId: normalizedOrderId });
        if (userIdOf() !== userId)
          return accountRequiredExplanation(options.identity.status(), options.locale?.());
        if (order.orderId !== normalizedOrderId) {
          throw new Error("Payment backend returned an order for a different request");
        }
        const intent = loadIntent(userId);
        validateOrder(
          order,
          intent?.orderId === normalizedOrderId ? intent : undefined,
          options.billingConfig,
        );
        if (
          intent?.orderId === normalizedOrderId &&
          (order.status === "failed" || order.status === "cancelled")
        ) {
          saveIntent(userId, null);
          requests.delete(requestKeyOf(userId, normalizedOrderId));
        }
        return { kind: "value", value: order };
      } catch {
        return explanations().ORDER_STATUS_UNAVAILABLE_EXPLANATION;
      }
    },

    refreshEntitlements: readEntitlementResult,
    async resumePurchase() {
      const userId = userIdOf();
      if (!userId) return null;
      try {
        const intent = loadIntent(userId);
        return intent ? await this.getOrderStatus(intent.orderId) : null;
      } catch {
        return explanations().INTENT_UNAVAILABLE;
      }
    },
    async manageSubscription() {
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(options.identity.status(), options.locale?.());
      const open = options.transport?.createSubscriptionPortal;
      if (!open) return explanations().MANAGEMENT_UNAVAILABLE;
      try {
        const url = await open(userId);
        if (userIdOf() !== userId || !safePaymentUrl(url))
          return explanations().MANAGEMENT_UNAVAILABLE;
        return { kind: "value", value: { url } };
      } catch {
        return explanations().MANAGEMENT_UNAVAILABLE;
      }
    },
  };
}

/** Stable fallback for callers that render the shared screen without a backend assembly. */
export function createUnavailablePaymentPort(locale?: () => string): PaymentPort {
  return createPaymentPort({ identity: createIdentityPort(null), transport: null, locale });
}
