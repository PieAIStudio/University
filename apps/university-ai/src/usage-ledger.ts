/**
 * Private, provider-neutral accounting evidence for one structured grading
 * attempt. This is deliberately narrower than a model request or response:
 * prompt, answer, lesson content, context, and raw provider payloads have no
 * field in this contract.
 */

export type GradingUsageLedgerOutcome =
  | "success"
  | "unknown_usage"
  | "provider_failure"
  | "settlement_failure";

export type GradingUsageLedgerSettlementStatus = "committed" | "refunded" | "failed";

export interface GradingUsageLedgerEntry {
  readonly event: "university.grading.usage";
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly userId: string;
  readonly planId: string;
  readonly funding: "free" | "wallet";
  readonly reservationId: string;
  readonly provider: string;
  readonly modelId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly providerCost: number | string | null;
  readonly usageKnown: boolean;
  /** Product accounting cost for the attempted structured grade. */
  readonly costPowerUnits: string;
  readonly outcome: GradingUsageLedgerOutcome;
  readonly settlementStatus: GradingUsageLedgerSettlementStatus;
}

/**
 * Port for private grading usage evidence. The implementation is deliberately
 * optional at the service boundary so tests and local callers can omit it;
 * production wires the structured-log adapter below.
 */
export interface GradingUsageLedger {
  record(entry: GradingUsageLedgerEntry): Promise<void> | void;
}

/**
 * Vercel's server logs are the first storage adapter. Replacing this factory
 * with a backend-table adapter is the only production wiring change needed
 * when a durable private ledger becomes available.
 */
export function createConsoleGradingUsageLedger(
  write: (line: string) => void = (line) => console.info(line),
): GradingUsageLedger {
  return {
    record(entry) {
      write(JSON.stringify(entry));
    },
  };
}
