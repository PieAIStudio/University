import { z } from "zod";

import {
  EvidenceReferenceSchema,
  LessonActivitySchema,
  LessonVariantSchema,
  StableId,
} from "@pieai/university-core/domain/schemas.js";
import {
  writeCardRevision,
  writeExerciseRevision,
  writeLessonRevision,
} from "../content/repository.js";
import { validateTargetEvidence, type TargetIdentity } from "./revise-course.js";

/**
 * The shape of a lesson that does not exist yet, and the code that puts one on
 * disk. Two workflows need exactly this: `course create` builds a whole course
 * out of these, and `course add-lessons` appends them to a course that is
 * already published. Keeping one definition means a rule added here — like the
 * cards-need-an-exercise refinement below — cannot be true of one entry point
 * and false of the other.
 */

const CardCreationProposalSchema = z
  .object({
    id: StableId,
    kind: z.enum(["basic", "cloze"]).optional(),
    front: z.string().min(1).max(20_000),
    back: z.string().min(1).max(20_000),
    tags: z.array(StableId).optional(),
    evidence: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

const ExerciseCreationBaseSchema = z.object({
  id: StableId,
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(20_000),
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

const ExerciseCreationProposalSchema = z.union([
  ExerciseCreationBaseSchema.extend({
    kind: z.literal("short-answer").optional(),
    expectedAnswer: z.string().min(1),
  }).strict(),
  ExerciseCreationBaseSchema.extend({
    kind: z.literal("explain"),
    rubric: z.array(z.string().min(1)).min(1),
  }).strict(),
]);

export const LessonCreationProposalSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    /**
     * Which of the five teaching shapes this lesson is written in.
     *
     * The manifest has always been able to hold it; the creation proposal could
     * not express it, so a lesson born through this workflow arrived without
     * one — and `scripts/lint-lessons.mjs` skips a lesson with no variant on
     * purpose, treating it as pre-dating the shapes. The result was that a
     * brand-new course, written in the house shape from revision 1, was the one
     * thing the shape checker never looked at.
     */
    variant: LessonVariantSchema.optional(),
    /**
     * Interactive courseware the lesson embeds, referenced from its prose by
     * `::play{#id}`.
     *
     * Same defect as `variant` above, one field over, and found the same way:
     * the manifest has always been able to hold activities and `course revise`
     * has always been able to send them, but this schema is `.strict()` and did
     * not name them — so a lesson could not be born with one. Every activity
     * that has shipped was bolted on afterwards by a revision whose only
     * purpose was to carry it, which means a brand-new lesson's revision 1 was
     * guaranteed to be a version of itself with the game missing.
     *
     * `sections` and `assets` are still in that state. They are left alone here
     * rather than fixed on the way past, because nobody has yet needed to be
     * born with one and a fix nobody exercises is a fix nobody has checked.
     *
     * ## Required, not defaulted
     *
     * It was `.default([])`, and the writing skill said 「默认是不配」 — a
     * lesson had to argue its way into having a game. Fifteen of 469 lessons
     * ended up with one. Three per cent is not a rule being applied carefully;
     * it is a rule that decided the answer, and what it decided was that this
     * product ships pages of text.
     *
     * So the default is inverted rather than softened. A lesson cannot be born
     * without something for the reader to do, and an author who genuinely
     * cannot find a shape has to say so in the agent report instead of letting
     * the field quietly stay empty. The cap stays at three and the guidance
     * stays at one — two games in one small lesson spends the reader's
     * attention on learning the second game — but the floor is now one.
     *
     * The 454 lessons that predate this keep working: this schema governs
     * creation, and nothing revalidates a stored manifest through it.
     * `lint-lessons.mjs` is where those are counted, behind a dated cutoff.
     */
    activities: z.array(LessonActivitySchema).min(1).max(3),
    evidence: z.array(EvidenceReferenceSchema).min(1),
    cards: z.array(CardCreationProposalSchema).default([]),
    exercises: z.array(ExerciseCreationProposalSchema).default([]),
  })
  .strict()
  /**
   * Cards enter the spaced-repetition queue when their lesson is completed, and
   * a lesson is completed by answering its exercises. A lesson that carries
   * cards but no exercises can therefore never be completed, so those cards are
   * written to disk and never scheduled — silently invisible work. Refuse the
   * shape rather than let the course look finished while part of it is inert.
   */
  /**
   * An activity the prose never hands the reader to is one the reader never
   * meets.
   *
   * This mattered less when activities were optional and rare: an author who
   * went to the trouble of writing one generally remembered to point at it.
   * Now that every lesson must carry one, the cheapest way to satisfy that is
   * to attach a payload and move on — and the result renders as nothing at all,
   * which is indistinguishable from the lesson simply not having one.
   *
   * `check-lesson-activities.mjs` checks both directions across the whole
   * shelf, and will keep doing so. This is the same rule one boundary earlier,
   * where the author is still in the room to fix it.
   */
  .refine(
    (lesson) =>
      lesson.activities.every((activity) => lesson.content.includes(`::play{#${activity.id}}`)),
    {
      message:
        "Every activity must be referenced from the lesson prose as ::play{#id}; an unreferenced activity renders as nothing",
      path: ["activities"],
    },
  )
  .refine((lesson) => lesson.cards.length === 0 || lesson.exercises.length > 0, {
    message:
      "A lesson with cards needs at least one exercise; cards are only enrolled for review once the lesson is completed",
    path: ["exercises"],
  });

type LessonCreationProposal = z.infer<typeof LessonCreationProposalSchema>;

/** Every ID a lesson brings with it, for uniqueness checks and result reporting. */
interface LessonProposalIds {
  readonly lessonId: string;
  readonly cardIds: readonly string[];
  readonly exerciseIds: readonly string[];
}

export function collectLessonIds(lesson: LessonCreationProposal): LessonProposalIds {
  return {
    lessonId: lesson.id,
    cardIds: lesson.cards.map((card) => card.id),
    exerciseIds: lesson.exercises.map((exercise) => exercise.id),
  };
}

/** Checks the lesson and everything under it against the target snapshot. */
export function validateLessonEvidence(
  studiesRoot: string,
  studyId: string,
  lesson: LessonCreationProposal,
  /** Null in a study with no repository; only URL citations survive then. */
  target: TargetIdentity | null,
): void {
  validateTargetEvidence(studiesRoot, studyId, lesson.evidence, target, `Lesson ${lesson.id}`);
  for (const card of lesson.cards) {
    validateTargetEvidence(studiesRoot, studyId, card.evidence, target, `Card ${card.id}`);
  }
  for (const exercise of lesson.exercises) {
    validateTargetEvidence(
      studiesRoot,
      studyId,
      exercise.evidence,
      target,
      `Exercise ${exercise.id}`,
    );
  }
}

interface WriteLessonBundleInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lesson: LessonCreationProposal;
  readonly timestamp: string;
}

/**
 * Writes a lesson and its cards and exercises at revision 1. The unit must
 * already declare the lesson: content is never written before the thing that
 * points at it, so every reader can walk course → unit → lesson → card without
 * meeting a reference that leads nowhere.
 */
export function writeLessonBundle(input: WriteLessonBundleInput): LessonProposalIds {
  const { studiesRoot, studyId, courseId, unitId, lesson, timestamp } = input;
  writeLessonRevision(studiesRoot, studyId, {
    manifest: {
      schemaVersion: 1,
      id: lesson.id,
      title: lesson.title,
      courseId,
      unitId,
      exerciseIds: lesson.exercises.map((exercise) => exercise.id),
      cardIds: lesson.cards.map((card) => card.id),
      contentRevision: 1,
      status: "active",
      ...(lesson.variant ? { variant: lesson.variant } : {}),
      activities: lesson.activities,
      evidence: lesson.evidence,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    content: lesson.content,
  });
  for (const card of lesson.cards) {
    writeCardRevision(studiesRoot, studyId, {
      schemaVersion: 1,
      id: card.id,
      kind: card.kind ?? "basic",
      courseId,
      unitId,
      lessonId: lesson.id,
      front: card.front,
      back: card.back,
      contentRevision: 1,
      status: "active",
      tags: card.tags ?? [],
      evidence: card.evidence,
    });
  }
  for (const exercise of lesson.exercises) {
    const base = {
      schemaVersion: 1 as const,
      id: exercise.id,
      courseId,
      unitId,
      lessonId: lesson.id,
      title: exercise.title,
      prompt: exercise.prompt,
      contentRevision: 1,
      status: "active" as const,
      evidence: exercise.evidence,
    };
    writeExerciseRevision(
      studiesRoot,
      studyId,
      "rubric" in exercise
        ? { ...base, kind: "explain", rubric: exercise.rubric }
        : { ...base, kind: "short-answer", expectedAnswer: exercise.expectedAnswer },
    );
  }
  return collectLessonIds(lesson);
}
