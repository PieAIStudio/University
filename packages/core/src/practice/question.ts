import { validateChoiceExercise, type ChoiceExerciseIssue } from "../domain/choice-exercise.js";
import type { ChoiceExercise } from "../domain/schemas.js";
import type { StructuredEntry } from "../domain/structured-entry.js";

/**
 * The quiz half of a practice question: the same three-option judgement the
 * entry page already carries, without the lesson/course fields that belong to
 * authored exercises. Picking these fields off `ChoiceExercise` is the point —
 * a parallel option type would be a second corpus.
 */
export type PracticeExercise = Pick<ChoiceExercise, "prompt" | "options" | "correctOptionId">;

/**
 * The two halves of a practice question id.
 *
 * Called `PracticeSubject` rather than `PracticeEntry` because the entry is
 * already a `StructuredEntry`; this type is only the coordinates the id is
 * built from. The lexicon stores those as `track` + `senseId`, concepts as
 * `category` + `id`. Practice names the job, not those columns, so it never
 * imports a catalogue head — a question whose identity is not these two
 * fields would be a second bank.
 *
 * `category` is the grouping half of VibeHub's `<category>-<slug>` keys, not
 * `CollectionId`. `collection` already means `terms` | `concepts` |
 * `anti-patterns` on `StructuredEntry`, and using it here would collide those
 * two meanings and rewrite every existing id (`technical-app.program` becoming
 * `terms-app.program`).
 */
export interface PracticeSubject {
  readonly category: string;
  readonly id: string;
}

/**
 * A practice question is a structured entry plus that entry's own choice
 * exercise.
 *
 * There is no question table and no free-form question id. Identity is the
 * subject's category plus its slug, the same shape as VibeHub's
 * `frontend-statistic` keys, which is how you can tell the bank *is* the
 * per-entry quiz rather than a second list that happens to mention entries.
 */
export interface PracticeQuestion<Head = unknown> {
  readonly subject: PracticeSubject;
  readonly entry: StructuredEntry<Head>;
  readonly exercise: PracticeExercise;
}

export type PracticeIssueCode = ChoiceExerciseIssue["code"] | "missing-prompt" | "missing-text";

export interface PracticeIssue {
  readonly code: PracticeIssueCode;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export type PracticeAssembly<Head = unknown> =
  | { readonly ok: true; readonly question: PracticeQuestion<Head> }
  | { readonly ok: false; readonly errors: readonly PracticeIssue[] };

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
 * Concatenating the two halves here, rather than accepting a finished id from
 * the caller, is what makes a question-without-an-entry unrepresentable. The
 * caller still supplies the halves — heads did not agree on field names, and
 * reading `track` or `senseId` here would pull the lexicon back in.
 */
export function practiceQuestionIdFromSubject(subject: PracticeSubject): string {
  return `${subject.category}-${subject.id}`;
}

export function idOfPracticeQuestion(question: PracticeQuestion): string {
  return practiceQuestionIdFromSubject(question.subject);
}

function readOptions(value: unknown): PracticeExercise["options"] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: optionField(item, "id"),
    text: optionField(item, "text"),
    explanation: optionField(item, "explanation"),
  }));
}

/**
 * Attach a three-option exercise to an entry, or return every reason not to.
 *
 * Pedagogical shape is `validateChoiceExercise`'s job; this function only adds
 * the prompt and the situation-text that a stemless or noun-definition option
 * would otherwise smuggle through. `subject` is passed in because only the
 * caller knows which head fields are the category and the slug.
 */
export function assemblePracticeQuestion<Head>(
  entry: StructuredEntry<Head>,
  exercise: {
    readonly prompt: unknown;
    readonly options: unknown;
    readonly correctOptionId: unknown;
  },
  subject: PracticeSubject,
): PracticeAssembly<Head> {
  const errors: PracticeIssue[] = [];
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
      subject,
      entry,
      exercise: {
        prompt,
        options,
        correctOptionId,
      },
    },
  };
}

/**
 * First-seen order, keyed by the derived id. A second quiz for the same
 * subject is the same question, so it does not mint a second row.
 */
export function indexPracticeQuestions<Head = unknown>(
  questions: readonly PracticeQuestion<Head>[],
): {
  readonly ids: readonly string[];
  readonly byId: ReadonlyMap<string, PracticeQuestion<Head>>;
} {
  const byId = new Map<string, PracticeQuestion<Head>>();
  const ids: string[] = [];
  for (const question of questions) {
    const id = idOfPracticeQuestion(question);
    if (byId.has(id)) continue;
    byId.set(id, question);
    ids.push(id);
  }
  return { ids, byId };
}
