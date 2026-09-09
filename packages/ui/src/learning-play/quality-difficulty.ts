import {
  EVAL_EXPECTATIONS,
  type ActivityFamily,
  type EvalActivity,
  type RepairActivity,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
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
          brief: t("play.qualityDifficulty.eval.intro.brief"),
          goal: t("play.qualityDifficulty.eval.intro.goal", {
            boundary: activity.outcomes[boundary].label,
          }),
          hint: t("play.qualityDifficulty.eval.intro.hint"),
          requiredExpectations: ["fulfilled", boundary],
          requiredInputs: [],
        },
        practice: { ...activity, id: id("practice"), difficulty: "practice" },
        challenge: {
          ...activity,
          id: id("challenge"),
          difficulty: "challenge",
          brief: t("play.qualityDifficulty.eval.challenge.brief"),
          goal: t("play.qualityDifficulty.eval.challenge.goal"),
          hint: t("play.qualityDifficulty.eval.challenge.hint"),
          contract: t("play.qualityDifficulty.eval.challenge.contract", {
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
    { id: "third", label: t(`play.qualityDifficulty.repair.${activity.model}.third`) },
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
        brief: t("play.qualityDifficulty.repair.intro.brief"),
        goal: t("play.qualityDifficulty.repair.intro.goal", { regression: activity.regression }),
        hint: t("play.qualityDifficulty.repair.intro.hint"),
        offeredPatches: ["scoped", "removed"],
      },
      practice: { ...activity, id: id("practice"), difficulty: "practice" },
      challenge: {
        ...activity,
        id: id("challenge"),
        difficulty: "challenge",
        choices,
        capacity: Math.max(2, activity.capacity),
        brief: t(`play.qualityDifficulty.repair.${activity.model}.challenge.brief`),
        goal: t(`play.qualityDifficulty.repair.${activity.model}.challenge.goal`, values),
        hint: t(`play.qualityDifficulty.repair.${activity.model}.challenge.hint`),
        productBrief: t(`play.qualityDifficulty.repair.${activity.model}.challenge.productBrief`),
        regression: t(
          `play.qualityDifficulty.repair.${activity.model}.challenge.regression`,
          values,
        ),
        regressionSteps: (["step1", "step2", "step3"] as const).map((step) =>
          t(`play.qualityDifficulty.repair.${activity.model}.challenge.${step}`, values),
        ),
        regressionContract:
          activity.model === "booking" ? "keep-other-booking" : "persist-each-change",
      },
    },
  };
}
