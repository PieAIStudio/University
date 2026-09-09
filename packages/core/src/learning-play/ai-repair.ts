import type { ActivityBase } from "./types.js";

export type RepairImplementation = "broken" | "scoped" | "rewrite" | "removed";
export type RepairRegressionContract =
  | "change-choice"
  | "keep-other-booking"
  | "persist-each-change";
export type RepairEvent =
  | { readonly type: "choose"; readonly value: string }
  | { readonly type: "submit" | "cancel" | "reload" };
export interface RepairActivity extends ActivityBase {
  readonly kind: "ai-repair";
  readonly model: "booking" | "preference";
  readonly product: string;
  readonly productBrief: string;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
  readonly capacity: number;
  readonly defect: string;
  readonly expected: string;
  readonly reproduceSteps: readonly string[];
  readonly regression: string;
  readonly regressionSteps: readonly string[];
  /** The first three choices are A (keep/original), B (first change), C (second change). */
  readonly regressionContract?: RepairRegressionContract;
  readonly offeredPatches?: readonly Exclude<RepairImplementation, "broken">[];
  readonly submitLabel: string;
  readonly patches: Readonly<
    Record<
      Exclude<RepairImplementation, "broken">,
      {
        readonly label: string;
        readonly claim?: string;
        readonly scope: string;
        readonly change: string;
      }
    >
  >;
}
export interface RepairProduct {
  readonly choice: string;
  readonly reservations: readonly string[];
  readonly savedChoice: string;
  readonly confirmed: boolean;
  readonly everSubmitted: boolean;
}
export type RepairEffect =
  | "selected"
  | "submitted"
  | "cancelled"
  | "reloaded"
  | "duplicate-blocked"
  | "capacity"
  | "action-removed"
  | "rewrite-blocked"
  | "invalid";
export interface RepairTraceEntry {
  readonly event: RepairEvent;
  readonly before: RepairProduct;
  readonly after: RepairProduct;
  readonly effect: RepairEffect;
}
export interface RepairTrace {
  readonly implementation: RepairImplementation;
  readonly events: readonly RepairEvent[];
  readonly entries: readonly RepairTraceEntry[];
  readonly product: RepairProduct;
}
export interface RepairEvidence {
  readonly events: readonly RepairEvent[];
  readonly actual: RepairTrace;
  readonly expected: RepairTrace;
}
export interface RepairCheckpoint extends RepairTrace {
  readonly id: number;
}
export interface RepairWorkspace extends RepairTrace {
  readonly checkpoints: readonly RepairCheckpoint[];
  readonly nextCheckpointId: number;
}
export interface RepairComparison {
  readonly baseline: RepairImplementation;
  readonly candidate: RepairImplementation;
  readonly events: readonly RepairEvent[];
  readonly origins: readonly ("replay" | "manual")[];
  readonly left: RepairTrace;
  readonly right: RepairTrace;
  readonly cursor: number;
  readonly mode: "replay" | "manual";
  readonly branch: number;
}

export function initialRepairProduct(activity: RepairActivity): RepairProduct {
  return {
    choice: activity.choices[0]?.id ?? "",
    reservations: [],
    savedChoice: activity.choices[0]?.id ?? "",
    confirmed: false,
    everSubmitted: false,
  };
}

/** Both the playable product and replay use these exact transitions. */
export function stepRepairProduct(
  activity: RepairActivity,
  implementation: RepairImplementation,
  product: RepairProduct,
  event: RepairEvent,
): RepairTraceEntry {
  let after = product;
  let effect: RepairEffect = "invalid";
  if (event.type === "choose" && activity.choices.some((choice) => choice.id === event.value)) {
    if (activity.model === "preference" && implementation === "rewrite" && product.everSubmitted) {
      effect = "rewrite-blocked";
    } else {
      after = { ...product, choice: event.value, confirmed: false };
      effect = "selected";
    }
  } else if (event.type === "submit") {
    if (implementation === "removed") effect = "action-removed";
    else if (activity.model === "booking") {
      if (implementation === "rewrite" && product.everSubmitted) effect = "rewrite-blocked";
      else if (implementation === "scoped" && product.reservations.includes(product.choice))
        effect = "duplicate-blocked";
      else if (product.reservations.length >= activity.capacity) effect = "capacity";
      else {
        after = {
          ...product,
          reservations: [...product.reservations, product.choice],
          confirmed: true,
          everSubmitted: true,
        };
        effect = "submitted";
      }
    } else {
      after = {
        ...product,
        savedChoice: implementation === "broken" ? product.savedChoice : product.choice,
        confirmed: true,
        everSubmitted: true,
      };
      effect = "submitted";
    }
  } else if (event.type === "cancel" && activity.model === "booking") {
    if (implementation === "rewrite") effect = "rewrite-blocked";
    else {
      after = {
        ...product,
        reservations: product.reservations.filter((choice) => choice !== product.choice),
        confirmed: false,
      };
      effect = "cancelled";
    }
  } else if (event.type === "reload" && activity.model === "preference") {
    after = { ...product, choice: product.savedChoice, confirmed: false };
    effect = "reloaded";
  }
  return { event: { ...event }, before: product, after, effect };
}

