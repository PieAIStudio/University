/**
 * Pedagogical rules for a three-option choice exercise, as a result rather
 * than an exception.
 *
 * Zod describes the shape and throws when a stored record is the wrong shape.
 * Authoring needs the opposite: every problem on one draft, in a form a UI
 * can point at, with no try/catch. The four checks here are the ones that
 * make the type teach — a two-option question, a correct id that is not on
 * the list, two options sharing an id, or an option with nothing to say when
 * it is picked, each silently turns this back into "wrong, try again".
 */

/** Exactly three. Fewer is a true/false; more is a list, and neither is this. */
export const CHOICE_OPTION_COUNT = 3;

export type ChoiceExerciseIssueCode =
  | "option-count"
  | "unknown-correct-id"
  | "duplicate-option-id"
  | "missing-explanation";

export interface ChoiceExerciseIssue {
  readonly code: ChoiceExerciseIssueCode;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export type ChoiceExerciseValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly ChoiceExerciseIssue[] };

/**
 * The slice the checks actually read. Wider than the stored schema so a draft
 * missing an explanation can be reported instead of rejected by the parser
 * before this function runs.
 */
export interface ChoiceExerciseDraft {
  readonly options: unknown;
  readonly correctOptionId: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptions(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (isRecord(item) ? item : {}));
}

function optionIdOf(option: Record<string, unknown>): string {
  return typeof option.id === "string" ? option.id : "";
}

function hasExplanation(option: Record<string, unknown>): boolean {
  return typeof option.explanation === "string" && option.explanation.trim().length > 0;
}

export function validateChoiceExercise(input: ChoiceExerciseDraft): ChoiceExerciseValidation {
  const errors: ChoiceExerciseIssue[] = [];
  const rawLength = Array.isArray(input.options) ? input.options.length : 0;
  const options = asOptions(input.options);

  if (rawLength !== CHOICE_OPTION_COUNT) {
    errors.push({
      code: "option-count",
      message: `A choice exercise must have exactly ${CHOICE_OPTION_COUNT} options, not ${rawLength}.`,
      path: ["options"],
    });
  }

  const seen = new Map<string, number>();
  for (const [index, option] of options.entries()) {
    const id = optionIdOf(option);
    const previous = seen.get(id);
    if (id !== "" && previous !== undefined) {
      errors.push({
        code: "duplicate-option-id",
        message: `Option ids must be unique; "${id}" is used more than once.`,
        path: ["options", index, "id"],
      });
    } else if (id !== "") {
      seen.set(id, index);
    }

    if (!hasExplanation(option)) {
      errors.push({
        code: "missing-explanation",
        message:
          id === ""
            ? `Every option needs an explanation written for that option; options[${index}] has none.`
            : `Every option needs an explanation written for that option; "${id}" has none.`,
        path: ["options", index, "explanation"],
      });
    }
  }

  const correctOptionId = typeof input.correctOptionId === "string" ? input.correctOptionId : "";
  if (correctOptionId === "" || !seen.has(correctOptionId)) {
    errors.push({
      code: "unknown-correct-id",
      message: "correctOptionId must be the id of one of the options.",
      path: ["correctOptionId"],
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
