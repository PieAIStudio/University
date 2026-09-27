import { describe, expect, it, vi } from "vitest";

import { createConsoleGradingUsageLedger, type GradingUsageLedgerEntry } from "./usage-ledger.js";

describe("private grading usage ledger log adapter", () => {
  it("writes the safe entry as one structured JSON line", () => {
    const write = vi.fn<(line: string) => void>();
    const entry: GradingUsageLedgerEntry = {
      event: "university.grading.usage",
      schemaVersion: 1,
      commandId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: "11111111-1111-4111-8111-111111111111",
      planId: "member",
      funding: "wallet",
      reservationId: "22222222-2222-4222-8222-222222222222",
      provider: "openrouter",
      modelId: "google/gemini-2.5-flash",
      startedAt: "2026-08-31T00:00:00.000Z",
      completedAt: "2026-08-31T00:00:00.120Z",
      elapsedMs: 120,
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
      providerCost: "0.000023",
      usageKnown: true,
      costPowerUnits: "100",
      outcome: "success",
      settlementStatus: "committed",
    };

    createConsoleGradingUsageLedger(write).record(entry);

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(JSON.stringify(entry));
  });
});
