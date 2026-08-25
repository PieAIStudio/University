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
  ProgressPort,
} from "@pieai/university-core";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";

import { localBootstrap } from "./content.js";

export function createLocalGradingPort(options: {
  readonly progress?: ProgressPort;
  /** Overridden in unit tests; the product always reads the bootstrap. */
  readonly requestToken?: () => Promise<string>;
}): GradingPort {
  const token = options.requestToken ?? (async () => (await localBootstrap()).requestToken);
  const headers = async () => ({
    "Content-Type": "application/json",
    "X-University-Local-Token": await token(),
  });

  return {
    async submitExercise(input) {
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
      return body;
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
