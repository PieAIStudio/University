import { describe, expect, it, vi } from "vitest";

import type { ChatCompletionRequest, ChatCompletionTransport } from "@pieai/swimmer-ai-kit/chat";
import {
  createStructuredGrader,
  handleGradeRequest,
  type GradeDependencies,
  type GradingWallet,
} from "./service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RESERVATION_ID = "22222222-2222-4222-8222-222222222222";
const REFUND_ENTRY_ID = "44444444-4444-4444-8444-444444444444";
const COMMAND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const reservation = {
  allowed: true,
  amountPowerUnits: "100",
  availablePowerUnits: "900",
  balancePowerUnits: "1000",
  reservedPowerUnits: "100",
  idempotent: false,
  insufficient: false,
  reservationId: RESERVATION_ID,
  status: "reserved" as const,
};

const settlement = {
  allowed: true,
  amountPowerUnits: "100",
  availablePowerUnits: "900",
  balancePowerUnits: "1000",
  reservedPowerUnits: "0",
  idempotent: false,
  reservationId: RESERVATION_ID,
  status: "committed" as const,
};

const refund = {
  allowed: true,
  amountPowerUnits: "100",
  availablePowerUnits: "1000",
  balancePowerUnits: "1000",
  reservedPowerUnits: "0",
  idempotent: false,
  refundEntryId: REFUND_ENTRY_ID,
  reservationId: RESERVATION_ID,
  status: "refunded" as const,
};

function requestFor(token?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://grading.example.test/api/grade", {
    method: "POST",
    headers,
    body: JSON.stringify({
      answer: "我的解释",
      commandId: COMMAND_ID,
      contentRevision: 1,
      exerciseId: "explain",
      prompt: "为什么？",
    }),
  });
}

function fixture() {
  const events: string[] = [];
  const complete = vi.fn(async (_request: ChatCompletionRequest) => {
    events.push("model");
    return {
      content: JSON.stringify({
        passed: true,
        evaluation: "你的解释抓住了关键关系。",
        extensions: [],
      }),
      raw: { provider: "fake" },
      usage: { inputTokens: 12, outputTokens: 8 },
    };
  });
  const transport: ChatCompletionTransport = { provider: "fake", complete };
  const model = createStructuredGrader(transport);

  const reserve = vi.fn(async (_input) => {
    events.push("reserve");
    return reservation;
  });
  const commit = vi.fn(async (_input) => {
    events.push("commit");
    return settlement;
  });
  const refundCall = vi.fn(async (_input) => {
    events.push("refund");
    return refund;
  });
  const wallet: GradingWallet = { reserve, commit, refund: refundCall };
  const authenticate = vi.fn(async (token: string) =>
    token === "valid-token" ? { userId: USER_ID, isAnonymous: false } : null,
  );
  const deps: GradeDependencies = {
    authenticate,
    createWallet: () => wallet,
    grade: model.grade,
    now: () => "2026-08-26T00:00:00.000Z",
  };

  return { authenticate, complete, deps, events, refundCall, reserve, commit };
}

describe("University metered grading service", () => {
  it("reserves before the fake transport and refunds when the model fails", async () => {
    const { complete, deps, events, refundCall, commit } = fixture();
    complete.mockImplementationOnce(async () => {
      events.push("model");
      throw new Error("fake provider failure");
    });

    const response = await handleGradeRequest(requestFor("valid-token"), deps);
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ code: "model_failed" });
    expect(body.error).toMatch(/额度已退回/);
    expect(events).toEqual(["reserve", "model", "refund"]);
    expect(refundCall).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not call the model or charge twice when commandId is replayed", async () => {
    const { complete, deps, events, reserve, commit, refundCall } = fixture();
    reserve.mockImplementationOnce(async () => {
      events.push("reserve");
      return reservation;
    });
    reserve.mockImplementationOnce(async () => {
      events.push("reserve");
      return {
        ...reservation,
        idempotent: true,
        reservationId: RESERVATION_ID,
        status: "committed",
      };
    });

    const first = await handleGradeRequest(requestFor("valid-token"), deps);
    const replay = await handleGradeRequest(requestFor("valid-token"), deps);
    const replayBody = (await replay.json()) as { code?: string; error?: string };

    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
    expect(replayBody).toMatchObject({ code: "idempotent_replay" });
    expect(replayBody.error).toMatch(/未再次扣费/);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(refundCall).not.toHaveBeenCalled();
    expect(events).toEqual(["reserve", "model", "commit", "reserve"]);
  });

  it("rejects missing and invalid JWTs before reserve or model", async () => {
    const missing = fixture();
    const missingResponse = await handleGradeRequest(requestFor(), missing.deps);
    const invalidResponse = await handleGradeRequest(requestFor("invalid-token"), missing.deps);

    expect(missingResponse.status).toBe(401);
    expect(invalidResponse.status).toBe(401);
    expect(missing.authenticate).toHaveBeenCalledTimes(1);
    expect(missing.complete).not.toHaveBeenCalled();
    expect(missing.reserve).not.toHaveBeenCalled();
  });

  it("does not call the model when the wallet says the balance is insufficient", async () => {
    const { deps, complete, reserve, events } = fixture();
    reserve.mockImplementationOnce(async () => {
      events.push("reserve");
      return {
        ...reservation,
        allowed: false,
        availablePowerUnits: "50",
        insufficient: true,
        reservationId: null,
        status: "insufficient",
      };
    });

    const response = await handleGradeRequest(requestFor("valid-token"), deps);
    const body = (await response.json()) as {
      availablePowerUnits?: string;
      code?: string;
      error?: string;
      requiredPowerUnits?: string;
    };

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      availablePowerUnits: "50",
      code: "insufficient_balance",
      requiredPowerUnits: "100",
    });
    expect(body.error).toMatch(/还剩 50.*需要 100/);
    expect(complete).not.toHaveBeenCalled();
    expect(events).toEqual(["reserve"]);
  });
});
