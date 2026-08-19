import { readFileSync } from "node:fs";

import { z } from "zod";

import { LanguageAnchorSchema, StableId } from "../../src/domain/schemas.js";
import { loadLexicon } from "../language/lexicon.js";
import { writeLanguageOverlay } from "../language/overlay.js";

export const LanguageOverlayProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    language: z.literal("en").default("en"),
    lessons: z
      .array(
        z
          .object({
            courseId: StableId,
            unitId: StableId,
            lessonId: StableId,
            anchors: z.array(LanguageAnchorSchema).min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

interface AnnotateLanguageReceipt {
  readonly schemaVersion: 1;
  readonly operation: "language-annotate";
  readonly studyId: string;
  readonly lessons: readonly {
    readonly lessonId: string;
    readonly contentRevision: number;
    readonly placed: number;
    readonly rejected: readonly { readonly senseId: string; readonly reason: string }[];
  }[];
}

/**
 * Applies an English layer to lessons that already exist.
 *
 * Every sense is checked against the lexicon before anything is written. An
 * anchor pointing at a sense nobody wrote would render as plain text with a
 * button that opens nothing — the kind of failure that looks like a styling bug
 * for a week before somebody traces it back to a typo in a proposal.
 */
export function annotateLanguage(input: {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly inputPath: string;
  readonly now?: Date;
}): AnnotateLanguageReceipt {
  const proposal = LanguageOverlayProposalSchema.parse(
    JSON.parse(readFileSync(input.inputPath, "utf8")) as unknown,
  );
  const lexicon = loadLexicon();
  const unknown = [
    ...new Set(
      proposal.lessons.flatMap((lesson) =>
        lesson.anchors.map((anchor) => anchor.senseId).filter((senseId) => !lexicon.has(senseId)),
      ),
    ),
  ].sort();
  if (unknown.length > 0) {
    throw new Error(`词表里没有这些词义：${unknown.join(", ")}`);
  }

  return {
    schemaVersion: 1,
    operation: "language-annotate",
    studyId: input.studyId,
    lessons: proposal.lessons.map((lesson) => {
      const receipt = writeLanguageOverlay({
        studiesRoot: input.studiesRoot,
        studyId: input.studyId,
        language: proposal.language,
        courseId: lesson.courseId,
        unitId: lesson.unitId,
        lessonId: lesson.lessonId,
        anchors: lesson.anchors,
        ...(input.now === undefined ? {} : { now: input.now }),
      });
      return {
        lessonId: lesson.lessonId,
        contentRevision: receipt.overlay.contentRevision,
        placed: receipt.placed,
        rejected: receipt.rejected,
      };
    }),
  };
}
