/**
 * The delivery shell's GradingPort: tier one, in the browser, no clipboard.
 *
 * The honesty from the previous delivery-only quiz stays: a sentence the
 * fingerprint cannot judge is not marked wrong, and a clue is a sentence the
 * learner already read, never the answer.
 */
import {
  gradeDeterministically,
  type AnswerKey,
  type GradingPort,
  type HostExerciseGrade,
  type ProgressPort,
} from "@pieai/university-core";

import { isRepositoryAnchor } from "../content/library";
import type { Lesson } from "../content/library";
import { normalise } from "../lesson/grading";

export function createOnlineGradingPort(options: {
  readonly lesson: Lesson;
  readonly onPass: () => void;
  readonly progress?: ProgressPort;
}): GradingPort {
  const { lesson, onPass, progress } = options;
  const attempts = new Map<string, number>();

  return {
    async submitExercise(input) {
      const exercise = lesson.exercises.find((item) => item.id === input.exerciseId);
      const count = (attempts.get(input.exerciseId) ?? 0) + 1;
      attempts.set(input.exerciseId, count);
      const verdict = gradeDeterministically(
        input.answer,
        exercise?.answerKey as AnswerKey | undefined,
      );
      const occurredAt = new Date().toISOString();

      if (verdict.outcome === "pass") {
        const hostGrade: HostExerciseGrade = {
          passed: true,
          evaluation: "答对了。",
          extensions: [],
          host: "tier-1",
          learnerAnswer: input.answer,
          occurredAt,
        };
        const result = {
          correct: false,
          attemptCount: count,
          score: 1,
          maxScore: 1,
          awaitingHostGrade: false,
          hostGrade,
        };
        progress?.recordExerciseAttempt({
          commandId: input.commandId,
          locator: input.locator,
          exerciseId: input.exerciseId,
          contentRevision: input.contentRevision,
          answer: input.answer,
          score: result.score,
          maxScore: result.maxScore,
          hostGrade,
          occurredAt,
        });
        onPass();
        return result;
      }

      const evaluation =
        verdict.outcome === "undecided" ? verdict.reason : failCopy(lesson, exercise?.prompt);
      const hostGrade: HostExerciseGrade = {
        passed: false,
        evaluation,
        extensions: [],
        host: "tier-1",
        learnerAnswer: input.answer,
        occurredAt,
      };
      const result = {
        correct: false,
        attemptCount: count,
        score: 0,
        maxScore: 1,
        awaitingHostGrade: false,
        hostGrade,
      };
      progress?.recordExerciseAttempt({
        commandId: input.commandId,
        locator: input.locator,
        exerciseId: input.exerciseId,
        contentRevision: input.contentRevision,
        answer: input.answer,
        score: result.score,
        maxScore: result.maxScore,
        hostGrade,
        occurredAt,
      });
      return result;
    },
  };
}

/**
 * A clue, not a verdict. Anchoring on the question's own words finds the
 * passage the question came from, which is what a learner who missed actually
 * needs to re-read. A clue built from the answer was a step away from printing
 * it, and the answer is not available here any more — and should not be.
 */
function failCopy(lesson: Lesson, prompt: string | undefined): string {
  if (!prompt) return "再想一下，答案就在上面这段里。";
  const needle = normalise(prompt).slice(0, 5);
  const line = lesson.content
    .split(/\n+/)
    .find((row) => row.includes(needle) && !row.startsWith("```") && row.length > 12);
  if (!line) return "再想一下，答案就在上面这段里。";
  const quoted = line.replace(/[*`]/g, "").trim();
  /*
    「出自真实项目」 is a claim about a repository, so it is only offered when
    one of this lesson's citations actually is one. A 通用课 cites MDN; naming
    a file and a line range it never had would be the wrong kind of confident.
  */
  const evidence = lesson.evidence.find(isRepositoryAnchor);
  const source = evidence
    ? `\n\n出自真实项目：${evidence.sourcePath} 第 ${evidence.lineStart}–${evidence.lineEnd} 行`
    : "";
  return `再看一眼你刚才读过的这句：\n\n> ${quoted}${source}`;
}
