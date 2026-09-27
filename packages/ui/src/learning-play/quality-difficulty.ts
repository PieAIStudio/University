import {
  EVAL_EXPECTATIONS,
  type ActivityFamily,
  type EvalActivity,
  type RepairActivity,
} from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";
import { evalStarterQuestion } from "./QualityGuidance.js";

/** Four scenario families share the same engines; every level has a fresh evidence identity. */
export function getQualityFamily(activity: EvalActivity | RepairActivity): ActivityFamily {
  const id = (difficulty: "intro" | "practice" | "challenge") => `${activity.id}:${difficulty}:v1`;
  if (activity.kind === "ai-eval") {
    const starter = evalStarterQuestion(activity);
    const boundary = starter.expected === "fulfilled" ? "clarify" : starter.expected;
    return {
      id: activity.id,
      kind: activity.kind,
      levels: {
        intro: {
          ...activity,
          id: id("intro"),
          difficulty: "intro",
          brief: interfaceTranslator.t("play.qualityDifficulty.eval.intro.brief"),
          goal: interfaceTranslator.t("play.qualityDifficulty.eval.intro.goal", {
            boundary: activity.outcomes[boundary].label,
          }),
          hint: interfaceTranslator.t("play.qualityDifficulty.eval.intro.hint"),
          requiredExpectations: ["fulfilled", boundary],
          requiredInputs: [],
        },
        practice: { ...activity, id: id("practice"), difficulty: "practice" },
        challenge: {
          ...activity,
          id: id("challenge"),
          difficulty: "challenge",
          brief: interfaceTranslator.t("play.qualityDifficulty.eval.challenge.brief"),
          goal: interfaceTranslator.t("play.qualityDifficulty.eval.challenge.goal"),
          hint: interfaceTranslator.t("play.qualityDifficulty.eval.challenge.hint"),
          contract: interfaceTranslator.t("play.qualityDifficulty.eval.challenge.contract", {
            contract: activity.contract,
          }),
          requiredExpectations: EVAL_EXPECTATIONS,
          requiredInputs: [
            { information: false, availability: false, supported: true },
            { information: false, availability: true, supported: false },
          ],
        },
      },
    };
  }
  const choices = [
    ...activity.choices,
    {
      id: "third",
      label: interfaceTranslator.t(`play.qualityDifficulty.repair.${activity.model}.third`),
    },
  ];
  const values = { keep: choices[0]!.label, second: choices[1]!.label, third: choices[2]!.label };
  return {
    id: activity.id,
    kind: activity.kind,
    levels: {
      intro: {
        ...activity,
        id: id("intro"),
        difficulty: "intro",
        brief: interfaceTranslator.t("play.qualityDifficulty.repair.intro.brief"),
        goal: interfaceTranslator.t("play.qualityDifficulty.repair.intro.goal", {
          regression: activity.regression,
        }),
        hint: interfaceTranslator.t("play.qualityDifficulty.repair.intro.hint"),
        offeredPatches: ["scoped", "removed"],
      },
      practice: { ...activity, id: id("practice"), difficulty: "practice" },
      challenge: {
        ...activity,
        id: id("challenge"),
        difficulty: "challenge",
        choices,
        capacity: Math.max(2, activity.capacity),
        brief: interfaceTranslator.t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.brief`,
        ),
        goal: interfaceTranslator.t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.goal`,
          values,
        ),
        hint: interfaceTranslator.t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.hint`,
        ),
        productBrief: interfaceTranslator.t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.productBrief`,
        ),
        regression: interfaceTranslator.t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.regression`,
          values,
        ),
        regressionSteps: (["step1", "step2", "step3"] as const).map((step) =>
          interfaceTranslator.t(
            `play.qualityDifficulty.repair.${activity.model}.challenge.${step}`,
            values,
          ),
        ),
        regressionContract:
          activity.model === "booking" ? "keep-other-booking" : "persist-each-change",
      },
    },
  };
}
