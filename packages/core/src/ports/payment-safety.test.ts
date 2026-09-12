import { describe, expect, it, vi } from "vitest";
import { createMemoryIdentityPort } from "./identity.js";
import { createPaymentPort, type PaymentOrder, type PaymentTransport } from "./payment.js";

const identity = () => createMemoryIdentityPort({ id: "learner-1", email: "learner@example.test" });
const quote = {
  billingCycle: "monthly" as const,
  currency: "USD",
  subtotalCents: 1900,
  taxCents: 0,
  totalCents: 1900,
};
const order: PaymentOrder = {
  orderId: "order-1",
  offerId: "member",
  status: "pending",
  checkoutUrl: "https://payments.example.test/checkout",
  quote,
};
const transport = (): PaymentTransport => ({
  createOrder: async (input) => ({
    ...order,
    orderId: input.orderId,
    offerId: input.offerId,
    quote:
      input.billingCycle === "yearly"
        ? { ...quote, billingCycle: "yearly", subtotalCents: 14900, totalCents: 14900 }
        : quote,
  }),
  getOrderStatus: async () => order,
  createSubscriptionPortal: async () => "https://payments.example.test/account",
});

describe("payment launch safety", () => {
  it("B6 reload after an uncertain request reuses the account-bound purchase intent", async () => {
    const saved = new Map<string, string>();
    const intentStore = {
      read: (userId: string) => saved.get(userId) ?? null,
      write: (userId: string, raw: string) => {
        saved.set(userId, raw);
      },
    };
    const createOrder = vi.fn(transport().createOrder!).mockRejectedValueOnce(new Error("timeout"));
    const options = {
      identity: identity(),
      transport: { ...transport(), createOrder },
      intentStore,
    };
    const first = createPaymentPort({ ...options, orderIdFactory: () => "original-order" });
    await expect(
      first.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).rejects.toThrow("timeout");
    const idFactory = vi.fn(() => "duplicate-order");
    const reloaded = createPaymentPort({ ...options, orderIdFactory: idFactory });
    await reloaded.initiatePurchase({ offerId: "member", billingCycle: "monthly" });
    expect(createOrder.mock.calls.map(([input]) => input.orderId)).toEqual([
      "original-order",
      "original-order",
    ]);
    expect(idFactory).not.toHaveBeenCalled();
    expect([...saved.values()].join("")).not.toContain("checkout");
  });

  it("B7 status refresh cannot silently replace the selected billing cycle", async () => {
    const remote = transport();
    const payment = createPaymentPort({
      identity: identity(),
      orderIdFactory: () => "order-1",
      transport: {
        ...remote,
        getOrderStatus: async () => ({
          ...order,
          quote: { ...quote, billingCycle: "yearly", subtotalCents: 14900, totalCents: 14900 },
        }),
      },
    });
    await payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" });
    await expect(payment.getOrderStatus("order-1")).resolves.toMatchObject({ kind: "explanation" });
  });

  it("B8 failed durable intent storage prevents a new order from being sent", async () => {
    const createOrder = vi.fn(transport().createOrder!);
    const payment = createPaymentPort({
      identity: identity(),
      transport: { ...transport(), createOrder },
      orderIdFactory: () => "order-1",
      intentStore: {
        read: () => null,
        write: () => {
          throw new Error("storage full");
        },
      },
    });
    await expect(
      payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).resolves.toMatchObject({ kind: "explanation" });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("B1 no sale is disclosed before asking an unconfigured visitor to sign in", async () => {
    const payment = createPaymentPort({ identity: createMemoryIdentityPort(), transport: {} });
    expect(payment.purchaseAvailability()).toBe("unavailable");
    await expect(
      payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).resolves.toMatchObject({ kind: "explanation", title: "支付入口尚未开放" });
  });
  it("B2 order creation alone cannot open charging without status and cancellation", async () => {
    for (const partial of [
      { createOrder: transport().createOrder },
      { createOrder: transport().createOrder, getOrderStatus: transport().getOrderStatus },
    ]) {
      const payment = createPaymentPort({
        identity: identity(),
        transport: partial,
        orderIdFactory: () => "order-1",
      });
      expect(payment.purchaseAvailability()).toBe("unavailable");
      await expect(
        payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
      ).resolves.toMatchObject({ kind: "explanation" });
    }
  });
  it("B3 monthly and yearly choices reach the server and their quoted price must agree", async () => {
    const remote = transport();
    const createOrder = vi.fn(remote.createOrder!);
    let number = 0;
    const payment = createPaymentPort({
      identity: identity(),
      transport: { ...remote, createOrder },
      orderIdFactory: () => `order-${++number}`,
    });
    const monthly = await payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" });
    // The quote contract is tested independently: changing the cycle must not
    // open another purchase while this account still has an unresolved order.
    const another = createPaymentPort({
      identity: identity(),
      transport: { ...remote, createOrder },
      orderIdFactory: () => `order-${++number}`,
    });
    const yearly = await another.initiatePurchase({ offerId: "member", billingCycle: "yearly" });
    expect(createOrder.mock.calls.map(([input]) => input.billingCycle)).toEqual([
      "monthly",
      "yearly",
    ]);
    expect(monthly).toMatchObject({ kind: "value", value: { quote: { totalCents: 1900 } } });
    expect(yearly).toMatchObject({ kind: "value", value: { quote: { totalCents: 14900 } } });
    const mismatch = createPaymentPort({
      identity: identity(),
      transport: {
        ...remote,
        createOrder: async () => ({ ...order, quote: { ...quote, currency: "EUR" } }),
      },
      orderIdFactory: () => "order-1",
    });
    await expect(
      mismatch.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).rejects.toThrow(/quote|报价/u);
  });
  it("B4 an uncertain transport failure reuses the same order id on retry", async () => {
    const createOrder = vi
      .fn(transport().createOrder!)
      .mockRejectedValueOnce(new Error("connection dropped"));
    const id = vi.fn(() => "order-1");
    const payment = createPaymentPort({
      identity: identity(),
      transport: { ...transport(), createOrder },
      orderIdFactory: id,
    });
    await expect(
      payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).rejects.toThrow();
    await payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" });
    expect(createOrder.mock.calls.map(([input]) => input.orderId)).toEqual(["order-1", "order-1"]);
    expect(id).toHaveBeenCalledTimes(1);
  });
  it("B5 unsafe portal and checkout addresses are rejected, not handed to the browser", async () => {
    for (const url of [
      "javascript:alert(1)",
      "http://payments.example.test",
      "https://secret@payments.example.test",
      "https://127.0.0.1/account",
    ]) {
      const payment = createPaymentPort({
        identity: identity(),
        transport: { ...transport(), createSubscriptionPortal: async () => url },
        orderIdFactory: () => "order-1",
      });
      await expect(payment.manageSubscription?.()).resolves.toMatchObject({ kind: "explanation" });
    }
    const payment = createPaymentPort({
      identity: identity(),
      transport: {
        ...transport(),
        createOrder: async () => ({ ...order, checkoutUrl: "javascript:alert(1)" }),
      },
      orderIdFactory: () => "order-1",
    });
    await expect(
      payment.initiatePurchase({ offerId: "member", billingCycle: "monthly" }),
    ).rejects.toThrow();
  });
});
