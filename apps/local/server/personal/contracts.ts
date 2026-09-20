import { z } from "zod";

import { StableId } from "@pieai/university-core/domain/schemas.js";

export const PersonalScopeSchema = z
  .object({
    studyId: StableId,
    courseId: StableId,
    unitId: StableId,
    lessonIds: z.array(StableId).min(1).max(8),
  })
  .strict();

export const PersonalLocaleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    connection: z.string().trim().min(1).max(1_000),
    situation: z.string().trim().min(1).max(1_000),
    need: z.string().trim().min(1).max(1_000),
    prompt: z.string().trim().min(1).max(2_000),
    practiceText: z.string().trim().min(20).max(2_000),
    makeText: z.string().trim().min(20).max(2_000),
    investigateExplanation: z.string().trim().min(1).max(2_000),
    investigateCards: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(800),
            bucket: z.enum(["grounded", "check"]),
            why: z.string().trim().min(1).max(800),
          })
          .strict(),
      )
      .min(4)
      .max(6),
    modifyGoal: z.string().trim().min(1).max(1_000),
    makeScenario: z.string().trim().min(1).max(2_000),
    makeGoal: z.string().trim().min(1).max(1_000),
    checklist: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
    exerciseTitle: z.string().trim().min(1).max(200),
    exercisePrompt: z.string().trim().min(1).max(2_000),
    rubric: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
    cardFront: z.string().trim().min(1).max(200),
    cardBack: z.string().trim().min(1).max(1_000),
    predictQuestion: z.string().trim().min(1).max(1_000).optional(),
    predictOptions: z.array(z.string().trim().min(1).max(300)).min(2).max(4).optional(),
    runTitle: z.string().trim().min(1).max(200).optional(),
    runNote: z.string().trim().min(1).max(2_000).optional(),
    investigateTitle: z.string().trim().min(1).max(200).optional(),
    investigateBrief: z.string().trim().min(1).max(2_000).optional(),
    modifyTitle: z.string().trim().min(1).max(200).optional(),
    modifyBrief: z.string().trim().min(1).max(2_000).optional(),
    modifyPieces: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(200),
            text: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .min(2)
      .max(4)
      .optional(),
    makeTitle: z.string().trim().min(1).max(200).optional(),
    makePlaceholder: z.string().trim().min(1).max(500).optional(),
    finishTitle: z.string().trim().min(1).max(200).optional(),
    finishNote: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

const CoveredDraftSchema = z
  .object({
    covered: z.literal(true),
    sourceIndex: z.number().int().nonnegative().max(7),
    zh: PersonalLocaleSchema,
    en: PersonalLocaleSchema,
  })
  .strict();

export const PersonalDraftSchema = z.discriminatedUnion("covered", [
  CoveredDraftSchema,
  z
    .object({ covered: z.literal(false), unsupportedReason: z.string().trim().min(1).max(500) })
    .strict(),
]);

export const PersonalReviewSchema = z
  .object({
    passed: z.boolean(),
    issues: z.array(z.string().min(1).max(700)).max(8),
  })
  .strict();

export const PersonalDraftJsonSchema = z.toJSONSchema(PersonalDraftSchema);
export const PersonalReviewJsonSchema = z.toJSONSchema(PersonalReviewSchema);

export const PersonalCreateRequestSchema = z
  .object({
    commandId: z.string().uuid(),
    accountScope: z.string().trim().min(2).max(200),
    locale: z.enum(["zh-CN", "en"]),
    goal: z.string().trim().min(8).max(600),
    scope: PersonalScopeSchema,
  })
  .strict();

export type PersonalCreateRequest = z.infer<typeof PersonalCreateRequestSchema>;
export type PersonalDraft = z.infer<typeof CoveredDraftSchema>;