export function replayRepair(
  activity: RepairActivity,
  implementation: RepairImplementation,
  events: readonly RepairEvent[],
):
  | { readonly valid: true; readonly trace: RepairTrace }
  | { readonly valid: false; readonly reason: "invalid-activity" | "invalid-events" } {
  if (
    !["booking", "preference"].includes(activity.model) ||
    activity.choices.length < 2 ||
    new Set(activity.choices.map((choice) => choice.id)).size !== activity.choices.length ||
    !Number.isInteger(activity.capacity) ||
    activity.capacity < 2 ||
    activity.capacity > 12 ||
    !["broken", "scoped", "rewrite", "removed"].includes(implementation) ||
    !validRepairContract(activity) ||
    (implementation !== "broken" &&
      activity.offeredPatches !== undefined &&
      !activity.offeredPatches.includes(implementation))
  )
    return { valid: false, reason: "invalid-activity" };
  if (events.length > 40) return { valid: false, reason: "invalid-events" };
  let product = initialRepairProduct(activity);
  const entries: RepairTraceEntry[] = [];
  for (const event of events) {
    const entry = stepRepairProduct(activity, implementation, product, event);
    if (entry.effect === "invalid") return { valid: false, reason: "invalid-events" };
    entries.push(entry);
    product = entry.after;
  }
  return {
    valid: true,
    trace: { implementation, events: events.map((event) => ({ ...event })), entries, product },
  };
}

function validRepairContract(activity: RepairActivity): boolean {
  const contract = activity.regressionContract ?? "change-choice";
  const offered = activity.offeredPatches;
  return (
    ["change-choice", "keep-other-booking", "persist-each-change"].includes(contract) &&
    (contract === "change-choice" || activity.choices.length >= 3) &&
    (contract !== "keep-other-booking" || activity.model === "booking") &&
    (contract !== "persist-each-change" || activity.model === "preference") &&
    (offered === undefined ||
      (Array.isArray(offered) &&
        offered.length >= 2 &&
        offered.length <= 3 &&
        offered.includes("scoped") &&
        new Set(offered).size === offered.length &&
        offered.every((patch) => ["scoped", "rewrite", "removed"].includes(patch))))
  );
}

const observable = (activity: RepairActivity, product: RepairProduct): string =>
  JSON.stringify(
    activity.model === "booking"
      ? product.reservations
      : { choice: product.choice, savedChoice: product.savedChoice },
  );
const isAuthentic = (activity: RepairActivity, trace: RepairTrace): boolean => {
  const replay = replayRepair(activity, trace.implementation, trace.events);
  return (
    replay.valid &&
    JSON.stringify(replay.trace) ===
      JSON.stringify({
        implementation: trace.implementation,
        events: trace.events,
        entries: trace.entries,
        product: trace.product,
      })
  );
};

export function captureRepairEvidence(
  activity: RepairActivity,
  trace: RepairTrace,
): RepairEvidence | undefined {
  if (trace.implementation !== "broken" || !isAuthentic(activity, trace)) return undefined;
  const expected = replayRepair(activity, "scoped", trace.events);
  if (
    !expected.valid ||
    observable(activity, expected.trace.product) === observable(activity, trace.product)
  )
    return undefined;
  // Saving the preference is not enough: the learner must actually reopen it.
  if (activity.model === "preference" && trace.events.at(-1)?.type !== "reload") return undefined;
  return {
    events: trace.events.map((event) => ({ ...event })),
    actual: {
      implementation: trace.implementation,
      events: trace.events,
      entries: trace.entries,
      product: trace.product,
    },
    expected: expected.trace,
  };
}

