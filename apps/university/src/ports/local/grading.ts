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

    async meteredGradingOffer(): Promise<MeteredGradingOffer> {
      return {
        kind: "unavailable",
        costPowerUnits: METERED_COST,
        availablePowerUnits: null,
        explanation: {
          kind: "explanation",
          title: "这端使用本机 AI 宿主",
          whatItDoes: "在线学习里的 AI 语义批改会先展示费用和余额，再由你决定是否使用计量服务。",
          whyUnavailable:
            "当前是 authoring 工作台；开放题会交给本机 AI 宿主，不在这里连接线上计量钱包。",
          futureSupport: "切到 delivery 学习端并登录后，页面会显示线上服务的费用、余额和选择。",
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
