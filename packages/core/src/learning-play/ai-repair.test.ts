import { describe, expect, it } from "vitest";
import {
  branchRepairWorkspace,
  appendRepairComparisonEvent,
  branchRepairComparison,
  checkRepairComparisonRegression,
  createRepairComparison,
  firstRepairDivergence,
  repairComparisonFrame,
  seekRepairComparison,
  captureRepairEvidence,
  checkRepairDefect,
  checkRepairRegression,
  createRepairWorkspace,
  operateRepairWorkspace,
  replayRepair,
  resetRepairWorkspace,
  restoreRepairCheckpoint,
  type RepairActivity,
  type RepairEvent,
  type RepairImplementation,
} from "./ai-repair.js";

const booking: RepairActivity = {
  kind: "ai-repair",
  id: "booking",
  model: "booking",
  title: "",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "", url: "https://example.com" },
  product: "",
  productBrief: "",
  capacity: 3,
  choices: [
    { id: "morning", label: "Morning" },
    { id: "afternoon", label: "Afternoon" },
  ],
  defect: "",
  expected: "",
  reproduceSteps: [],
  regression: "",
  regressionSteps: [],
  submitLabel: "",
  patches: {
    scoped: { label: "", scope: "", change: "" },
    rewrite: { label: "", scope: "", change: "" },
    removed: { label: "", scope: "", change: "" },
  },
};
const preference: RepairActivity = { ...booking, id: "preference", model: "preference" };
const duplicate: RepairEvent[] = [{ type: "submit" }, { type: "submit" }];
const bookingRegression: RepairEvent[] = [
  { type: "submit" },
  { type: "cancel" },
  { type: "choose", value: "afternoon" },
  { type: "submit" },
];
const lostSave: RepairEvent[] = [
  { type: "choose", value: "afternoon" },
  { type: "submit" },
  { type: "reload" },
];
const preferenceRegression: RepairEvent[] = [
  { type: "choose", value: "afternoon" },
  { type: "submit" },
  { type: "choose", value: "morning" },
  { type: "submit" },
  { type: "reload" },
];
function replay(
  activity: RepairActivity,
  implementation: RepairImplementation,
  events: readonly RepairEvent[],
) {
  const result = replayRepair(activity, implementation, events);
  if (!result.valid) throw new Error(result.reason);
  return result.trace;
}
describe("rework time machine", () => {
  it("reproduces duplicate reservations through exactly the same transitions as real clicks", () => {
    const live = duplicate.reduce(
      (workspace, event) => operateRepairWorkspace(booking, workspace, event),
      createRepairWorkspace(booking),
    );
    expect(live.product.reservations).toEqual(["morning", "morning"]);
    const trace = replay(booking, "broken", duplicate);
    expect(live.entries).toEqual(trace.entries);
    const evidence = captureRepairEvidence(booking, trace)!;
    expect(evidence.expected.product.reservations).toEqual(["morning"]);
    expect(checkRepairDefect(booking, "scoped", evidence).passed).toBe(true);
    expect(checkRepairDefect(booking, "removed", evidence).passed).toBe(false);
  });
  it("makes a lying save confirmation observable only after reopening the preference", () => {
    const beforeReload = replay(preference, "broken", lostSave.slice(0, 2));
    expect(beforeReload.product.confirmed).toBe(true);
    expect(beforeReload.product.choice).toBe("afternoon");
    expect(captureRepairEvidence(preference, beforeReload)).toBeUndefined();
    const evidence = captureRepairEvidence(preference, replay(preference, "broken", lostSave))!;
    expect(evidence.actual.product.choice).toBe("morning");
    expect(evidence.expected.product.choice).toBe("afternoon");
    expect(checkRepairDefect(preference, "scoped", evidence).passed).toBe(true);
  });
  it.each([
    [booking, duplicate, bookingRegression],
    [preference, lostSave, preferenceRegression],
  ] as const)(
    "a broad rewrite can fix the reported defect while breaking useful previous behavior: %s",
    (activity, events, regression) => {
      const evidence = captureRepairEvidence(activity, replay(activity, "broken", events))!;
      expect(checkRepairDefect(activity, "rewrite", evidence).passed).toBe(true);
      expect(checkRepairRegression(activity, replay(activity, "rewrite", regression))).toBe(
        "failed",
      );
      expect(checkRepairRegression(activity, replay(activity, "scoped", regression))).toBe(
        "passed",
      );
      expect(checkRepairRegression(activity, replay(activity, "removed", regression))).not.toBe(
        "passed",
      );
    },
  );
  it("does not count no-op clicking or unobserved default state as repair evidence", () => {
    expect(captureRepairEvidence(booking, replay(booking, "broken", []))).toBeUndefined();
    expect(
      captureRepairEvidence(booking, replay(booking, "broken", [{ type: "submit" }])),
    ).toBeUndefined();
    expect(
      captureRepairEvidence(
        preference,
        replay(preference, "broken", [{ type: "submit" }, { type: "reload" }]),
      ),
    ).toBeUndefined();
    expect(checkRepairRegression(booking, replay(booking, "scoped", duplicate))).toBe("missing");
    expect(
      checkRepairRegression(
        booking,
        replay(booking, "scoped", [
          { type: "submit" },
          { type: "choose", value: "afternoon" },
          { type: "cancel" },
          { type: "submit" },
        ]),
      ),
    ).toBe("failed");
  });
  it("reports an observed blocked old action as failure before asking for more steps", () => {
    expect(
      checkRepairRegression(
        preference,
        replay(preference, "rewrite", [
          { type: "choose", value: "afternoon" },
          { type: "submit" },
          { type: "choose", value: "morning" },
        ]),
      ),
    ).toBe("failed");
  });
  it("restores both the broken implementation and its visible product state without losing the repair branch", () => {
    const broken = duplicate.reduce(
      (workspace, event) => operateRepairWorkspace(booking, workspace, event),
      createRepairWorkspace(booking),
    );
    const patched = branchRepairWorkspace(booking, broken, "scoped");
    expect(patched.product.reservations).toEqual([]);
    const replayed = duplicate.reduce(
      (workspace, event) => operateRepairWorkspace(booking, workspace, event),
      patched,
    );
    expect(replayed.product.reservations).toEqual(["morning"]);
    const restored = restoreRepairCheckpoint(replayed, 1);
    expect(restored.implementation).toBe("broken");
    expect(restored.product.reservations).toEqual(["morning", "morning"]);
    expect(restored.entries).toEqual(broken.entries);
    const backToRepair = restoreRepairCheckpoint(restored, 2);
    expect(backToRepair.implementation).toBe("scoped");
    expect(backToRepair.product.reservations).toEqual(["morning"]);
    expect(resetRepairWorkspace(booking, backToRepair).implementation).toBe("scoped");
  });
  it("retains frozen failure evidence after resetting the product and rejects altered receipts", () => {
    const trace = replay(booking, "broken", duplicate);
    const evidence = captureRepairEvidence(booking, trace)!;
    const changed = {
      ...evidence,
      expected: {
        ...evidence.expected,
        product: { ...evidence.expected.product, reservations: [] },
      },
    };
    expect(checkRepairDefect(booking, "removed", changed).passed).toBe(false);
    expect(evidence.actual.product.reservations).toHaveLength(2);
  });
  it("rejects invalid actions and keeps operations, reservations and checkpoint history bounded", () => {
    expect(replayRepair(booking, "broken", [{ type: "choose", value: "unknown" }])).toMatchObject({
      valid: false,
    });
    expect(replayRepair(booking, "broken", [{ type: "reload" }])).toMatchObject({ valid: false });
    expect(
      replayRepair(
        booking,
        "broken",
        Array.from({ length: 41 }, () => ({ type: "submit" }) as const),
      ),
    ).toMatchObject({ valid: false });
    expect(
      replay(
        booking,
        "broken",
        Array.from({ length: 40 }, () => ({ type: "submit" }) as const),
      ).product.reservations,
    ).toHaveLength(3);
    let workspace = createRepairWorkspace(booking);
    for (let index = 0; index < 12; index++)
      workspace = branchRepairWorkspace(booking, workspace, "scoped");
    expect(workspace.checkpoints).toHaveLength(8);
    expect(workspace.checkpoints[0]!.implementation).toBe("broken");
  });
});

