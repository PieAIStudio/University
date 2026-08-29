import { describe, expect, it, vi } from "vitest";

import type { ChatCompletionRequest, ChatCompletionTransport } from "@pieai/swimmer-ai-kit/chat";
import {
  createStructuredGrader,
  createSupabaseFreeGradingQuota,
  handleGradeRequest,
  readProductionSupabaseConfig,
  type GradeDependencies,
  type FreeGradingQuota,
  type GradingWallet,
} from "./service.js";

describe("University server backend environment", () => {
  it("requires canonical SwimmerBackend names", () => {
    expect(
      readProductionSupabaseConfig(
        (name) =>
          ({
            SWIMMER_BACKEND_SUPABASE_URL: "https://backend.example.supabase.co",
            SWIMMER_CORE_SUPABASE_URL: "https://legacy.example.supabase.co",
            SWIMMER_BACKEND_PUBLISHABLE_KEY: "sb_publishable_backend",
            SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_legacy",
          })[name],
      ),
    ).toEqual({
      supabaseUrl: "https://backend.example.supabase.co",
      publishableKey: "sb_publishable_backend",
    });

    expect(() =>
      readProductionSupabaseConfig(
        (name) =>
          ({
            SWIMMER_CORE_SUPABASE_URL: "https://legacy.example.supabase.co",
            SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_legacy",
          })[name],
      ),
    ).toThrow("Missing server environment variable: SWIMMER_BACKEND_SUPABASE_URL");
  });
});

describe("University free quota Supabase adapter", () => {
  it("calls the product RPCs through the exposed university schema", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const rows: Record<string, Record<string, unknown>> = {
      university_free_grading_quota_quote: {
        remaining_power_units: "400",
        resets_at: "2026-08-31T00:00:00.000Z",
      },
      university_free_grading_quota_reserve: {
        allowed: true,
        remaining_power_units: "300",
        resets_at: "2026-08-31T00:00:00.000Z",
        amount_power_units: "100",
        idempotent: false,
        insufficient: false,
        reservation_id: "22222222-2222-4222-8222-222222222222",
        status: "reserved",
      },
      university_free_grading_quota_commit: {
        allowed: true,
        remaining_power_units: "300",
        resets_at: "2026-08-31T00:00:00.000Z",
        amount_power_units: "100",
        idempotent: false,
        reservation_id: "22222222-2222-4222-8222-222222222222",
        status: "committed",
      },
      university_free_grading_quota_refund: {
        allowed: true,
        remaining_power_units: "400",
        resets_at: "2026-08-31T00:00:00.000Z",
        amount_power_units: "100",
        idempotent: false,
        reservation_id: "22222222-2222-4222-8222-222222222222",
        status: "refunded",
      },
    };
    const rpc = vi.fn(async (functionName: string, args: Record<string, unknown>) => {
      calls.push([functionName, args]);
      return { data: [rows[functionName]], error: null };
    });
    const schema = vi.fn(() => ({ rpc }));
    const quota = createSupabaseFreeGradingQuota({ schema } as never);

    await expect(
      quota.quote({
        userId: USER_ID,
        day: "2026-08-30",
      }),
    ).resolves.toMatchObject({ remainingPowerUnits: "400" });
    await expect(
      quota.reserve({
        userId: USER_ID,
        day: "2026-08-30",
        amountPowerUnits: "100",
        idempotencyKey: COMMAND_ID,
        metadata: { test: true },
      }),
    ).resolves.toMatchObject({ reservationId: RESERVATION_ID });
    await expect(
      quota.commit({
        reservationId: RESERVATION_ID,
        idempotencyKey: COMMAND_ID,
        metadata: { test: true },
      }),
    ).resolves.toMatchObject({ status: "committed" });
    await expect(
      quota.refund({
        reservationId: RESERVATION_ID,
        idempotencyKey: COMMAND_ID,
        metadata: { test: true },
      }),
    ).resolves.toMatchObject({ status: "refunded" });

    expect(schema).toHaveBeenCalledTimes(4);
    expect(schema).toHaveBeenNthCalledWith(1, "university");
    expect(schema).toHaveBeenNthCalledWith(2, "university");
    expect(schema).toHaveBeenNthCalledWith(3, "university");
    expect(schema).toHaveBeenNthCalledWith(4, "university");
    expect(calls.map(([functionName]) => functionName)).toEqual([
      "university_free_grading_quota_quote",
      "university_free_grading_quota_reserve",
      "university_free_grading_quota_commit",
      "university_free_grading_quota_refund",
    ]);
    expect(calls[0][1]).not.toHaveProperty("p_quota_power_units");
    expect(calls[1][1]).not.toHaveProperty("p_quota_power_units");
  });
});

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RESERVATION_ID = "22222222-2222-4222-8222-222222222222";
const FREE_RESERVATION_ID = "33333333-3333-4333-8333-333333333333";
const REFUND_ENTRY_ID = "44444444-4444-4444-8444-444444444444";
const COMMAND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ANONYMOUS_COMMAND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINKED_COMMAND_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