export function checkRepairDefect(
  activity: RepairActivity,
  implementation: RepairImplementation,
  evidence: RepairEvidence,
): {
  readonly passed: boolean;
  readonly trace?: RepairTrace;
} {
  const verifiedEvidence = captureRepairEvidence(activity, evidence.actual);
  if (!verifiedEvidence || JSON.stringify(verifiedEvidence) !== JSON.stringify(evidence))
    return { passed: false };
  const replay = replayRepair(activity, implementation, evidence.events);
  if (!replay.valid) return { passed: false };
  return {
    passed:
      observable(activity, replay.trace.product) ===
      observable(activity, evidence.expected.product),
    trace: replay.trace,
  };
}

export function checkRepairRegression(
  activity: RepairActivity,
  trace: RepairTrace,
): "missing" | "failed" | "passed" {
  if (!isAuthentic(activity, trace)) return "failed";
  if (trace.entries.some((entry) => ["action-removed", "rewrite-blocked"].includes(entry.effect)))
    return "failed";
  const expected = replayRepair(activity, "scoped", trace.events);
  if (!expected.valid) return "failed";
  if (activity.regressionContract === "keep-other-booking")
    return checkOtherBooking(activity, trace, expected.trace);
  if (activity.regressionContract === "persist-each-change")
    return checkEachSavedChange(activity, trace, expected.trace);
  const submits = expected.trace.entries.filter((entry) => entry.event.type === "submit");
  const distinct = new Set(submits.map((entry) => entry.before.choice));
  if (activity.model === "booking") {
    const cancelIndex = trace.events.findIndex((event) => event.type === "cancel");
    if (
      distinct.size < 2 ||
      cancelIndex < 0 ||
      !trace.events.slice(0, cancelIndex).some((event) => event.type === "submit") ||
      !trace.events.slice(cancelIndex + 1).some((event) => event.type === "submit")
    )
      return "missing";
  } else if (distinct.size < 2 || trace.events.at(-1)?.type !== "reload") return "missing";
  if (activity.model === "booking") {
    const effectiveCancel = trace.entries.findIndex(
      (entry) =>
        entry.event.type === "cancel" &&
        entry.before.reservations.length > entry.after.reservations.length,
    );
    if (
      effectiveCancel < 0 ||
      trace.product.reservations.length !== 1 ||
      !trace.entries
        .slice(effectiveCancel + 1)
        .some(
          (entry) =>
            entry.event.type === "submit" &&
            entry.effect === "submitted" &&
            entry.before.choice !== trace.entries[effectiveCancel]!.before.choice,
        )
    )
      return "failed";
  }
  if (observable(activity, trace.product) !== observable(activity, expected.trace.product))
    return "failed";
  return "passed";
}

/** Cancelling B must never remove A, even if A is re-created later. */
function checkOtherBooking(
  activity: RepairActivity,
  trace: RepairTrace,
  expected: RepairTrace,
): "missing" | "failed" | "passed" {
  const [kept, cancelled, replacement] = activity.choices.map((choice) => choice.id);
  const firstKeep = trace.entries.findIndex(
    (entry) =>
      entry.event.type === "submit" && entry.before.choice === kept && entry.effect === "submitted",
  );
  if (firstKeep < 0) return "missing";
  if (
    trace.entries
      .slice(firstKeep)
      .some((entry) => entry.after.reservations.filter((choice) => choice === kept).length !== 1)
  )
    return "failed";
  const cancelIndex = trace.entries.findIndex(
    (entry, index) =>
      index > firstKeep &&
      entry.event.type === "cancel" &&
      entry.before.choice === cancelled &&
      entry.before.reservations.includes(kept!) &&
      entry.before.reservations.includes(cancelled!) &&
      !entry.after.reservations.includes(cancelled!),
  );
  if (cancelIndex < 0) return "missing";
  const replaced = trace.entries
    .slice(cancelIndex + 1)
    .some(
      (entry) =>
        entry.event.type === "submit" &&
        entry.before.choice === replacement &&
        entry.effect === "submitted",
    );
  if (!replaced) return "missing";
  return trace.product.reservations.length === 2 &&
    trace.product.reservations.includes(kept!) &&
    trace.product.reservations.includes(replacement!) &&
    !trace.product.reservations.includes(cancelled!) &&
    observable(activity, trace.product) === observable(activity, expected.product)
    ? "passed"
    : "failed";
}