describe("paired products and branchable action tapes", () => {
  it("sends the same duplicate event to both implementations and exposes the first visible fork", () => {
    const comparison = createRepairComparison(booking, "broken", "scoped", duplicate)!;
    expect(repairComparisonFrame(booking, comparison)).toMatchObject({
      cursor: 0,
      different: false,
    });
    expect(repairComparisonFrame(booking, seekRepairComparison(comparison, 1)).different).toBe(
      false,
    );
    const end = repairComparisonFrame(booking, seekRepairComparison(comparison, 2));
    expect(end.left.reservations).toEqual(["morning", "morning"]);
    expect(end.right.reservations).toEqual(["morning"]);
    expect(firstRepairDivergence(booking, comparison)).toBe(2);
    expect(comparison.left.events).toEqual(comparison.right.events);
  });
  it("distinguishes hidden saved data from what a user can see before reopening", () => {
    const comparison = createRepairComparison(preference, "broken", "scoped", lostSave)!;
    const savedFrame = repairComparisonFrame(preference, seekRepairComparison(comparison, 2));
    expect(savedFrame.left.savedChoice).not.toBe(savedFrame.right.savedChoice);
    expect(savedFrame.different).toBe(false);
    expect(firstRepairDivergence(preference, comparison)).toBe(3);
    expect(repairComparisonFrame(preference, seekRepairComparison(comparison, 3)).different).toBe(
      true,
    );
  });
  it("rewinds without reapplying actions, then branches from the actual prefix without changing the frozen tape", () => {
    const original = createRepairComparison(booking, "broken", "scoped", duplicate)!;
    let cursor = original;
    for (let index = 0; index < 10; index++)
      cursor = seekRepairComparison(seekRepairComparison(cursor, 2), 1);
    expect(cursor.left.product.reservations).toHaveLength(2);
    expect(cursor.events).toEqual(duplicate);
    expect(appendRepairComparisonEvent(booking, cursor, { type: "cancel" })).toBe(cursor);
    const branch = appendRepairComparisonEvent(booking, branchRepairComparison(cursor), {
      type: "cancel",
    });
    expect(branch.events).toEqual([{ type: "submit" }, { type: "cancel" }]);
    expect(branch.left.product.reservations).toEqual([]);
    expect(branch.right.product.reservations).toEqual([]);
    expect(branch.origins).toEqual(["replay", "manual"]);
    expect(original.events).toEqual(duplicate);
    expect(original.left.product.reservations).toHaveLength(2);
  });
  it("requires real manual events for old-feature checks, even when an automatic replay ends green", () => {
    const automatic = createRepairComparison(booking, "broken", "scoped", bookingRegression)!;
    const atEnd = seekRepairComparison(automatic, automatic.events.length);
    expect(checkRepairRegression(booking, atEnd.right)).toBe("passed");
    expect(checkRepairComparisonRegression(booking, atEnd)).toBe("missing");
    expect(checkRepairComparisonRegression(booking, branchRepairComparison(atEnd))).toBe("missing");
    expect(
      createRepairComparison(booking, "broken", "scoped", bookingRegression, "manual"),
    ).toBeUndefined();
    const manual = bookingRegression.reduce(
      (state, event) => appendRepairComparisonEvent(booking, state, event),
      createRepairComparison(booking, "broken", "scoped", [], "manual")!,
    );
    expect(checkRepairComparisonRegression(booking, manual)).toBe("passed");
    expect(manual.origins.every((origin) => origin === "manual")).toBe(true);
  });
  it("lets a player discover the rewrite's regression with shared controls", () => {
    const manual = preferenceRegression.reduce(
      (state, event) => appendRepairComparisonEvent(preference, state, event),
      createRepairComparison(preference, "broken", "rewrite", [], "manual")!,
    );
    expect(manual.left.product.choice).toBe("morning");
    expect(manual.right.product.choice).toBe("afternoon");
    expect(checkRepairComparisonRegression(preference, manual)).toBe("failed");
  });
  it("bounds scrubbing and branch operations, and refuses invalid new actions", () => {
    const original = createRepairComparison(booking, "broken", "scoped", duplicate)!;
    expect(seekRepairComparison(original, 100).cursor).toBe(2);
    expect(seekRepairComparison(original, -100).cursor).toBe(0);
    expect(seekRepairComparison(original, Number.NaN)).toBe(original);
    const manual = createRepairComparison(booking, "broken", "scoped", [], "manual")!;
    expect(appendRepairComparisonEvent(booking, manual, { type: "choose", value: "unknown" })).toBe(
      manual,
    );
    let full = manual;
    for (let index = 0; index < 40; index++)
      full = appendRepairComparisonEvent(booking, full, { type: "submit" });
    expect(appendRepairComparisonEvent(booking, full, { type: "submit" })).toBe(full);
  });
});
