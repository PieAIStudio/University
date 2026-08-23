/**
 * The authoring shell's GradingPort: clipboard host, same routes the exercise
 * block used to call itself.
 */
import type { CoachingPacket, ExerciseAttemptResult, GradingPort } from "@pieai/university-core";
import { lessonPath, readJson } from "@pieai/university-ui/api/client.js";

export function createHttpGradingPort(options: { readonly requestToken: string }): GradingPort {
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
