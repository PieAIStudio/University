import { validateChoiceExercise, type ChoiceExerciseIssue } from "../domain/choice-exercise.js";
import type { ChoiceExercise, LexiconEntry } from "../domain/schemas.js";
import type { TermEntry } from "../domain/structured-entry.js";

/**
 * The quiz half of a practice question: the same three-option judgement the
 * term page already carries, without the lesson/course fields that belong to
 * authored exercises. Picking these fields off `ChoiceExercise` is the point —
 * a parallel option type would be a second corpus.
 */
export type TermPracticeExercise = Pick<ChoiceExercise, "prompt" | "options" | "correctOptionId">;

/**
 * A practice question is a term plus that term's own choice exercise.
 *
 * There is no question table and no free-form question id. Identity is the
 * term's category (`track`) plus its sense id, the same shape as VibeHub's
 * `frontend-statistic` keys, which is how you can tell the bank *is* the
 * per-term quiz rather than a second list that happens to mention terms.
 */
export interface TermPracticeQuestion {
  readonly term: TermEntry;
  readonly exercise: TermPracticeExercise;
}

export type TermPracticeIssueCode = ChoiceExerciseIssue["code"] | "missing-prompt" | "missing-text";

export interface TermPracticeIssue {
  readonly code: TermPracticeIssueCode;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export type TermPracticeAssembly =
  | { readonly ok: true; readonly question: TermPracticeQuestion }
  | { readonly ok: false; readonly errors: readonly TermPracticeIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionField(value: unknown, key: "id" | "text" | "explanation"): string {
  if (!isRecord(value)) return "";
  const field = value[key];
  return typeof field === "string" ? field : "";
}

/**
 * Build the id VibeHub stored in `vibehub.practice.recent.v1`.
 *
 * `track` is this product's category; `senseId` is the term slug. Concatenating
 * them here, rather than accepting an id from the caller, is what makes a
 * question-without-a-term unrepresentable.
 */
export function practiceQuestionIdFromHead(head: Pick<LexiconEntry, "track" | "senseId">): string {
  return `${head.track}-${head.senseId}`;
}

export function idOfPracticeQuestion(question: TermPracticeQuestion): string {
  return practiceQuestionIdFromHead(question.term.head);
}

function readOptions(value: unknown): TermPracticeExercise["options"] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: optionField(item, "id"),
    text: optionField(item, "text"),
    explanation: optionField(item, "explanation"),
  }));
}

/**
 * Attach a three-option exercise to a term, or return every reason not to.
 *
 * Pedagogical shape is `validateChoiceExercise`'s job; this function only adds
 * the prompt and the situation-text that a stemless or noun-definition option
 * would otherwise smuggle through.
 */
export function assembleTermPracticeQuestion(
  term: TermEntry,
  exercise: {
    readonly prompt: unknown;
    readonly options: unknown;
    readonly correctOptionId: unknown;
  },
): TermPracticeAssembly {
  const errors: TermPracticeIssue[] = [];
  const prompt = typeof exercise.prompt === "string" ? exercise.prompt.trim() : "";
  if (prompt.length === 0) {
    errors.push({
      code: "missing-prompt",
      message:
        "A practice question needs a work-situation prompt; an empty stem is not a judgement.",
      path: ["prompt"],
    });
  }

  const choice = validateChoiceExercise(exercise);
  if (!choice.ok) errors.push(...choice.errors);

  const options = readOptions(exercise.options);
  for (const [index, option] of options.entries()) {
    if (option.text.trim().length === 0) {
      errors.push({
        code: "missing-text",
        message:
          option.id === ""
            ? `Every option needs a situation to choose; options[${index}] has none.`
            : `Every option needs a situation to choose; "${option.id}" has none.`,
        path: ["options", index, "text"],
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const correctOptionId =
    typeof exercise.correctOptionId === "string" ? exercise.correctOptionId : "";

  return {
    ok: true,
    question: {
      term,
      exercise: {
        prompt,
        options,
        correctOptionId,
      },
    },
  };
}

/**
 * First-seen order, keyed by the derived id. A second quiz for the same term
 * is the same question, so it does not mint a second row.
 */
export function indexPracticeQuestions(questions: readonly TermPracticeQuestion[]): {
  readonly ids: readonly string[];
  readonly byId: ReadonlyMap<string, TermPracticeQuestion>;
} {
  const byId = new Map<string, TermPracticeQuestion>();
  const ids: string[] = [];
  for (const question of questions) {
    const id = idOfPracticeQuestion(question);
    if (byId.has(id)) continue;
    byId.set(id, question);
    ids.push(id);
  }
  return { ids, byId };
}
