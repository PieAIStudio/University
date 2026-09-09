import {
  EVAL_EXPECTATIONS,
  checkRepairRegression,
  type EvalActivity,
  type EvalExpectation,
  type EvalScenario,
  type RepairActivity,
  type RepairEvent,
  type RepairTrace,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

/** A disclosed starter only. It is neither a saved case nor an observed response. */
export function evalStarterQuestion(activity: EvalActivity): {
  readonly input: EvalScenario;
  readonly expected: EvalExpectation;
} {
  const first = activity.candidates[0];
  const expected =
    (activity.requiredExpectations ?? EVAL_EXPECTATIONS).find((category) => {
      const responses = first?.responses[category];
      return (
        category !== "fulfilled" &&
        responses &&
        responses[0] === category &&
        new Set(responses).size > 1
      );
    }) ??
    activity.requiredExpectations?.find((category) => category !== "fulfilled") ??
    "clarify";
  return {
    input: {
      information: expected !== "clarify",
      availability: expected !== "unavailable",
      supported: expected !== "out-of-scope",
    },
    expected,
  };
}

type RepairCueName =
  | "book"
  | "bookAgain"
  | "choose"
  | "save"
  | "reopen"
  | "cancel"
  | "changeChoice"
  | "bookChanged"
  | "reloadLatest"
  | "checkOld"
  | "blocked";

interface RepairCue {
  readonly name: RepairCueName;
  readonly action: RepairEvent["type"] | "check" | "patch" | "reset";
  readonly choice?: string;
  readonly instruction?: string;
}

function challengeBookingCue(activity: RepairActivity, trace: RepairTrace): RepairCue {
  const [keep, second, third] = activity.choices;
  const { product, entries } = trace;
  const firstKeep = entries.findIndex(
    (entry) =>
      entry.event.type === "submit" &&
      entry.before.choice === keep!.id &&
      entry.effect === "submitted",
  );
  if (
    firstKeep >= 0 &&
    entries.slice(firstKeep).some((entry) => !entry.after.reservations.includes(keep!.id))
  )
    return {
      name: "blocked",
      action: "reset",
      instruction: t("play.qualityDifficulty.repair.keepLost"),
    };
  const cancelledSecond = entries.some(
    (entry) =>
      entry.event.type === "cancel" &&
      entry.before.choice === second!.id &&
      entry.before.reservations.includes(second!.id) &&
      !entry.after.reservations.includes(second!.id),
  );
  const target = firstKeep < 0 ? keep! : cancelledSecond ? third! : second!;
  const needsCancel = !cancelledSecond && product.reservations.includes(second!.id);
  const key =
    firstKeep < 0
      ? "keepFirst"
      : cancelledSecond
        ? "addReplacement"
        : needsCancel
          ? "cancelOnly"
          : "addSecond";
  return {
    name: "choose",
    choice: target.id,
    action: product.choice !== target.id ? "choose" : needsCancel ? "cancel" : "submit",
    instruction: t(`play.qualityDifficulty.repair.${key}`, { choice: target.label }),
  };
}

function challengePreferenceCue(activity: RepairActivity, trace: RepairTrace): RepairCue {
  const first = activity.choices[1]!;
  const second = activity.choices[2]!;
  const firstRead = trace.entries.findIndex(
    (entry) =>
      entry.event.type === "reload" &&
      entry.after.choice === first.id &&
      entry.after.savedChoice === first.id,
  );
  const target = firstRead < 0 ? first : second;
  const saved = trace.entries.at(-1)?.event.type === "submit" && trace.product.choice === target.id;
  return {
    name: "choose",
    choice: target.id,
    action: saved ? "reload" : trace.product.choice !== target.id ? "choose" : "submit",
    instruction: t(
      saved
        ? "play.qualityDifficulty.repair.readChange"
        : "play.qualityDifficulty.repair.changeAndRead",
      { choice: target.label },
    ),
  };
}

/** Suggests the next real control. All acceptance still belongs to the core checks. */
export function repairActionCue(
  activity: RepairActivity,
  trace: RepairTrace,
  regression: boolean,
): RepairCue {
  const { product, entries } = trace;
  const firstChoice = activity.choices[0]!.id;
  const secondChoice = activity.choices[1]!.id;
  const submits = entries.filter((entry) => entry.event.type === "submit");
  if (regression) {
    if (checkRepairRegression(activity, trace) === "passed")
      return { name: "checkOld", action: "check" };
    if (entries.some((entry) => ["rewrite-blocked", "action-removed"].includes(entry.effect)))
      return { name: "blocked", action: "patch" };
    if (activity.regressionContract === "keep-other-booking")
      return challengeBookingCue(activity, trace);
    if (activity.regressionContract === "persist-each-change")
      return challengePreferenceCue(activity, trace);
    if (activity.model === "booking") {
      const cancelled = entries.find(
        (entry) =>
          entry.event.type === "cancel" &&
          entry.before.reservations.length > entry.after.reservations.length,
      );
      if (!submits.length) return { name: "book", action: "submit" };
      if (!cancelled) {
        const reserved = product.reservations[0];
        return reserved && product.choice !== reserved
          ? { name: "choose", action: "choose", choice: reserved }
          : { name: "cancel", action: "cancel" };
      }
      const target = activity.choices.find((choice) => choice.id !== cancelled.before.choice)!.id;
      return product.choice !== target
        ? { name: "changeChoice", action: "choose", choice: target }
        : { name: "bookChanged", action: "submit" };
    }
    const distinct = new Set(submits.map((entry) => entry.before.choice));
    if (distinct.size >= 2) return { name: "reloadLatest", action: "reload" };
    const target = submits.length
      ? activity.choices.find((choice) => choice.id !== submits[0]!.before.choice)!.id
      : secondChoice;
    return product.choice !== target
      ? { name: submits.length ? "changeChoice" : "choose", action: "choose", choice: target }
      : { name: "save", action: "submit" };
  }
  if (activity.model === "booking")
    return {
      name: product.reservations.includes(product.choice) ? "bookAgain" : "book",
      action: "submit",
    };
  if (entries.at(-1)?.event.type === "submit" && product.choice !== firstChoice)
    return { name: "reopen", action: "reload" };
  return product.choice === firstChoice
    ? { name: "choose", action: "choose", choice: secondChoice }
    : { name: "save", action: "submit" };
}
