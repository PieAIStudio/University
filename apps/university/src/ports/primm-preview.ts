import {
  PrimmExecutionError,
  type ExerciseAttemptResult,
  type GradingPort,
  type PrimmExecutionResult,
  type ProgressPort,
} from "@pieai/university-core";

export function makeAnswerEnvelope(answer: string): boolean {
  try {
    return JSON.parse(answer)?.kind === "primm-make";
  } catch {
    return false;
  }
}

/** Opt-in local prototype execution, composed above the existing AI-source
 * distinction. Neither production bundle enables it nor does it grant credits. */
export function withPrimmPreview(
  base: GradingPort,
  options: {
    url: string;
    progress: ProgressPort;
    fetchImpl?: typeof fetch;
  },
): GradingPort {
  const url = new URL(options.url);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !/^\d+$/.test(url.port) ||
    Number(url.port) < 1024 ||
    Number(url.port) > 65535 ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid local PRIMM endpoint");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetchImpl(new URL(path, url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-University-Primm": "owner-preview-v1" },
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
    });
    const data = await response.json();
    if (!response.ok) {
      const code = ["busy", "timeout", "cancelled"].includes(data?.code)
        ? data.code
        : data?.code === "stale" || data?.code === "rejected"
          ? "rejected"
          : "unavailable";
      throw new PrimmExecutionError(code);
    }
    return data as T;
  }
  const scope = () => options.progress.syncState().userId;
  return {
    ...base,
    async executePrimm(input, signal) {
      const owner = scope();
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      let result: PrimmExecutionResult;
      try {
        result = await post<PrimmExecutionResult>("/run", input, controller.signal);
      } finally {
        signal?.removeEventListener("abort", abort);
      }
      if (scope() !== owner || signal?.aborted) throw new PrimmExecutionError("cancelled");
      if (
        result.kind !== "live" ||
        result.prompt !== input.prompt ||
        typeof result.text !== "string" ||
        typeof result.requestId !== "string"
      )
        throw new PrimmExecutionError("rejected");
      return result;
    },
    async submitExercise(input) {
      if (!makeAnswerEnvelope(input.answer)) return base.submitExercise(input);
      const owner = scope();
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (input.signal?.aborted) abort();
      input.signal?.addEventListener("abort", abort, { once: true });
      let result: ExerciseAttemptResult;
      try {
        result = await post<ExerciseAttemptResult>(
          "/grade",
          {
            locator: input.locator,
            contentRevision: input.contentRevision,
            exerciseId: input.exerciseId,
            commandId: input.commandId,
            answer: input.answer,
          },
          controller.signal,
        );
      } finally {
        input.signal?.removeEventListener("abort", abort);
      }
      if (scope() !== owner || input.signal?.aborted) throw new PrimmExecutionError("cancelled");
      if (
        !result.hostGrade ||
        result.hostGrade.learnerAnswer !== input.answer ||
        !["pass", "fail", "undecided"].includes(result.hostGrade.outcome ?? "")
      )
        throw new PrimmExecutionError("rejected");
      options.progress.recordExerciseAttempt({
        commandId: input.commandId,
        locator: input.locator,
        exerciseId: input.exerciseId,
        contentRevision: input.contentRevision,
        answer: input.answer,
        score: result.score,
        maxScore: result.maxScore,
        hostGrade: result.hostGrade,
        occurredAt: result.hostGrade.occurredAt,
      });
      return { ...result, answerStored: options.progress.localSaveState?.() === "saved" };
    },
  };
}
