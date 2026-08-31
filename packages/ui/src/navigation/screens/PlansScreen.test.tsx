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
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("购买"),
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.textContent).toContain("购买前先绑定邮箱");
    expect(dialog?.textContent).toContain("换设备和退款");
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
    const cta = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("购买"),
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.textContent).toContain("购买入口还没接好");
    expect(dialog?.textContent).toContain("浏览器不会直接连接支付服务");
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
    const payment = createPaymentPort({
      identity,
      transport: {
        readBalance: async () => ({
          availablePowerUnits: "0",
          balancePowerUnits: "0",
          reservedPowerUnits: "0",
        }),
        createOrder: vi.fn(),
      },
    });
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
