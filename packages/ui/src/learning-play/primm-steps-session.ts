import type { PrimmEvaluation, PrimmStepsActivity, PrimmWork } from "./primm-types.js";

/** What a learner has done in a version-3 lesson; saved as the answer draft. */
export interface StepsSession {
  readonly version: 3;
  /** 0 is the opening screen, 1..n the steps, n + 1 the ending. */
  readonly index: number;
  readonly done: readonly string[];
  readonly choices: Readonly<Record<string, string>>;
  readonly attached: Readonly<Record<string, boolean>>;
  /** Live results by request key: a request ID, `built:<step>` or `make`. */
  readonly runs: Readonly<Record<string, PrimmWork>>;
  readonly found: Readonly<Record<string, number>>;
  readonly matched: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly sorted: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly pointed: Readonly<Record<string, string>>;
  readonly built: Readonly<Record<string, readonly string[]>>;
  readonly makePrompt: string;
  readonly evaluation: PrimmEvaluation | null;
}

export function initialStepsSession(): StepsSession {
  return {
    version: 3,
    index: 0,
    done: [],
    choices: {},
    attached: {},
    runs: {},
    found: {},
    matched: {},
    sorted: {},
    pointed: {},
    built: {},
    makePrompt: "",
    evaluation: null,
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is Record<string, string> =>
  record(value) && Object.values(value).every((item) => typeof item === "string");

function isWork(value: unknown): value is PrimmWork {
  if (!record(value)) return false;
  const work = value as unknown as PrimmWork;
  return (
    typeof work.request?.prompt === "string" &&
    work.result?.prompt === work.request.prompt &&
    work.result?.kind === "live" &&
    typeof work.result.text === "string" &&
    !!work.result.text.trim() &&
    typeof work.result.requestId === "string" &&
    (work.finalWork === undefined || typeof work.finalWork === "string")
  );
}

/** Restore only what still fits this lesson; a saved position never skips work
 * that the saved record cannot show was done. */
export function restoreStepsSession(activity: PrimmStepsActivity, answer: string): StepsSession {
  const initial = initialStepsSession();
  let saved: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(answer);
    if (!record(parsed) || parsed.version !== 3) return initial;
    saved = parsed;
  } catch {
    return initial;
  }
  const ids = new Set(activity.steps.map((step) => step.id));
  const done = Array.isArray(saved.done)
    ? saved.done.filter((id): id is string => typeof id === "string" && ids.has(id))
    : [];
  // Resume at the first step not done, never beyond it.
  const firstOpen = activity.steps.findIndex((step) => !done.includes(step.id));
  const limit = firstOpen < 0 ? activity.steps.length + 1 : firstOpen + 1;
  const index =
    typeof saved.index === "number" && Number.isInteger(saved.index) && saved.index >= 0
      ? Math.min(saved.index, limit)
      : 0;
  const runs = record(saved.runs)
    ? Object.fromEntries(Object.entries(saved.runs).filter(([, work]) => isWork(work)))
    : {};
  const nested = (value: unknown) =>
    record(value)
      ? Object.fromEntries(
          Object.entries(value).filter(([key, item]) => ids.has(key) && strings(item)),
        )
      : {};
  const evaluation =
    record(saved.evaluation) &&
    ["pass", "fail", "undecided"].includes(saved.evaluation.outcome as string) &&
    typeof saved.evaluation.explanation === "string"
      ? (saved.evaluation as unknown as PrimmEvaluation)
      : null;
  return {
    version: 3,
    index,
    done,
    choices: strings(saved.choices) ? saved.choices : {},
    attached: record(saved.attached)
      ? (Object.fromEntries(
          Object.entries(saved.attached).filter(([, value]) => value === true),
        ) as Record<string, boolean>)
      : {},
    runs: runs as Record<string, PrimmWork>,
    found: record(saved.found)
      ? (Object.fromEntries(
          Object.entries(saved.found).filter(([, value]) => Number.isInteger(value)),
        ) as Record<string, number>)
      : {},
    matched: nested(saved.matched) as StepsSession["matched"],
    sorted: nested(saved.sorted) as StepsSession["sorted"],
    pointed: strings(saved.pointed) ? saved.pointed : {},
    built: record(saved.built)
      ? (Object.fromEntries(
          Object.entries(saved.built).filter(
            ([key, value]) =>
              ids.has(key) && Array.isArray(value) && value.every((id) => typeof id === "string"),
          ),
        ) as Record<string, string[]>)
      : {},
    makePrompt: typeof saved.makePrompt === "string" ? saved.makePrompt : "",
    evaluation: runs.make ? evaluation : null,
  };
}
