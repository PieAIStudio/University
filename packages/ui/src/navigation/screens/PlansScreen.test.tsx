// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryIdentityPort, createPaymentPort } from "@pieai/university-core";

import { PlansScreen } from "./PlansScreen.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
      (button) => button.textContent === "记录购买意向",
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.textContent).toContain("支付入口尚未开放");
    expect(dialog?.textContent).toContain("不会扣款、不会创建订单");
    expect(dialog?.querySelector('a[href="#/"]')?.textContent).toContain("继续学习");
  });

  it("uses payment language only when the adapter reports a live order channel", async () => {
    const createOrder = vi.fn(
      async (input: {
        readonly orderId: string;
        readonly offerId: string;
        readonly userId: string;
      }) => ({
        orderId: input.orderId,
        offerId: input.offerId,
        status: "pending" as const,
        checkoutUrl: null,
      }),
    );
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "user-1", email: "learner@example.com" }),
      transport: { createOrder },
      orderIdFactory: () => "00000000-0000-4000-8000-000000000099",
    });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "购买",
    );
    if (!cta) throw new Error("missing live purchase CTA");

    await act(async () => {
      cta.click();
    });

    expect(createOrder).toHaveBeenCalledWith({
      userId: "user-1",
      orderId: "00000000-0000-4000-8000-000000000099",
      offerId: "member",
    });
  });
});

describe("PlansScreen pricing claims", () => {
  it("derives the yearly saving from the configured prices", async () => {
    const identity = createMemoryIdentityPort();
    await identity.signInAnonymously();
    const payment = createPaymentPort({ identity, transport: null });

    await act(async () => root.render(<PlansScreen paymentPort={payment} />));

    const saving = container.querySelector(".plan-card__saving")?.textContent ?? "";
    // Twelve months at the configured monthly price against the configured
    // yearly price. If someone changes a price and this test still passes with
    // the old number, the claim on the page has become a lie.
    expect(saving).toContain("$79.00");
    expect(saving).toContain("35%");
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
    const free = cards[0];
    expect(free?.querySelector(".plan-card__name")?.textContent).toBe("免费");
    expect(free?.querySelector(".plan-card__price")).toBeNull();

    // and the paid card still shows a number, so this did not delete both
    expect(cards[1]?.querySelector(".plan-card__price")?.textContent ?? "").toMatch(/\d/u);
  });
});

describe("PlansScreen wallet line", () => {
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
