// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvalActivity, RepairActivity } from "@pieai/university-core";
import { activeLocale, setActiveLocale, translate as t } from "../i18n/index.js";
import { EvalGame } from "./EvalGame.js";
import { RepairGame } from "./RepairGame.js";
import { getAIQualityExamples } from "./ai-quality-examples.js";
import { evalStarterQuestion } from "./QualityGuidance.js";
import { getQualityFamily } from "./quality-difficulty.js";

let container: HTMLDivElement;
let root: Root;
let previousLocale: string;
let scrollDescriptor: PropertyDescriptor | undefined;

function available(element: Element): boolean {
  return (
    !element.closest("[hidden]") &&
    ![...container.querySelectorAll("details:not([open])")].some((details) =>
      details.contains(element),
    )
  );
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => available(candidate) && candidate.textContent?.trim() === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}

async function click(label: string) {
  const target = button(label);
  expect(target.disabled, `${label} should be actionable`).toBe(false);
  await act(async () => target.click());
}

async function openDetails(label: string) {
  const summary = [...container.querySelectorAll("summary")].find(
    (candidate) => !candidate.closest("[hidden]") && candidate.textContent?.includes(label),
  );
  expect(summary, label).toBeDefined();
  await act(async () => summary!.click());
}

function evaluation(topic: "schedule" | "shop"): EvalActivity {
  return getAIQualityExamples().find(
    (activity) => activity.id === `ai-eval-${topic}`,
  ) as EvalActivity;
}

function repair(model: "booking" | "preference"): RepairActivity {
  return getAIQualityExamples().find(
    (activity) => activity.id === `ai-repair-${model}`,
  ) as RepairActivity;
}

async function nextReplay() {
  const next = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => available(candidate) && candidate.textContent?.startsWith("下一步："),
  );
  expect(next).toBeDefined();
  await act(async () => next!.click());
}

beforeEach(() => {
  previousLocale = activeLocale();
  setActiveLocale("zh-CN");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  setActiveLocale(previousLocale);
  vi.unstubAllGlobals();
});

