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
      button.textContent?.includes("查看购买入口"),
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
      button.textContent?.includes("查看购买入口"),
    );
    if (!cta) throw new Error("missing purchase CTA");
    expect(cta.disabled).toBe(false);

    await act(async () => {
      cta.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.textContent).toContain("购买入口还没接好");
    expect(dialog?.textContent).toContain("浏览器不会直连支付 SDK");
  });
});
