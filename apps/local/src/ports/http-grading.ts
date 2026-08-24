/**
 * The authoring shell's GradingPort: clipboard host, same routes the exercise
 * block used to call itself.
 */
import type {
  CoachingPacket,
  ExerciseAttemptResult,
  GradingPort,
  ProgressPort,
} from "@pieai/university-core";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";

export function createHttpGradingPort(options: {
  readonly requestToken: string;
  readonly progress?: ProgressPort;
}): GradingPort {
  const headers = {
    "Content-Type": "application/json",
    "X-University-Local-Token": options.requestToken,
  };

  return {
    async submitExercise(input) {
      const body = await readJson<ExerciseAttemptResult>(
        await fetch(`${lessonPath(input.locator)}/exercises/${input.exerciseId}/attempt`, {
          method: "POST",
          headers,
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
