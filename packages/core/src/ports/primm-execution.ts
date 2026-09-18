import type { LessonRef } from "../progress/contract.js";

export type PrimmExecutionPhase = "run" | "modify" | "make";

/** Structural cancellation seam: core stays independent of browser/Node globals. */
export interface PrimmAbortSignal {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** The host resolves approved inputs by lesson + revision + phase. No file/URL input. */
export interface PrimmExecutionRequest {
  readonly lessonRef: LessonRef;
  readonly contentRevision: number;
  readonly phase: PrimmExecutionPhase;
  readonly prompt: string;
  readonly commandId: string;
  readonly locale: string;
}

/** Plain-text output, never executable markup or a verdict about independent work. */
export interface PrimmExecutionResult {
  readonly kind: "live" | "replay";
  readonly text: string;
  readonly requestId: string;
  readonly model: string;
  readonly createdAt: string;
  readonly sourceIds: readonly string[];
  /** Exact input echo: changing the prompt invalidates the displayed execution. */
  readonly prompt: string;
}

export type PrimmExecutionErrorCode = "unavailable" | "timeout" | "rejected" | "cancelled" | "busy";

/** Safe transport failure. Provider messages, traces and credentials are not public fields. */
export interface PrimmExecutionFailure {
  readonly kind: "error";
  readonly code: PrimmExecutionErrorCode;
}

/** The caller localizes the fixed code; no provider error can be supplied as its message. */
export class PrimmExecutionError extends Error {
  constructor(readonly code: PrimmExecutionErrorCode) {
    super(`PRIMM execution: ${code}`);
    this.name = "PrimmExecutionError";
  }
}
