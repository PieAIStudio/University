/**
 * Authoring's GradingPort: the clipboard host, on the same routes the exercise
 * block used to call itself.
 *
 * The one permitted difference between the two builds, and the reason this file
 * and its neighbour under `online/` both exist. There is no API key in this
 * product; the machine already has a coding tool on it, and that is the tool
 * that grades.
 */
import type {
  CoachingPacket,
  ExerciseAttemptResult,
  GradingPort,
  MeteredGradingOffer,
  ProgressPort,
} from "@pieai/university-core";
import { METERED_GRADING_COST_POWER_UNITS as METERED_COST } from "@pieai/university-core";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";
import { translate } from "@pieai/university-ui/i18n.js";

import { createLocalRequestHeaders } from "./bootstrap.js";

export function createLocalGradingPort(options: {
  readonly progress?: ProgressPort;
  /** Overridden in unit tests; the product always reads the bootstrap. */
  readonly requestToken?: () => Promise<string>;
}): GradingPort {
  const headers = createLocalRequestHeaders(options.requestToken);

  return {
    async submitExercise(input) {
      const accountScope = options.progress?.syncState().userId ?? null;
      const body = await readJson<ExerciseAttemptResult>(
        await fetch(`${lessonPath(input.locator)}/exercises/${input.exerciseId}/attempt`, {
          method: "POST",
          headers: await headers(),
          body: JSON.stringify({
            contentRevision: input.contentRevision,
            answer: input.answer,
            commandId: input.commandId,
          }),
        }),
      );
      if ((options.progress?.syncState().userId ?? null) !== accountScope) {
        throw new Error(translate("grading.account.changedBeforeSave"));
      }
      options.progress?.recordExerciseAttempt({
        commandId: input.commandId,
        locator: input.locator,
        exerciseId: input.exerciseId,
        contentRevision: input.contentRevision,
        answer: input.answer,
        score: body.score,
        maxScore: body.maxScore,
        hostGrade: body.hostGrade ?? null,
        occurredAt: body.hostGrade?.occurredAt ?? new Date().toISOString(),
      });
      return {
        ...body,
        answerStored: options.progress ? options.progress.localSaveState?.() === "saved" : true,
      };
    },

    async meteredGradingOffer(): Promise<MeteredGradingOffer> {
      return {
        kind: "unavailable",
        costPowerUnits: METERED_COST,
        availablePowerUnits: null,
        explanation: {
          kind: "explanation",
          title: translate("grading.local.title"),
          whatItDoes: translate("grading.local.whatItDoes"),
          whyUnavailable: translate("grading.local.whyUnavailable"),
          futureSupport: translate("grading.local.futureSupport"),
        },
      };
    },

    async coachingPacket(input) {
      return readJson<CoachingPacket>(
        await fetch(`${lessonPath(input.locator)}/exercises/${input.exerciseId}/coaching-packet`),
      );
    },

    async expressionPacket(studyId) {
      return readJson<{ readonly packet: string }>(
        await fetch(`/api/studies/${studyId}/expression-packet`),
      );
    },
  };
}