/** Find an actual choose → save → reopen before another choice replaces that observation. */
function savedChangeReadAt(trace: RepairTrace, target: string, after: number): number | undefined {
  let changed = false;
  let saved = false;
  for (let index = after + 1; index < trace.entries.length; index++) {
    const entry = trace.entries[index]!;
    if (entry.event.type === "choose") {
      if (entry.after.choice !== target) {
        changed = false;
        saved = false;
      } else if (entry.before.choice !== target) changed = true;
    } else if (entry.event.type === "submit") {
      saved = changed && entry.before.choice === target;
    } else if (
      entry.event.type === "reload" &&
      saved &&
      entry.after.choice === target &&
      entry.after.savedChoice === target
    ) {
      return index;
    }
  }
  return undefined;
}

function checkEachSavedChange(
  activity: RepairActivity,
  trace: RepairTrace,
  expected: RepairTrace,
): "missing" | "failed" | "passed" {
  const firstChange = activity.choices[1]!.id;
  const secondChange = activity.choices[2]!.id;
  const firstRead = savedChangeReadAt(expected, firstChange, -1);
  if (firstRead === undefined) return "missing";
  const secondRead = savedChangeReadAt(expected, secondChange, firstRead);
  if (secondRead === undefined) return "missing";
  const readsMatch = ([firstRead, secondRead] as const).every(
    (index) =>
      trace.entries[index]!.after.choice === expected.entries[index]!.after.choice &&
      trace.entries[index]!.after.savedChoice === expected.entries[index]!.after.savedChoice,
  );
  return readsMatch &&
    trace.events.at(-1)?.type === "reload" &&
    trace.product.choice === secondChange &&
    trace.product.savedChoice === secondChange &&
    observable(activity, trace.product) === observable(activity, expected.product)
    ? "passed"
    : "failed";
}

export function createRepairWorkspace(activity: RepairActivity): RepairWorkspace {
  return {
    implementation: "broken",
    product: initialRepairProduct(activity),
    events: [],
    entries: [],
    checkpoints: [],
    nextCheckpointId: 1,
  };
}
export function operateRepairWorkspace(
  activity: RepairActivity,
  workspace: RepairWorkspace,
  event: RepairEvent,
): RepairWorkspace {
  if (workspace.events.length >= 40) return workspace;
  const entry = stepRepairProduct(activity, workspace.implementation, workspace.product, event);
  if (entry.effect === "invalid") return workspace;
  return {
    ...workspace,
    product: entry.after,
    events: [...workspace.events, { ...event }],
    entries: [...workspace.entries, entry],
  };
}
export function resetRepairWorkspace(
  activity: RepairActivity,
  workspace: RepairWorkspace,
): RepairWorkspace {
  return { ...workspace, product: initialRepairProduct(activity), events: [], entries: [] };
}
function appendCheckpoint(
  checkpoints: readonly RepairCheckpoint[],
  checkpoint: RepairCheckpoint,
): readonly RepairCheckpoint[] {
  const next = [...checkpoints, checkpoint];
  return next.length <= 8 ? next : [next[0]!, ...next.slice(-7)];
}
export function branchRepairWorkspace(
  activity: RepairActivity,
  workspace: RepairWorkspace,
  implementation: Exclude<RepairImplementation, "broken">,
): RepairWorkspace {
  const checkpoint: RepairCheckpoint = {
    id: workspace.nextCheckpointId,
    implementation: workspace.implementation,
    product: workspace.product,
    events: workspace.events,
    entries: workspace.entries,
  };
  return {
    ...resetRepairWorkspace(activity, workspace),
    implementation,
    checkpoints: appendCheckpoint(workspace.checkpoints, checkpoint),
    nextCheckpointId: workspace.nextCheckpointId + 1,
  };
}
export function restoreRepairCheckpoint(workspace: RepairWorkspace, id: number): RepairWorkspace {
  const checkpoint = workspace.checkpoints.find((item) => item.id === id);
  if (!checkpoint) return workspace;
  const current: RepairCheckpoint = {
    id: workspace.nextCheckpointId,
    implementation: workspace.implementation,
    product: workspace.product,
    events: workspace.events,
    entries: workspace.entries,
  };
  return {
    ...workspace,
    implementation: checkpoint.implementation,
    product: checkpoint.product,
    events: checkpoint.events,
    entries: checkpoint.entries,
    checkpoints: appendCheckpoint(workspace.checkpoints, current),
    nextCheckpointId: workspace.nextCheckpointId + 1,
  };
}

