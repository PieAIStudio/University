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
import type { BillingConfig } from "../billing/plans.js";
import { createIdentityPort, type IdentityPort, type IdentityStatus } from "./identity.js";

export interface WalletBalance {
  readonly availablePowerUnits: string;
  readonly balancePowerUnits: string;
  readonly reservedPowerUnits: string;
}

export type PaymentOrderStatus = "pending" | "paid" | "failed" | "cancelled";

export interface PaymentOrder {
  readonly orderId: string;
  /** A product-owned offer key, not a payment-provider or channel name. */
  readonly offerId: string;
  readonly status: PaymentOrderStatus;
  /** Null when the server has not created a checkout action yet. */
  readonly checkoutUrl: string | null;
}

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
  }) => Promise<PaymentOrder>;
  readonly getOrderStatus?: (input: {
    readonly userId: string;
    readonly orderId: string;
  }) => Promise<PaymentOrder>;
}

export interface PaymentPort {
  readBalance(): Promise<PaymentResult<WalletBalance>>;
  readEntitlements(): Promise<PaymentResult<EntitlementReadModel>>;
  initiatePurchase(input: {
    readonly offerId: string;
    /** Tests and durable retry flows may reuse the id the browser generated. */
    readonly orderId?: string;
  }): Promise<PaymentResult<PaymentOrder>>;
  getOrderStatus(orderId: string): Promise<PaymentResult<PaymentOrder>>;
  refreshEntitlements(): Promise<PaymentResult<EntitlementReadModel>>;
}

export interface CreatePaymentPortOptions {
  readonly identity: IdentityPort;
  readonly transport: PaymentTransport | null;
  readonly billingConfig?: BillingConfig;
  readonly orderIdFactory?: () => string;
}

const DEFAULT_NO_CHANNEL_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "购买入口还没接好",
  whatItDoes:
    "接通后，这里会为你的账号生成一个订单号，并把你交给服务端选择可用的支付渠道；付款成功后，服务端才会更新钱包和权益。",
  whyUnavailable:
    "当前还没有发布给 University 使用的服务端订单入口。浏览器不会直连支付 SDK，也不会自己给钱包加额度。",
  futureSupport:
    "待产品确认价格后，服务端会统一接入国内和海外渠道，验证付款回调，按订单幂等结算，再让这里刷新权益。",
};

const ACCOUNT_REQUIRED_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "请先登录再购买",
  whatItDoes: "钱包余额、订单和购买后的权益都属于一个账号，登录后才能安全地查到同一份记录。",
  whyUnavailable: "当前没有登录账号，所以浏览器没有可以绑定的订单和钱包；本地学习不会因此被挡住。",
  futureSupport: "登录后，这个入口会使用同一个账号发起购买、查询订单，并在成功后刷新权益。",
};

const ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "购买前先绑定邮箱",
  whatItDoes:
    "钱包、订单和购买后的权益都属于正式账号；绑定邮箱后，服务端才能安全地查到同一份记录。",
  whyUnavailable:
    "当前是匿名账号。先加一个邮箱，这样换设备和退款才有依据；本地学习不会因此被挡住。",
  futureSupport: "去个人档案绑定邮箱；绑定会保留当前身份和进度，再从这里购买。",
  action: { label: "去绑定邮箱", href: "#/me" },
};

const BALANCE_UNAVAILABLE_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "钱包余额暂时读不到",
  whatItDoes: "它只读取服务端的钱包余额，不会在浏览器里改变额度。",
  whyUnavailable: "当前环境没有可用的钱包读取服务；这不代表余额是 0，也不会用猜出来的数字代替它。",
  futureSupport: "连接到 SwimmerBackend 并登录后，这里会读取服务端返回的余额。",
};

const ENTITLEMENT_UNAVAILABLE_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "权益暂时读不到",
  whatItDoes: "它读取账号当前由服务端授予的权益，购买完成后也靠这份记录更新页面。",
  whyUnavailable: "服务端权益读取暂时没有返回，页面不会把待确认的付费档位当成已经拥有。",
  futureSupport: "订单结算完成后，服务端会返回最新权益；这里会在购买成功时重新读取。",
};

const ORDER_STATUS_UNAVAILABLE_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "订单查询还没接好",
  whatItDoes: "它向服务端查询同一个订单号的状态，不在浏览器猜付款是否成功。",
  whyUnavailable: "当前还没有发布给 University 的订单查询接口。",
  futureSupport:
    "订单表和服务端查询接口上线后，这里会显示等待、成功、失败或取消，并在成功后刷新权益。",
};

