import { describe, expect, it, vi } from "vitest";

import { createMemoryIdentityPort } from "./identity.js";
import { createPaymentPort, type PaymentOrder, type PaymentTransport } from "./payment.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "00000000-0000-4000-8000-000000000002";
const BALANCE = {
  availablePowerUnits: "900",
  balancePowerUnits: "1000",
  reservedPowerUnits: "100",
} as const;
const ORDER: PaymentOrder = {
  orderId: ORDER_ID,
  offerId: "paid-entitlement",
  status: "pending",
  checkoutUrl: "https://payments.example/checkout",
};

function identity() {
  return createMemoryIdentityPort({ id: USER_ID, email: "learner@example.com" });
}

describe("createPaymentPort", () => {
  it("requires a formal account for payment reads and writes while allowing anonymous progress elsewhere", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const readBalance = vi.fn(async () => BALANCE);
    const readEntitlement = vi.fn(async () => ({ planId: "free" as const }));
    const createOrder = vi.fn<NonNullable<PaymentTransport["createOrder"]>>(async (input) => ({
      ...ORDER,
      orderId: input.orderId,
      offerId: input.offerId,
    }));
    const getOrderStatus = vi.fn<NonNullable<PaymentTransport["getOrderStatus"]>>(
      async () => ORDER,
    );
    const payment = createPaymentPort({
      identity,
      transport: { readBalance, readEntitlement, createOrder, getOrderStatus },
      orderIdFactory: () => ORDER_ID,
    });

    expect(payment.purchaseAvailability()).toBe("anonymous");

    await expect(payment.readBalance()).resolves.toMatchObject({
      kind: "explanation",
      title: "先绑定邮箱再购买",
    });
    await expect(payment.readEntitlements()).resolves.toMatchObject({
      kind: "explanation",
      title: "先绑定邮箱再购买",
    });
    await expect(payment.refreshEntitlements()).resolves.toMatchObject({
      kind: "explanation",
      title: "先绑定邮箱再购买",
    });
    await expect(payment.initiatePurchase({ offerId: "paid-entitlement" })).resolves.toMatchObject({
      kind: "explanation",
      title: "先绑定邮箱再购买",
    });
    await expect(payment.getOrderStatus(ORDER_ID)).resolves.toMatchObject({
      kind: "explanation",
      title: "先绑定邮箱再购买",
    });

    expect(readBalance).not.toHaveBeenCalled();
    expect(readEntitlement).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(getOrderStatus).not.toHaveBeenCalled();
  });

  it("generates a browser order id and coalesces repeated requests for that id", async () => {
    const createOrder = vi.fn<NonNullable<PaymentTransport["createOrder"]>>(async (input) => ({
      ...ORDER,
      orderId: input.orderId,
      offerId: input.offerId,
    }));
    const orderIdFactory = vi.fn(() => ORDER_ID);
    const payment = createPaymentPort({
      identity: identity(),
      transport: { createOrder },
      orderIdFactory,
    });

    expect(payment.purchaseAvailability()).toBe("available");

    const first = await payment.initiatePurchase({ offerId: "paid-entitlement" });
    const second = await payment.initiatePurchase({
      offerId: "paid-entitlement",
      orderId: ORDER_ID,
    });

    expect(orderIdFactory).toHaveBeenCalledOnce();
    expect(createOrder).toHaveBeenCalledOnce();
    expect(createOrder).toHaveBeenCalledWith({
      userId: USER_ID,
      orderId: ORDER_ID,
      offerId: "paid-entitlement",
    });
    expect(first).toEqual({ kind: "value", value: ORDER });
    expect(second).toBe(first);
  });

  it("returns an explanation instead of pretending a missing order channel exists", async () => {
    const payment = createPaymentPort({
      identity: identity(),
      transport: { readBalance: async () => BALANCE },
    });

    expect(payment.purchaseAvailability()).toBe("unavailable");

    await expect(payment.initiatePurchase({ offerId: "paid-entitlement" })).resolves.toMatchObject({
      kind: "explanation",
      title: "支付入口尚未开放",
    });
  });

  it("reads the wallet without exposing a browser-side wallet mutation", async () => {
    const payment = createPaymentPort({
      identity: identity(),
      transport: { readBalance: async () => BALANCE },
    });

    await expect(payment.readBalance()).resolves.toEqual({ kind: "value", value: BALANCE });
  });

  it("refreshes the entitlement read model from the server grant", async () => {
    const readEntitlement = vi.fn(async () => ({ planId: "free" }));
    const payment = createPaymentPort({
      identity: identity(),
      transport: { readEntitlement },
    });

    const refreshed = await payment.refreshEntitlements();

    expect(readEntitlement).toHaveBeenCalledWith(USER_ID);
    expect(refreshed).toMatchObject({ kind: "value", value: { planId: "free", source: "remote" } });
  });
});
