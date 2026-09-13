// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryIdentityPort, createPaymentPort } from "@pieai/university-core";

import { PlansScreen } from "./PlansScreen.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelector("dialog")?.remove();
});

describe("PlansScreen purchase entry", () => {
  it("keeps the anonymous purchase CTA visible and points to email binding", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const createOrder = vi.fn();
    const payment = createPaymentPort({
      identity,
      transport: {
        readBalance: async () => ({
          availablePowerUnits: "0",
          balancePowerUnits: "0",
          reservedPowerUnits: "0",
        }),
        createOrder,
        getOrderStatus: vi.fn(),
        createSubscriptionPortal: async () => "https://payments.example/account",
      },
      orderIdFactory: () => "00000000-0000-4000-8000-000000000099",
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "先绑定邮箱",
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.textContent).toContain("先绑定邮箱再购买");
    expect(dialog?.textContent).toContain("不会创建订单");
    expect(dialog?.textContent).not.toContain("退款");
    expect(dialog?.querySelector('a[href="#/me"]')?.textContent).toContain("去绑定邮箱");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("keeps the CTA usable and explains when the account has no channel", async () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: {
        readBalance: async () => ({
          availablePowerUnits: "0",
          balancePowerUnits: "0",
          reservedPowerUnits: "0",
        }),
      },
      orderIdFactory: () => "00000000-0000-4000-8000-000000000099",
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "升级会员",
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("本次未扣款");
    expect(document.querySelector("dialog")).toBeNull();
    expect(container.textContent).not.toContain("尚未开售");
  });

  it("uses payment language only when the adapter reports a live order channel", async () => {
    const createOrder = vi.fn(
      async (input: {
        readonly orderId: string;
        readonly offerId: string;
        readonly userId: string;
        readonly billingCycle: "monthly" | "yearly";
      }) => ({
        orderId: input.orderId,
        offerId: input.offerId,
        status: "pending" as const,
        checkoutUrl: null,
        quote: {
          billingCycle: input.billingCycle,
          currency: "USD",
          subtotalCents: input.billingCycle === "yearly" ? 14900 : 1900,
          taxCents: 0,
          totalCents: input.billingCycle === "yearly" ? 14900 : 1900,
        },
      }),
    );
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: {
        createOrder,
        getOrderStatus: vi.fn(),
        createSubscriptionPortal: async () => "https://payments.example/account",
      },
      orderIdFactory: () => "00000000-0000-4000-8000-000000000099",
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "升级会员",
    );
    if (!cta) throw new Error("missing live purchase CTA");

    await act(async () => {
      cta.click();
    });

    expect(createOrder).toHaveBeenCalledWith({
      userId: "user-1",
      orderId: "00000000-0000-4000-8000-000000000099",
      offerId: "member",
      billingCycle: "yearly",
    });
  });
});

describe("PlansScreen pricing claims", () => {
  it("separates membership fees from explicitly chosen wallet-funded grading", async () => {
    await act(async () => root.render(<PlansScreen />));
    expect(container.textContent).toContain("会员费不包含钱包批改费用");
    expect(container.textContent).toContain("只有你主动选择钱包批改才会扣除");
    expect(container.textContent).toContain("年付一次支付全年费用");
  });
  it("withholds the cancellation reassurance while no order channel can charge", async () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: null,
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    // A promise to stop billing needs billing to exist. Until the transport can
    // create an order, the CTA only records intent, and the sentence would be
    // an escape route from a charge that cannot happen.
    expect(container.querySelector("[data-plan-cancellation='true']")).toBeNull();
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "升级会员",
    );
    expect(cta).not.toBeUndefined();
  });

  it("keeps the cancellation reassurance on the paid card before its CTA", async () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: {
        getOrderStatus: vi.fn(),
        createSubscriptionPortal: async () => "https://payments.example/account",
        createOrder: async (input: {
          readonly orderId: string;
          readonly offerId: string;
          readonly userId: string;
        }) => ({
          orderId: input.orderId,
          offerId: input.offerId,
          status: "pending" as const,
          checkoutUrl: null,
        }),
      },
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const reassurance = container.querySelector<HTMLElement>("[data-plan-cancellation='true']");
    expect(container.querySelector("[data-subscription-management]")).not.toBeNull();
    expect(reassurance).not.toBeNull();
    expect(reassurance?.closest(".plan-card--featured")).not.toBeNull();
    expect(reassurance?.textContent).toContain("订阅管理里取消下次续费");
    expect(reassurance?.textContent).toContain("不等于立即退款");

    const cta = reassurance?.parentElement?.querySelector("button.university-cta");
    expect(cta).not.toBeNull();
    if (!reassurance || !cta) throw new Error("missing paid-plan reassurance or CTA");
    expect(reassurance.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("derives the yearly saving from the configured prices", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const payment = createPaymentPort({ identity, transport: null });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const saving = container.querySelector(".plan-card__saving")?.textContent ?? "";
    // Twelve months at the configured monthly price against the configured
    // yearly price. If someone changes a price and this test still passes with
    // the old number, the claim on the page has become a lie.
    expect(saving).toContain("35%");
    expect(container.querySelector("[data-billing-details]")?.hasAttribute("open")).toBe(false);
    expect(container.querySelector(".plan-card__terms")?.textContent).toContain("AI 批改按次另计");
  });

  it("ranks the paid plan for the reader instead of leaving two identical cards", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const payment = createPaymentPort({ identity, transport: null });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const featured = container.querySelectorAll(".plan-card--featured");
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain("会员");
  });

  it("keeps the lede free of the spaces that source line breaks used to insert", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const payment = createPaymentPort({ identity, transport: null });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const lede = container.querySelector(".shell-screen__lede")?.textContent ?? "";
    expect(lede).not.toMatch(/[，。：] /);
  });
});

