import type {
  EvalActivity,
  EvalExpectation,
  EvalOutcome,
  RepairActivity,
} from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

export function getAIQualityExamples(): readonly (EvalActivity | RepairActivity)[] {
  const expectations = ["fulfilled", "clarify", "unavailable", "out-of-scope"] as const;
  const repeat = (outcome: EvalOutcome): readonly EvalOutcome[] => [outcome, outcome, outcome];
  const evaluations = (["schedule", "shop"] as const).map(
    (topic): EvalActivity => ({
      kind: "ai-eval",
      id: `ai-eval-${topic}`,
      title: interfaceTranslator.t(`play.aiQuality.eval.${topic}.title`),
      brief: interfaceTranslator.t(`play.aiQuality.eval.${topic}.brief`),
      goal: interfaceTranslator.t(`play.aiQuality.eval.${topic}.goal`),
      takeaway: interfaceTranslator.t(`play.aiQuality.eval.${topic}.takeaway`),
      hint: interfaceTranslator.t(`play.aiQuality.eval.${topic}.hint`),
      source: {
        label: interfaceTranslator.t("play.aiQuality.eval.source"),
        url: "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
      },
      product: interfaceTranslator.t(`play.aiQuality.eval.${topic}.product`),
      contract: interfaceTranslator.t(`play.aiQuality.eval.${topic}.contract`),
      initial: { information: true, availability: true, supported: true },
      inputs: Object.fromEntries(
        (["information", "availability", "supported"] as const).map((key) => [
          key,
          {
            label: interfaceTranslator.t(`play.aiQuality.eval.${topic}.${key}.label`),
            present: interfaceTranslator.t(`play.aiQuality.eval.${topic}.${key}.present`),
            absent: interfaceTranslator.t(`play.aiQuality.eval.${topic}.${key}.absent`),
            guard: interfaceTranslator.t(`play.aiQuality.eval.${topic}.${key}.guard`),
          },
        ]),
      ) as EvalActivity["inputs"],
      outcomes: Object.fromEntries(
        ([...expectations, "refused"] as const).map((outcome) => [
          outcome,
          {
            label: interfaceTranslator.t(`play.aiQuality.eval.${topic}.${outcome}.label`),
            observation: interfaceTranslator.t(
              `play.aiQuality.eval.${topic}.${outcome}.observation`,
            ),
            artifact: {
              label: interfaceTranslator.t(`play.aiQuality.eval.${topic}.artifact`),
              value:
                topic === "schedule"
                  ? interfaceTranslator.t(
                      outcome === "fulfilled"
                        ? "play.aiQuality.eval.schedule.created"
                        : "play.aiQuality.eval.schedule.notCreated",
                    )
                  : interfaceTranslator.t(`play.aiQuality.eval.shop.${outcome}.artifact`),
            },
          },
        ]),
      ) as EvalActivity["outcomes"],
      trials: 3,
      candidates: (["careful", "eager", "refuse"] as const).map((id, index) => ({
        id,
        label: interfaceTranslator.t(
          (
            [
              "play.aiQuality.eval.candidateA",
              "play.aiQuality.eval.candidateB",
              "play.aiQuality.eval.candidateC",
            ] as const
          )[index]!,
        ),
        note: interfaceTranslator.t("play.aiQuality.eval.unknownNote"),
        responses: Object.fromEntries(
          expectations.map((expected) => [
            expected,
            id === "eager"
              ? repeat("fulfilled")
              : id === "refuse"
                ? repeat("refused")
                : topic === "schedule" && expected === "clarify"
                  ? ["clarify", "fulfilled", "clarify"]
                  : topic === "shop" && expected === "unavailable"
                    ? ["unavailable", "unavailable", "fulfilled"]
                    : repeat(expected),
          ]),
        ) as Readonly<Record<EvalExpectation, readonly EvalOutcome[]>>,
      })),
    }),
  );
  const repairs = (["booking", "preference"] as const).map(
    (model): RepairActivity => ({
      kind: "ai-repair",
      id: `ai-repair-${model}`,
      model,
      title: interfaceTranslator.t(`play.aiQuality.repair.${model}.title`),
      brief: interfaceTranslator.t(`play.aiQuality.repair.${model}.brief`),
      goal: interfaceTranslator.t(`play.aiQuality.repair.${model}.goal`),
      takeaway: interfaceTranslator.t(`play.aiQuality.repair.${model}.takeaway`),
      hint: interfaceTranslator.t(`play.aiQuality.repair.${model}.hint`),
      source: {
        label: interfaceTranslator.t("play.aiQuality.repair.source"),
        url: "https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/",
      },
      product: interfaceTranslator.t(`play.aiQuality.repair.${model}.product`),
      productBrief: interfaceTranslator.t(`play.aiQuality.repair.${model}.productBrief`),
      choices: (["first", "second"] as const).map((id) => ({
        id,
        label: interfaceTranslator.t(`play.aiQuality.repair.${model}.${id}`),
      })),
      capacity: 3,
      defect: interfaceTranslator.t(`play.aiQuality.repair.${model}.defect`),
      expected: interfaceTranslator.t(`play.aiQuality.repair.${model}.expected`),
      reproduceSteps: (["step1", "step2", "step3"] as const).map((step) =>
        interfaceTranslator.t(`play.aiQuality.repair.${model}.${step}`),
      ),
      regression: interfaceTranslator.t(`play.aiQuality.repair.${model}.regression`),
      regressionSteps: (["regression1", "regression2", "regression3"] as const).map((step) =>
        interfaceTranslator.t(`play.aiQuality.repair.${model}.${step}`),
      ),
      submitLabel: interfaceTranslator.t(`play.aiQuality.repair.${model}.submit`),
      patches: Object.fromEntries(
        (["scoped", "rewrite", "removed"] as const).map((patch) => [
          patch,
          {
            label: interfaceTranslator.t(
              model === "booking"
                ? patch === "rewrite"
                  ? "play.aiQuality.repair.versionA"
                  : patch === "scoped"
                    ? "play.aiQuality.repair.versionB"
                    : "play.aiQuality.repair.versionC"
                : patch === "scoped"
                  ? "play.aiQuality.repair.versionA"
                  : patch === "removed"
                    ? "play.aiQuality.repair.versionB"
                    : "play.aiQuality.repair.versionC",
            ),
            claim: interfaceTranslator.t(`play.aiQuality.repair.${model}.${patch}.claim`),
            scope: interfaceTranslator.t(`play.aiQuality.repair.${model}.${patch}.scope`),
            change: interfaceTranslator.t(`play.aiQuality.repair.${model}.${patch}.change`),
          },
        ]),
      ) as RepairActivity["patches"],
    }),
  );
  return [...evaluations, ...repairs];
}
