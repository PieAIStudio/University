import { describe, expect, it, vi } from "vitest";
import { createMemoryIdentityPort } from "./identity.js";
import { createPaymentPort } from "./payment.js";

describe("a management method is not a management service", () => {
  it("keeps a read-only account adapter unavailable", () => {
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "a", email: "a@example.test" }),
      transport: { readEntitlement: async () => ({ planId: "member" }) },
    });
    expect(typeof payment.manageSubscription).toBe("function");
    expect(payment.managementAvailability?.()).toBe("unavailable");
  });
  it("can manage an existing subscription while new sales are closed", async () => {
    const open = vi.fn(async () => "https://payments.example.test/account");
    const payment = createPaymentPort({
      identity: createMemoryIdentityPort({ id: "a", email: "a@example.test" }),
      transport: { createSubscriptionPortal: open },
    });
    expect(payment.purchaseAvailability()).toBe("unavailable");
    expect(payment.managementAvailability?.()).toBe("available");
    await expect(payment.manageSubscription?.()).resolves.toEqual({
      kind: "value",
      value: { url: "https://payments.example.test/account" },
    });
    expect(open).toHaveBeenCalledExactlyOnceWith("a");
  });
  it("requires a registered account before asking for a portal", async () => {
    const identity = createMemoryIdentityPort();
    const open = vi.fn(async () => "https://payments.example.test/account");
    const payment = createPaymentPort({ identity, transport: { createSubscriptionPortal: open } });
    expect(payment.managementAvailability?.()).toBe("account-required");
    await identity.signInAnonymously();
    expect(payment.managementAvailability?.()).toBe("anonymous");
    await expect(payment.manageSubscription?.()).resolves.toMatchObject({ kind: "explanation" });
    expect(open).not.toHaveBeenCalled();
  });
  it("rejects a portal response that arrives after the account leaves", async () => {
    const identity = createMemoryIdentityPort({ id: "a", email: "a@example.test" });
    let resolve!: (url: string) => void;
    const payment = createPaymentPort({
      identity,
      transport: {
        createSubscriptionPortal: () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      },
    });
    const pending = payment.manageSubscription!();
    await identity.signOut();
    resolve("https://payments.example.test/account");
    await expect(pending).resolves.toMatchObject({ kind: "explanation" });
    expect(payment.managementAvailability?.()).toBe("account-required");
  });
});
