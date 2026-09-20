import type {
  ExerciseAttemptResult,
  GradingPort,
  ProgressPort,
  PrimmExecutionResult,
} from "@pieai/university-core";
import {
  readPersonalJson,
  PERSONAL_STUDY_ID,
  personalContentId,
  personalAccountScope,
  withPersonalSignal,
} from "./api.js";

export function createPersonalGradingPort(base: GradingPort, progress: ProgressPort): GradingPort {
  return {
    ...base,
    async executePrimm(input, signal) {
      if (input.lessonRef.studyId !== PERSONAL_STUDY_ID)
        return (
          base.executePrimm?.(input, signal) ??
          Promise.reject(new Error("PRIMM execution is unavailable"))
        );
      const account = personalAccountScope();
      const result = await withPersonalSignal(signal, (nativeSignal) =>
        readPersonalJson<PrimmExecutionResult>("/run", account, {
          method: "POST",
          signal: nativeSignal,
          body: JSON.stringify({ contentId: personalContentId(input.lessonRef.courseId), input }),
        }),
      );
      if (
        signal?.aborted ||
        personalAccountScope() !== account ||
        result.kind !== "live" ||
        result.prompt !== input.prompt ||
        !result.requestId ||
        !result.text?.trim()
      )
        throw new Error("The execution could not be verified");
      return result;
    },
    async submitExercise(input): Promise<ExerciseAttemptResult> {
      if (input.locator.studyId !== PERSONAL_STUDY_ID) return base.submitExercise(input);
      const account = personalAccountScope();
      const result = await withPersonalSignal(input.signal, (signal) =>
        readPersonalJson<ExerciseAttemptResult>("/grade", account, {
          method: "POST",
          signal,
          body: JSON.stringify({
            contentId: personalContentId(input.locator.courseId),
            grade: {
              locator: input.locator,
              contentRevision: input.contentRevision,
              exerciseId: input.exerciseId,
              commandId: input.commandId,
              answer: input.answer,
            },
          }),
        }),
      );
      if (input.signal?.aborted || personalAccountScope() !== account)
        throw new Error("Account changed; no result was written");
      if (
        !result.hostGrade ||
        result.hostGrade.learnerAnswer !== input.answer ||
        !["pass", "fail", "undecided"].includes(result.hostGrade.outcome ?? "")
      )
        throw new Error("The assessment could not be verified");
      progress.recordExerciseAttempt({
        commandId: input.commandId,
        locator: input.locator,
        exerciseId: input.exerciseId,
        contentRevision: input.contentRevision,
        answer: input.answer,
        score: result.score,
        maxScore: result.maxScore,
        hostGrade: result.hostGrade ?? null,
        occurredAt: result.hostGrade?.occurredAt ?? new Date().toISOString(),
      });
      return { ...result, answerStored: progress.localSaveState?.() === "saved" };
    },
  };
}
