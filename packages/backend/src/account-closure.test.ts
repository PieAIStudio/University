import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_CLOSURE_CONFIRMATION, createAccountClosurePort } from "./account-closure.js";

const userId = "44cf3a10-3c34-4b1c-8767-b1877ec93858";
const operationId = "c44871c7-9602-4787-9dbe-74e48aab9bc3";
function fixture(data: unknown, error: unknown = null) {
  const reply = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockImplementation(() => ({ abortSignal: reply }));
  const schema = vi.fn().mockReturnValue({ rpc });
  const port = createAccountClosurePort({ schema } as unknown as SupabaseClient);
  return { port, schema, rpc, reply };
}

describe("authenticated account closure transport", () => {
  it("binds the expected identity as a precondition and distinguishes review from deletion", async () => {
    for (const status of ["review-required"] as const) {
      const { port, schema, rpc } = fixture({ status, operationId });
      await expect(
        port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
      ).resolves.toEqual({ status, operationId });
      expect(schema).toHaveBeenCalledWith("university");
      expect(rpc).toHaveBeenCalledExactlyOnceWith("request_account_deletion", {
        p_operation_id: operationId,
        p_expected_user_id: userId,
        p_confirmation: ACCOUNT_CLOSURE_CONFIRMATION,
      });
    }
  });

  it("never sends an unconfirmed or malformed destructive request", async () => {
    const { port, rpc } = fixture({ status: "review-required", operationId });
    await expect(port.request(userId, operationId, "DELETE")).rejects.toMatchObject({
      code: "confirmation-required",
    });
    await expect(
      port.request(userId, "not-an-id", ACCOUNT_CLOSURE_CONFIRMATION),
    ).rejects.toMatchObject({ code: "confirmation-required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a mismatched or ambiguous receipt rather than clearing local data", async () => {
    for (const data of [
      null,
      [],
      { status: "ok", operationId },
      { status: "review-required", operationId: "another-request" },
    ]) {
      const { port } = fixture(data);
      await expect(
        port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
      ).rejects.toMatchObject({ code: "unavailable" });
    }
  });

  it("requires new authentication only for an authoritative authentication failure", async () => {
    const { port } = fixture(null, { code: "PT401", message: "private account details" });
    await expect(
      port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
    ).rejects.toMatchObject({
      code: "reauthentication-required",
      message: "reauthentication-required",
    });
    const missing = fixture(null, { code: "PGRST202", message: "private schema details" });
    await expect(
      missing.port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
    ).rejects.toMatchObject({ code: "unavailable", message: "unavailable" });
  });

  it("never treats a lost reply as a successful deletion or leaks transport errors", async () => {
    const { port, rpc, reply } = fixture(null);
    reply.mockRejectedValueOnce(new Error("private credential-bearing request"));
    await expect(
      port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
    ).rejects.toMatchObject({ code: "unavailable", message: "unavailable" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("accepts the original valid request receipt on an idempotent retry", async () => {
    const original = "c89895d8-6681-4c09-97b2-b55d58bc7d7a";
    const { port } = fixture({ status: "review-required", operationId: original });
    await expect(port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION)).resolves.toEqual({
      status: "review-required",
      operationId: original,
    });
    const unsupported = fixture({ status: "deleted", operationId });
    await expect(
      unsupported.port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("bounds a lost network request and leaves its outcome unconfirmed", async () => {
    vi.useFakeTimers();
    try {
      const { port, reply } = fixture(null);
      reply.mockImplementation(
        (signal: AbortSignal) =>
          new Promise((_, reject) =>
            signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
          ),
      );
      const result = expect(
        port.request(userId, operationId, ACCOUNT_CLOSURE_CONFIRMATION),
      ).rejects.toMatchObject({ code: "unavailable" });
      await vi.advanceTimersByTimeAsync(15_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
