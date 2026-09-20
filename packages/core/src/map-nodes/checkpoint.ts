import {
  judgeSkipAnswer,
  skipTestCandidates,
  type SkipTestCandidate,
} from "../progress/skip-test.js";
import {
  fingerprint,
  normalise,
  normaliseKeepingSymbols,
  type AnswerKey,
} from "../grading/answer-key.js";

export interface CheckpointLesson {
  readonly id: string;
  readonly title: string;
  readonly contentRevision: number;
  readonly exercises: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly answerKey?: AnswerKey;
    readonly options?: readonly { readonly id: string; readonly text: string }[];
  }[];
}

export interface CheckpointQuestion extends SkipTestCandidate {
  readonly lessonTitle: string;
  readonly contentRevision: number;
}

export interface CheckpointPlan {
  readonly questions: readonly CheckpointQuestion[];
  readonly unavailable: readonly { readonly lessonId: string; readonly title: string }[];
  readonly fingerprint: string;
}

/** A translated option label can exceed the twelve-character fact heuristic.
 * A question explicitly asking to copy one of its quoted options is still
 * closed-ended. Accept only a uniquely fingerprint-matched visible option;
 * do not make arbitrary long prose answers eligible for automatic proof. */
function closedCopyCandidate(
  lessonId: string,
  exercise: CheckpointLesson["exercises"][number],
): SkipTestCandidate | null {
  if (!exercise.answerKey || !/(?:please copy one option|请抄写一个选项)/iu.test(exercise.prompt))
    return null;
  // Only the explicit A-or-B pair is a choice. Other quoted text in the
  // scenario is context, not an invented third answer option.
  const pairs = [
    ...exercise.prompt.matchAll(
      /["“]([^"”\n]{1,120})["”]\s*(?:or|或|还是)\s*["“]([^"”\n]{1,120})["”]/giu,
    ),
  ];
  if (pairs.length !== 1) return null;
  const options = [pairs[0]![1]!, pairs[0]![2]!];
  if (new Set(options.map(normalise)).size !== options.length) return null;
  if (
    options.filter((text) => judgeCheckpointAnswer(text, exercise.answerKey!) === "correct")
      .length !== 1
  )
    return null;
  return {
    lessonId,
    exerciseId: exercise.id,
    prompt: exercise.prompt.replace(
      /\s*(?:please copy one option|请抄写一个选项)[.!。]?\s*$/iu,
      "",
    ),
    answerKey: exercise.answerKey,
    // Labels are submitted verbatim; original exact grading remains the owner.
    // No separate answer bank or rewritten course content is introduced.
    options: options.map((text) => ({ id: text, text })),
  };
}

/** Full exercise coverage for each selected lesson, using native free graders.
 * Missing or open-ended assessment is not a licence to infer a pass. */
export function planCheckpoint(lessons: readonly CheckpointLesson[]): CheckpointPlan {
  const questions: CheckpointQuestion[] = [];
  const unavailable: { lessonId: string; title: string }[] = [];
  for (const lesson of lessons) {
    const native = skipTestCandidates([lesson]);
    const candidates = lesson.exercises.flatMap((exercise) => {
      const candidate =
        closedCopyCandidate(lesson.id, exercise) ??
        native.find((item) => item.exerciseId === exercise.id);
      return candidate ? [candidate] : [];
    });
    if (!lesson.exercises.length || candidates.length !== lesson.exercises.length) {
      unavailable.push({ lessonId: lesson.id, title: lesson.title });
      continue;
    }
    for (const candidate of candidates) {
      questions.push({
        ...candidate,
        lessonTitle: lesson.title,
        contentRevision: lesson.contentRevision,
      });
    }
  }
  return {
    questions,
    unavailable,
    fingerprint: JSON.stringify(
      lessons.map((lesson) => [lesson.id, lesson.contentRevision, lesson.exercises]),
    ),
  };
}

export interface CheckpointAnswer {
  readonly lessonId: string;
  readonly exerciseId: string;
  readonly answer: string;
}

/** Checkpoints request one short answer. The lesson grader's substring leniency
 * must not let a list of contradictory guesses prove a whole lesson. */
export function judgeCheckpointAnswer(answer: string, key: AnswerKey) {
  if (!answer.trim()) return "unanswered" as const;
  if (key.match === "option-id") return judgeSkipAnswer(answer, key);
  const exact = normalise(answer);
  const symbols = normaliseKeepingSymbols(answer);
  return (exact.length === key.len && key.len > 0 && fingerprint(exact) === key.fp) ||
    (key.symLen !== undefined &&
      key.symLen > 0 &&
      symbols.length === key.symLen &&
      fingerprint(symbols) === key.symFp)
    ? ("correct" as const)
    : ("wrong" as const);
}

/** Settle only a complete sitting and only lessons actually covered. Partial
 * proof is explicit; an untested lesson cannot inherit neighbouring success. */
export function settleCheckpoint(plan: CheckpointPlan, answers: readonly CheckpointAnswer[]) {
  const keys = answers.map((answer) => `${answer.lessonId}/${answer.exerciseId}`);
  if (answers.length !== plan.questions.length || new Set(keys).size !== keys.length) return null;
  const verdicts = plan.questions.map((question) => {
    const answer = answers.find(
      (value) => value.lessonId === question.lessonId && value.exerciseId === question.exerciseId,
    );
    return {
      lessonId: question.lessonId,
      verdict: answer ? judgeCheckpointAnswer(answer.answer, question.answerKey) : "unanswered",
    };
  });
  if (!verdicts.length || verdicts.some((item) => item.verdict === "unanswered")) return null;
  const failed = new Set(
    verdicts.filter((item) => item.verdict === "wrong").map((item) => item.lessonId),
  );
  const covered = [...new Set(plan.questions.map((question) => question.lessonId))];
  return {
    proven: covered.filter((id) => !failed.has(id)),
    needsPractice: covered.filter((id) => failed.has(id)),
    untested: plan.unavailable.map((item) => item.lessonId),
    complete: failed.size === 0 && plan.unavailable.length === 0,
    revisions: Object.fromEntries(
      plan.questions.map((question) => [question.lessonId, question.contentRevision]),
    ),
  };
}