export function createRepairComparison(
  activity: RepairActivity,
  baseline: RepairImplementation,
  candidate: RepairImplementation,
  events: readonly RepairEvent[] = [],
  mode: "replay" | "manual" = "replay",
): RepairComparison | undefined {
  const left = replayRepair(activity, baseline, events);
  const right = replayRepair(activity, candidate, events);
  if (!left.valid || !right.valid || (mode === "manual" && events.length > 0)) return undefined;
  return {
    baseline,
    candidate,
    events: left.trace.events,
    origins: events.map(() => "replay"),
    left: left.trace,
    right: right.trace,
    cursor: 0,
    mode,
    branch: 0,
  };
}

export function seekRepairComparison(
  comparison: RepairComparison,
  cursor: number,
): RepairComparison {
  if (!Number.isFinite(cursor)) return comparison;
  return {
    ...comparison,
    cursor: Math.min(comparison.events.length, Math.max(0, Math.floor(cursor))),
  };
}

/** Rewinding only changes the view; branching explicitly enables new real input. */
export function branchRepairComparison(comparison: RepairComparison): RepairComparison {
  return { ...comparison, mode: "manual", branch: comparison.branch + 1 };
}

export function appendRepairComparisonEvent(
  activity: RepairActivity,
  comparison: RepairComparison,
  event: RepairEvent,
): RepairComparison {
  if (comparison.mode !== "manual" || comparison.cursor >= 40) return comparison;
  const events = [...comparison.events.slice(0, comparison.cursor), { ...event }];
  const left = replayRepair(activity, comparison.baseline, events);
  const right = replayRepair(activity, comparison.candidate, events);
  if (!left.valid || !right.valid) return comparison;
  return {
    ...comparison,
    events,
    origins: [...comparison.origins.slice(0, comparison.cursor), "manual"],
    left: left.trace,
    right: right.trace,
    cursor: events.length,
    branch: comparison.branch + (comparison.cursor < comparison.events.length ? 1 : 0),
  };
}

/** Data that is hidden behind a save is not yet a visible product divergence. */
function repairVisibleSignature(activity: RepairActivity, product: RepairProduct): string {
  return JSON.stringify(
    activity.model === "booking"
      ? { choice: product.choice, reservations: product.reservations }
      : { choice: product.choice, confirmed: product.confirmed },
  );
}
export function repairComparisonFrame(
  activity: RepairActivity,
  comparison: RepairComparison,
): {
  readonly left: RepairProduct;
  readonly right: RepairProduct;
  readonly event?: RepairEvent;
  readonly different: boolean;
  readonly cursor: number;
} {
  const left =
    comparison.left.entries[comparison.cursor - 1]?.after ?? initialRepairProduct(activity);
  const right =
    comparison.right.entries[comparison.cursor - 1]?.after ?? initialRepairProduct(activity);
  return {
    left,
    right,
    event: comparison.events[comparison.cursor - 1],
    different: repairVisibleSignature(activity, left) !== repairVisibleSignature(activity, right),
    cursor: comparison.cursor,
  };
}
export function firstRepairDivergence(
  activity: RepairActivity,
  comparison: RepairComparison,
): number | undefined {
  for (let cursor = 1; cursor <= comparison.events.length; cursor++) {
    if (repairComparisonFrame(activity, { ...comparison, cursor }).different) return cursor;
  }
  return undefined;
}
export function checkRepairComparisonRegression(
  activity: RepairActivity,
  comparison: RepairComparison,
): "missing" | "failed" | "passed" {
  if (
    comparison.mode !== "manual" ||
    comparison.cursor !== comparison.events.length ||
    comparison.origins.length !== comparison.events.length ||
    comparison.origins.some((origin) => origin !== "manual")
  )
    return "missing";
  return checkRepairRegression(activity, comparison.right);
}