describe("free plan price line", () => {
  it("does not print the plan's own name a second time as its price", async () => {
    // 「免费」 as the heading and 「免费」 again at headline size made the tier
    // nobody needs persuading into the loudest thing on the pricing page.
    const identity = createMemoryIdentityPort();
    const payment = createPaymentPort({ identity, transport: null });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const cards = container.querySelectorAll(".plan-card");
    expect(cards.length).toBeGreaterThan(1);
    const free = container.querySelector(".plan-card:not(.plan-card--featured)");
    expect(free?.querySelector(".plan-card__name")?.textContent).toBe("免费");
    expect(free?.querySelector(".plan-card__price")).toBeNull();

    // and the paid card still shows a number, so this did not delete both
    expect(cards[0]?.querySelector(".plan-card__price")?.textContent ?? "").toMatch(/\d/u);
  });
});

describe("PlansScreen wallet line", () => {
  it("a current member sees membership and management, not a second upgrade request", async () => {
    const identity = createMemoryIdentityPort({ id: "member", email: "member@example.test" });
    const createOrder = vi.fn();
    const payment = createPaymentPort({
      identity,
      transport: { readEntitlement: async () => ({ planId: "member" }), createOrder },
    });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    expect(container.querySelector("[data-current-membership]")?.textContent).toContain(
      "你已是会员",
    );
    expect(container.querySelector(".plan-card--featured button")).toBeNull();
    expect(container.querySelector("[data-subscription-management]")).not.toBeNull();
    expect(container.textContent).not.toContain("你现在就在用");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("removes the prior account wallet immediately when the identity changes", async () => {
    const identity = createMemoryIdentityPort({ id: "alice", email: "alice@example.com" });
    const payment = createPaymentPort({
      identity,
      transport: {
        readBalance: async () => ({
          availablePowerUnits: "300",
          balancePowerUnits: "300",
          reservedPowerUnits: "0",
        }),
      },
    });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    expect(container.textContent).toContain("你的钱包还够 3 次");
    await act(async () => identity.signOut());
    expect(container.textContent).not.toContain("你的钱包还够 3 次");
    expect(container.querySelector(".payment-summary")?.textContent ?? "").not.toContain("钱包");
  });

  it("retains the non-sensitive monthly choice when the page is reopened", async () => {
    const payment = createPaymentPort({ identity: createMemoryIdentityPort(), transport: null });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    const monthly = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "按月",
    );
    if (!monthly) throw new Error("missing monthly choice");
    await act(async () => monthly.click());
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    expect(container.querySelector(".plan-card--featured")?.textContent).toContain("$19.00");
    expect(container.querySelector(".plan-card--featured")?.textContent).not.toContain("$149.00");
  });

  it("does not tell a stranger that a wallet will be read after login", async () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort(),
      transport: null,
    });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("登录后读取");
    expect(container.textContent).not.toContain("钱包余额");
    expect(container.querySelector(".payment-summary")?.textContent ?? "").not.toContain("钱包");
  });

  it("prints a wallet only when the port returned a number", async () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: {
        readBalance: async () => ({
          availablePowerUnits: "300",
          balancePowerUnits: "300",
          reservedPowerUnits: "0",
        }),
      },
    });
    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("你的钱包还够 3 次");
    });
    expect(container.textContent).not.toContain("登录后读取");
  });
});