function requestFor(
  token?: string,
  funding: "free" | "wallet" = "wallet",
  commandId = COMMAND_ID,
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://grading.example.test/api/grade", {
    method: "POST",
    headers,
    body: JSON.stringify({
      answer: "我的解释",
      commandId,
      contentRevision: 1,
      exerciseId: "explain",
      prompt: "为什么？",
      funding,
    }),
  });
}

function offerRequestFor(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://grading.example.test/api/grade", {
    method: "GET",
    headers,
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
  const getBalance = vi.fn(async () => ({
    availablePowerUnits: "1000",
    balancePowerUnits: "1000",
    reservedPowerUnits: "0",
  }));
  const wallet: GradingWallet = { getBalance, reserve, commit, refund: refundCall };
  const authenticate = vi.fn(async (token: string) =>
    token === "valid-token" ? { userId: USER_ID, isAnonymous: false } : null,
  );
  const createWallet = vi.fn(() => wallet);
  const deps: GradeDependencies = {
    authenticate,
    createWallet,
    grade: model.grade,
    now: () => "2026-08-26T00:00:00.000Z",
  };

  return {
    authenticate,
    complete,
    createWallet,
    deps,
    events,
    getBalance,
    refundCall,
    reserve,
    commit,
  };
}

function freeQuotaFixture(events: string[], initialRemaining = "400") {
  const state = { remainingPowerUnits: initialRemaining };
  const resetsAt = "2026-08-27T00:00:00.000Z";
  const quote = vi.fn<FreeGradingQuota["quote"]>(async () => ({
    remainingPowerUnits: state.remainingPowerUnits,
    resetsAt,
  }));
  const reserve = vi.fn<FreeGradingQuota["reserve"]>(async (input) => {
    events.push("free-reserve");
    if (BigInt(state.remainingPowerUnits) < BigInt(input.amountPowerUnits)) {
      return {
        allowed: false,
        amountPowerUnits: input.amountPowerUnits,
        remainingPowerUnits: state.remainingPowerUnits,
        resetsAt,
        idempotent: false,
        insufficient: true,
        reservationId: null,
        status: "insufficient",
      };
    }
    state.remainingPowerUnits = String(
      BigInt(state.remainingPowerUnits) - BigInt(input.amountPowerUnits),
    );
    return {
      allowed: true,
      amountPowerUnits: input.amountPowerUnits,
      remainingPowerUnits: state.remainingPowerUnits,
      resetsAt,
      idempotent: false,
      insufficient: false,
      reservationId: FREE_RESERVATION_ID,
      status: "reserved",
    };
  });
  const commit = vi.fn<FreeGradingQuota["commit"]>(async () => {
    events.push("free-commit");
    return {
      allowed: true,
      amountPowerUnits: "100",
      remainingPowerUnits: state.remainingPowerUnits,
      resetsAt,
      reservationId: FREE_RESERVATION_ID,
      status: "committed",
    };
  });
  const refund = vi.fn<FreeGradingQuota["refund"]>(async () => {
    events.push("free-refund");
    state.remainingPowerUnits = String(BigInt(state.remainingPowerUnits) + 100n);
    return {
      allowed: true,
      amountPowerUnits: "100",
      remainingPowerUnits: state.remainingPowerUnits,
      resetsAt,
      reservationId: FREE_RESERVATION_ID,
      status: "refunded",
    };
  });
  const quota: FreeGradingQuota = { quote, reserve, commit, refund };
  return {
    commit,
    get remainingPowerUnits() {
      return state.remainingPowerUnits;
    },
    quota,
    quote,
    reserve,
  };
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
    expect(body.error).toMatch(/次数已退回/);
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
    expect(body.error).toBe(
      "AI 批改余额不足：你的钱包还不够一次了，这次需要 1 次。请先充值后再试。",
    );
    expect(complete).not.toHaveBeenCalled();
    expect(events).toEqual(["reserve"]);
  });

  it("quotes the daily free allowance without reading or reserving the wallet", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;

    const response = await handleGradeRequest(offerRequestFor("valid-token"), fixtureState.deps);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      kind: "free",
      costPowerUnits: "100",
      remainingPowerUnits: "400",
      resetsAt: "2026-08-27T00:00:00.000Z",
    });
    expect(fixtureState.createWallet).not.toHaveBeenCalled();
    expect(fixtureState.getBalance).not.toHaveBeenCalled();
    expect(fixtureState.events).toEqual([]);
    expect(quotaState.quote).toHaveBeenCalledWith({
      userId: USER_ID,
      day: "2026-08-26",
    });
  });

  it("returns a capability explanation for anonymous free grading without reading quota", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;
    fixtureState.authenticate.mockResolvedValue({ userId: USER_ID, isAnonymous: true });

    const response = await handleGradeRequest(
      requestFor("valid-token", "free", ANONYMOUS_COMMAND_ID),
      fixtureState.deps,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      kind: "unavailable",
      availablePowerUnits: null,
      explanation: {
        kind: "explanation",
        title: "今天的免费 AI 批改要先绑定邮箱",
        whatItDoes: "AI 会读懂你用中文写的答案，告诉你哪一步想岔了。",
        whyUnavailable:
          "它每次都要真的花钱，而现在这个身份只存在这台浏览器里——换个浏览器或者清一次数据就找不回来了。",
        futureSupport: "在个人档案绑定邮箱就能用；这台设备上已经学的进度会跟着你走。",
        action: { label: "去绑定邮箱", href: "/me" },
      },
    });
    expect(quotaState.quote).not.toHaveBeenCalled();
    expect(quotaState.reserve).not.toHaveBeenCalled();
    expect(fixtureState.complete).not.toHaveBeenCalled();
  });

  it("returns the same unavailable explanation for an anonymous offer without quoting", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;
    fixtureState.authenticate.mockResolvedValue({ userId: USER_ID, isAnonymous: true });

    const response = await handleGradeRequest(offerRequestFor("valid-token"), fixtureState.deps);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      kind: "unavailable",
      availablePowerUnits: null,
      explanation: {
        title: "今天的免费 AI 批改要先绑定邮箱",
        action: { href: "/me" },
      },
    });
    expect(quotaState.quote).not.toHaveBeenCalled();
    expect(quotaState.reserve).not.toHaveBeenCalled();
    expect(fixtureState.createWallet).not.toHaveBeenCalled();
  });

  it("allows the same user to use the daily free allowance immediately after email binding", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;
    fixtureState.authenticate
      .mockResolvedValueOnce({ userId: USER_ID, isAnonymous: true })
      .mockResolvedValueOnce({ userId: USER_ID, isAnonymous: false });

    const anonymousResponse = await handleGradeRequest(
      requestFor("valid-token", "free", ANONYMOUS_COMMAND_ID),
      fixtureState.deps,
    );
    expect(anonymousResponse.status).toBe(200);
    expect(quotaState.reserve).not.toHaveBeenCalled();

    const linkedResponse = await handleGradeRequest(
      requestFor("valid-token", "free", LINKED_COMMAND_ID),
      fixtureState.deps,
    );
    const linkedBody = (await linkedResponse.json()) as Record<string, unknown>;

    expect(linkedResponse.status).toBe(200);
    expect(linkedBody).toMatchObject({
      funding: "free",
      freeQuota: { remainingPowerUnits: "300" },
    });
    expect(quotaState.reserve).toHaveBeenCalledTimes(1);
    expect(quotaState.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, idempotencyKey: LINKED_COMMAND_ID }),
    );
    expect(fixtureState.events).toEqual(["free-reserve", "model", "free-commit"]);
  });

  it("uses the daily free allowance before the wallet for a structured grade", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;

    const response = await handleGradeRequest(requestFor("valid-token", "free"), fixtureState.deps);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      funding: "free",
      freeQuota: {
        remainingPowerUnits: "300",
        resetsAt: "2026-08-27T00:00:00.000Z",
      },
    });
    expect(fixtureState.events).toEqual(["free-reserve", "model", "free-commit"]);
    expect(fixtureState.reserve).not.toHaveBeenCalled();
    expect(fixtureState.getBalance).not.toHaveBeenCalled();
  });

  it("moves the offer to the wallet after four free grades are actually committed", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events);
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;
    const commandIds = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ];

    for (const commandId of commandIds) {
      const response = await handleGradeRequest(
        requestFor("valid-token", "free", commandId),
        fixtureState.deps,
      );
      expect(response.status).toBe(200);
    }

    const offer = await handleGradeRequest(offerRequestFor("valid-token"), fixtureState.deps);
    const body = (await offer.json()) as Record<string, unknown>;

    expect(offer.status).toBe(200);
    expect(body).toMatchObject({
      kind: "available",
      availablePowerUnits: "1000",
      freeQuotaExhausted: true,
      freeQuotaResetsAt: "2026-08-27T00:00:00.000Z",
    });
    expect(fixtureState.getBalance).toHaveBeenCalledTimes(1);
    expect(fixtureState.reserve).toHaveBeenCalledTimes(0);
    expect(quotaState.remainingPowerUnits).toBe("0");
  });

  it("returns an honest exhaustion signal without calling the model or wallet", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events, "0");
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;

    const response = await handleGradeRequest(requestFor("valid-token", "free"), fixtureState.deps);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      code: "free_quota_exhausted",
      error: "今天的免费 AI 批改用完了，明天恢复。",
      remainingPowerUnits: "0",
      resetsAt: "2026-08-27T00:00:00.000Z",
    });
    expect(fixtureState.events).toEqual(["free-reserve"]);
    expect(fixtureState.complete).not.toHaveBeenCalled();
    expect(fixtureState.reserve).not.toHaveBeenCalled();
    expect(fixtureState.getBalance).not.toHaveBeenCalled();
  });

  it("says the free balance is not enough for one attempt when only a remainder is left", async () => {
    const fixtureState = fixture();
    const quotaState = freeQuotaFixture(fixtureState.events, "50");
    fixtureState.deps.createFreeGradingQuota = () => quotaState.quota;

    const response = await handleGradeRequest(requestFor("valid-token", "free"), fixtureState.deps);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      code: "free_quota_exhausted",
      error: "今天剩余的免费 AI 批改次数还不够一次了，明天恢复。",
      remainingPowerUnits: "50",
    });
    expect(fixtureState.complete).not.toHaveBeenCalled();
  });
});