const INVALID_ORDER_EXPLANATION: PaymentExplanation = {
  kind: "explanation",
  title: "这个订单号不能查询",
  whatItDoes: "订单号用来把一次付款和账号里的订单记录对应起来。",
  whyUnavailable: "页面没有收到有效的订单号，所以不会发出一条含糊的查询。",
  futureSupport: "重新从购买入口发起一次请求，浏览器会生成新的订单号。",
};

function accountRequiredExplanation(status: IdentityStatus): PaymentExplanation {
  return status.kind === "anonymous"
    ? ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION
    : ACCOUNT_REQUIRED_EXPLANATION;
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
  const requests = new Map<
    string,
    { readonly offerId: string; readonly result: Promise<PaymentResult<PaymentOrder>> }
  >();

  const userIdOf = (): string | null => {
    const status = options.identity.status();
    return status.kind === "signed_in" ? status.user.id : null;
  };

  const requestKeyOf = (userId: string, orderId: string): string => `${userId}\u0000${orderId}`;

  const readEntitlementResult = async (): Promise<PaymentResult<EntitlementReadModel>> => {
    const status = options.identity.status();
    if (status.kind === "anonymous") return ANONYMOUS_ACCOUNT_REQUIRED_EXPLANATION;
    let grant: EntitlementGrant | null | undefined;
    if (status.kind === "signed_in" && options.transport?.readEntitlement) {
      try {
        grant = await options.transport.readEntitlement(status.user.id);
      } catch {
        return ENTITLEMENT_UNAVAILABLE_EXPLANATION;
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
    async readBalance() {
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status);
      const readBalance = options.transport?.readBalance;
      if (!readBalance) return BALANCE_UNAVAILABLE_EXPLANATION;
      try {
        return { kind: "value", value: await readBalance(userId) };
      } catch {
        return BALANCE_UNAVAILABLE_EXPLANATION;
      }
    },

    readEntitlements: readEntitlementResult,

    async initiatePurchase(input) {
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status);
      const createOrder = options.transport?.createOrder;
      if (!createOrder) return DEFAULT_NO_CHANNEL_EXPLANATION;

      const offerId = input.offerId.trim();
      if (!offerId) throw new Error("Payment offerId must not be empty");
      const orderId = input.orderId?.trim() || options.orderIdFactory?.();
      if (!orderId) throw new Error("Payment orderId must not be empty");

      const requestKey = requestKeyOf(userId, orderId);
      const existing = requests.get(requestKey);
      if (existing) {
        if (existing.offerId !== offerId) {
          throw new Error("Payment order id cannot be reused for a different offer");
        }
        return existing.result;
      }

      const result = (async (): Promise<PaymentResult<PaymentOrder>> => {
        const order = await createOrder({ userId, orderId, offerId });
        if (order.orderId !== orderId || order.offerId !== offerId) {
          throw new Error("Payment backend returned an order for a different request");
        }
        return { kind: "value", value: order };
      })();
      requests.set(requestKey, { offerId, result });

      try {
        return await result;
      } catch (error) {
        requests.delete(requestKey);
        throw error;
      }
    },

    async getOrderStatus(orderId) {
      const normalizedOrderId = orderId.trim();
      if (!normalizedOrderId) return INVALID_ORDER_EXPLANATION;
      const status = options.identity.status();
      const userId = userIdOf();
      if (!userId) return accountRequiredExplanation(status);
      const getOrderStatus = options.transport?.getOrderStatus;
      if (!getOrderStatus) return ORDER_STATUS_UNAVAILABLE_EXPLANATION;
      try {
        const order = await getOrderStatus({ userId, orderId: normalizedOrderId });
        if (order.orderId !== normalizedOrderId) {
          throw new Error("Payment backend returned an order for a different request");
        }
        return { kind: "value", value: order };
      } catch {
        return ORDER_STATUS_UNAVAILABLE_EXPLANATION;
      }
    },

    refreshEntitlements: readEntitlementResult,
  };
}

/** Stable fallback for callers that render the shared screen without a backend assembly. */
export function createUnavailablePaymentPort(): PaymentPort {
  return createPaymentPort({ identity: createIdentityPort(null), transport: null });
}