describe("quality activity guidance uses real evidence", () => {
  it("shows two required categories in intro and accepts only after a useful normal release", async () => {
    const family = getQualityFamily(evaluation("schedule"));
    if (family.kind !== "ai-eval") throw new Error("Expected an evaluation family");
    const activity = family.levels.intro;
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<EvalGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    expect(container.querySelector(".quality-guide__requirements summary")?.textContent).toBe(
      t("play.qualityDifficulty.eval.requirements", { count: 2, cross: "" }),
    );
    await click(t("play.qualityGuide.eval.startAction"));
    await click(t("play.aiQuality.eval.repeat"));
    await click(t("play.qualityGuide.eval.ownQuestion"));
    await click(activity.outcomes.fulfilled.label);
    await click(t("play.aiQuality.eval.freezeAndProbe"));
    expect(
      container.querySelector(".quality-guide__collection-fold > summary")?.textContent,
    ).toContain(t("play.qualityDifficulty.eval.coverage", { count: 2, total: 2 }));
    await click(activity.inputs.information.guard);
    await click(t("play.aiQuality.eval.runBoundary"));
    expect(onAttempt).not.toHaveBeenCalled();
    await click(t("play.aiQuality.eval.finish"));
    expect(onAttempt).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ cases: expect.any(Array) }),
      expect.any(String),
    );
    expect(onAttempt.mock.calls[0]![1].cases).toHaveLength(2);
  });

  it("still asks the learner to choose a crossed-case expectation after all four isolated categories", async () => {
    const family = getQualityFamily(evaluation("schedule"));
    if (family.kind !== "ai-eval") throw new Error("Expected an evaluation family");
    const activity = family.levels.challenge;
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<EvalGame activity={activity} disabled={false} onAttempt={onAttempt} />),
    );
    const categories = ["fulfilled", "clarify", "unavailable", "out-of-scope"] as const;
    for (const [index, category] of categories.entries()) {
      if (index) await click(t("play.aiQuality.eval.newQuestion"));
      const condition =
        category === "clarify"
          ? "information"
          : category === "unavailable"
            ? "availability"
            : category === "out-of-scope"
              ? "supported"
              : undefined;
      if (condition) {
        await openDetails(activity.inputs[condition].label);
        await click(activity.inputs[condition].absent);
      }
      await click(activity.outcomes[category].label);
      await click(t("play.aiQuality.eval.freezeAndProbe"));
    }
    await click(t("play.aiQuality.eval.newQuestion"));
    await act(async () =>
      root.render(<EvalGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    const prompt = container.querySelector(".play-guide")?.textContent;
    expect(prompt).toContain(activity.inputs.information.absent);
    expect(prompt).toContain(activity.inputs.availability.absent);
    expect(container.querySelectorAll('.ai-eval__expectations [aria-pressed="true"]')).toHaveLength(
      0,
    );
    expect(
      container.querySelectorAll('.quality-guide__requirements li[data-complete="false"]'),
    ).toHaveLength(2);
    expect(container.querySelector(".quality-guide__release-fold")?.hasAttribute("open")).toBe(
      false,
    );
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it("offers exactly two real intro repair proposals and states the old capability before applying", async () => {
    const family = getQualityFamily(repair("booking"));
    if (family.kind !== "ai-repair") throw new Error("Expected a repair family");
    const activity = family.levels.intro;
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<RepairGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    await click(activity.submitLabel);
    await click(activity.submitLabel);
    await click(t("play.aiQuality.repair.capture"));
    const offers = container.querySelectorAll(".ai-repair__patch-offers button");
    expect(offers).toHaveLength(2);
    expect([...offers].map((offer) => offer.textContent)).toEqual([
      activity.patches.scoped.label,
      activity.patches.removed.label,
    ]);
    expect(container.querySelector(".ai-repair__patches")?.textContent).toContain(
      activity.regression,
    );
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it.each(["schedule", "shop"] as const)(
    "%s starts with one disclosed test, never a completed collection",
    async (topic) => {
      const activity = evaluation(topic);
      const starter = evalStarterQuestion(activity);
      const onAttempt = vi.fn();
      await act(async () =>
        root.render(<EvalGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
      );
      expect(container.querySelectorAll(".ai-eval__response-strip li")).toHaveLength(0);
      expect(container.querySelectorAll(".ai-eval__expectations")).toHaveLength(0);
      expect(container.textContent).toContain(activity.outcomes[starter.expected].label);
      await click(t("play.qualityGuide.eval.startAction"));
      expect(container.querySelectorAll(".ai-eval__response-strip li")).toHaveLength(1);
      expect(container.querySelectorAll(".ai-eval__case-sheet > li")).toHaveLength(1);
      for (let trial = 1; trial < activity.trials; trial++)
        await click(t("play.aiQuality.eval.repeat"));
      expect(
        container.querySelectorAll('.ai-eval__response-strip li[data-passed="false"]'),
      ).toHaveLength(1);
      expect(onAttempt).not.toHaveBeenCalled();

      await click(t("play.qualityGuide.eval.ownQuestion"));
      expect(
        container.querySelectorAll('.ai-eval__expectations [aria-pressed="true"]'),
      ).toHaveLength(0);
      await click(activity.outcomes.fulfilled.label);
      await click(t("play.aiQuality.eval.freezeAndProbe"));
      expect(container.querySelectorAll(".ai-eval__case-sheet > li")).toHaveLength(2);

      // The shared mode switch changes presentation, never the receipt collection.
      await act(async () =>
        root.render(
          <EvalGame activity={activity} disabled={false} guided={false} onAttempt={onAttempt} />,
        ),
      );
      expect(container.querySelectorAll(".ai-eval__case-sheet > li")).toHaveLength(2);
      await click(t("play.aiQuality.eval.finish"));
      expect(onAttempt).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ input: starter.input, expected: starter.expected }),
          ]),
          trialReceipts: expect.any(Array),
        }),
        expect.any(String),
      );
      expect(onAttempt.mock.calls[0]![1].trialReceipts).toHaveLength(activity.trials + 1);
    },
  );

  it("editing a starter invalidates only its own observations", async () => {
    const activity = evaluation("schedule");
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<EvalGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    await click(t("play.qualityGuide.eval.startAction"));
    await click(t("play.aiQuality.eval.repeat"));
    await click(t("play.qualityGuide.eval.ownQuestion"));
    await click(activity.outcomes.fulfilled.label);
    await click(t("play.aiQuality.eval.freezeAndProbe"));
    await act(async () =>
      root.render(
        <EvalGame activity={activity} disabled={false} guided={false} onAttempt={onAttempt} />,
      ),
    );
    const firstCase = container.querySelector(".ai-eval__case-sheet > li")!;
    const view = [...firstCase.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent === t("play.aiQuality.eval.viewCase"),
    )!;
    await act(async () => view.click());
    await click(t("play.aiQuality.eval.edit"));
    expect(container.querySelectorAll(".ai-eval__case-sheet > li")).toHaveLength(1);
    await click(t("play.aiQuality.eval.finish"));
    const evidence = onAttempt.mock.calls[0]![1];
    expect(evidence.cases).toHaveLength(1);
    expect(evidence.trialReceipts).toHaveLength(1);
    expect(evidence.trialReceipts[0].testCase.expected).toBe("fulfilled");
  });

  it.each(["booking", "preference"] as const)(
    "%s keeps stage navigation separate from manual acceptance",
    async (model) => {
      const activity = repair(model);
      const onAttempt = vi.fn();
      await act(async () =>
        root.render(
          <RepairGame activity={activity} disabled={false} guided onAttempt={onAttempt} />,
        ),
      );
      expect(
        [...container.querySelectorAll("button")]
          .filter(available)
          .some((candidate) => candidate.textContent === t("play.aiQuality.repair.capture")),
      ).toBe(false);
      if (model === "preference") await click(activity.choices[1]!.label);
      await click(activity.submitLabel);
      if (model === "booking") await click(activity.submitLabel);
      else await click(t("play.aiQuality.repair.reload"));
      await click(t("play.aiQuality.repair.capture"));
      expect(document.activeElement?.textContent).toBe(t("play.aiQuality.repair.patch"));
      expect(container.querySelector(".ai-repair__live")?.hasAttribute("hidden")).toBe(true);
      await click(activity.patches.scoped.label);
      expect(container.querySelector(".ai-repair__scope")?.textContent).toContain(
        activity.patches.scoped.scope,
      );
      expect(container.querySelector(".ai-repair__scope details")?.hasAttribute("open")).toBe(true);
      await click(t("play.aiQuality.repair.apply"));
      expect(document.activeElement?.textContent).toBe(activity.product);
      for (let step = 0; step < (model === "booking" ? 2 : 3); step++) await nextReplay();
      await click(t("play.aiQuality.repair.checkReplay"));
      expect(onAttempt).not.toHaveBeenCalled();
      await click(t("play.aiQuality.repair.regressionStart"));

      if (model === "preference") await click(activity.choices[1]!.label);
      await click(activity.submitLabel);
      if (model === "booking") {
        await click(t("play.aiQuality.repair.cancel"));
        await click(activity.choices[1]!.label);
      } else await click(activity.choices[0]!.label);
      await click(activity.submitLabel);
      if (model === "preference") await click(t("play.aiQuality.repair.reload"));
      await click(t("play.aiQuality.repair.regressionCheck"));
      expect(onAttempt).not.toHaveBeenCalled();
      await click(t("play.aiQuality.repair.finish"));
      expect(onAttempt).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({
          appliedImplementation: "scoped",
          comparison: expect.objectContaining({ mode: "manual", origins: expect.any(Array) }),
        }),
        expect.any(String),
      );
      const evidence = onAttempt.mock.calls[0]![1];
      expect(evidence.comparison.origins.every((origin: string) => origin === "manual")).toBe(true);
      expect(evidence.failure.events).toHaveLength(model === "booking" ? 2 : 3);
    },
  );

  it("a broad repair can pass the original replay while visibly breaking the old feature", async () => {
    const activity = repair("booking");
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<RepairGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    await click(activity.submitLabel);
    await click(activity.submitLabel);
    await click(t("play.aiQuality.repair.capture"));
    await click(activity.patches.rewrite.label);
    await click(t("play.aiQuality.repair.apply"));
    await nextReplay();
    await nextReplay();
    await click(t("play.aiQuality.repair.checkReplay"));
    await click(t("play.aiQuality.repair.regressionStart"));
    await click(activity.submitLabel);
    await click(t("play.aiQuality.repair.cancel"));
    expect(container.querySelector(".ai-repair__live .play-guide")?.textContent).toContain(
      t("play.qualityGuide.repair.blocked"),
    );
    expect(container.querySelector(".ai-repair__paired-products")?.textContent).toContain(
      t("play.aiQuality.repair.rewrite-blocked"),
    );
    await click(t("play.aiQuality.repair.regressionCheck"));
    await click(t("play.qualityGuide.repair.historyTab"));
    await click(t("play.aiQuality.repair.finish"));
    expect(onAttempt).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ regression: undefined }),
      expect.any(String),
    );
    await click(t("play.qualityGuide.repair.patchTab"));
    await click(activity.patches.scoped.label);
    await click(t("play.aiQuality.repair.apply"));
    expect(container.querySelector(".ai-repair__paired-products")?.textContent).toContain(
      activity.patches.scoped.label,
    );
  });

  it("candidate switching remains reachable without discarding the starter evidence", async () => {
    const activity = evaluation("schedule");
    const onAttempt = vi.fn();
    await act(async () =>
      root.render(<EvalGame activity={activity} disabled={false} guided onAttempt={onAttempt} />),
    );
    await click(t("play.qualityGuide.eval.startAction"));
    await openDetails(activity.candidates[0]!.label);
    await click(activity.candidates[1]!.label);
    expect(container.querySelectorAll(".ai-eval__response-strip li")).toHaveLength(0);
    await click(t("play.aiQuality.eval.probeCurrent"));
    expect(
      container.querySelectorAll('.ai-eval__response-strip li[data-passed="false"]'),
    ).toHaveLength(1);
    await click(activity.candidates[0]!.label);
    expect(
      container.querySelectorAll('.ai-eval__response-strip li[data-passed="true"]'),
    ).toHaveLength(1);
    expect(onAttempt).not.toHaveBeenCalled();
  });
});
