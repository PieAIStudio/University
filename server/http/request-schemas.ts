import { z } from "zod";

import { IsoDateTime, StableId } from "../../src/domain/schemas.js";

const CommandId = z.string().uuid();
const Answer = z.string().trim().min(1).max(20_000);
const ExerciseAttemptSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    answer: Answer,
    /**
     * Rubric points the learner claims their written answer covered. Present
     * only for `explain` exercises, which have no reference string to compare
     * against; the learner grades themselves against the rubric after writing.
     */
    met: z.array(z.number().int().nonnegative()).optional(),
  })
  .strict();
const LessonCompletionSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
  })
  .strict();
const VOCABULARY_DUE_LIMIT = 50;
const VocabularyPresentedSchema = z
  .object({
    studyId: StableId,
    lessonId: StableId,
    senseIds: z.array(z.string().min(1).max(200)).min(1).max(64),
  })
  .strict();
const VocabularyStageSchema = z
  .object({
    // `candidate` is absent on purpose: it means "never touched", and once a
    // learner has said something about a word there is no honest way back to it.
    stage: z.enum(["learning", "familiar", "stable", "paused"]),
  })
  .strict();
const VocabularyGradeSchema = z
  .object({ rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) })
  .strict();
const CardRevealSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    answer: Answer,
    startedAt: IsoDateTime,
    usedHint: z.literal(false),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
const CardReviewSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();

/**
 * A passage the reader marked. The quote is capped well above what anyone
 * selects deliberately and well below "the whole lesson", so a stray
 * triple-click cannot turn a note into a copy of the page.
 */
const ReaderMarkSchema = z
  .object({
    contentRevision: z.number().int().positive(),
    kind: z.enum(["question", "highlight"]),
    exact: z.string().trim().min(1).max(600),
    prefix: z.string().max(200).default(""),
    suffix: z.string().max(200).default(""),
    sectionTitle: z.string().max(200).optional(),
    note: z.string().max(2_000).optional(),
  })
  .strict();

export {
  ExerciseAttemptSchema,
  LessonCompletionSchema,
  ReaderMarkSchema,
  VOCABULARY_DUE_LIMIT,
  VocabularyPresentedSchema,
  VocabularyStageSchema,
  VocabularyGradeSchema,
  CardRevealSchema,
  CardReviewSchema,
};
