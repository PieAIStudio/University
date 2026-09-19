import { z } from "zod";

/** Inject the existing source/ID schemas: no second citation contract or schema cycle. */
export function createPrimmPayloadSchema<S extends z.ZodType>(source: S, id: z.ZodString) {
  const copy = z.string().trim().min(1).max(2_000);
  const text = z.string().trim().min(1).max(20_000);
  const operation = z.enum(["vision", "text", "transcribe", "audio-text", "source-search"]);
  const inputs = { materialIds: z.array(id).max(20), assetIds: z.array(id).max(20), operation };
  const label = z.object({ id, label: copy }).strict();
  const game = z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("inspect-image"),
        assetId: id,
        instruction: copy,
        regions: z
          .array(
            z
              .object({
                id,
                label: copy,
                x: z.number().min(0).max(1),
                y: z.number().min(0).max(1),
                width: z.number().positive().max(1),
                height: z.number().positive().max(1),
                note: copy,
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
    z
      .object({
        kind: z.literal("sort"),
        buckets: z.array(label).min(2).max(8),
        cards: z
          .array(z.object({ id, text, bucketId: id, why: copy }).strict())
          .min(2)
          .max(30),
      })
      .strict(),
    z
      .object({
        kind: z.literal("layout"),
        instruction: copy,
        items: z
          .array(z.object({ id, label: copy, text }).strict())
          .min(2)
          .max(20),
        formats: z.array(label).min(2).max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("edit"),
        targetId: id,
        instruction: copy,
        replacementHint: copy,
        sentences: z.array(z.object({ id, text }).strict()).min(2).max(20),
      })
      .strict(),
    // Compare the actual run result with the material, item by item. The learner
    // judges; the lesson shows what the material said. It never claims to know
    // what this live result contains.
    z
      .object({
        kind: z.literal("check-result"),
        instruction: copy,
        items: z
          .array(z.object({ id, label: copy, expected: copy, why: copy }).strict())
          .min(2)
          .max(8),
      })
      .strict(),
    z
      .object({
        kind: z.literal("collect"),
        instruction: copy,
        cards: z
          .array(
            z
              .object({ id, label: copy, text, sourceId: id, relevant: z.boolean(), why: copy })
              .strict(),
          )
          .min(2)
          .max(30),
      })
      .strict(),
  ]);
  return z.object({
    method: z.literal("PRIMM"),
    experienceVersion: z.literal(2).optional(),
    intro: z
      .object({
        situation: copy,
        need: copy,
        connection: copy,
        sourceIds: z.array(id).max(4).optional(),
      })
      .strict(),
    sources: z
      .array(
        z
          .object({
            id,
            reference: source,
            note: copy,
            summary: copy.optional(),
            limitation: copy.optional(),
            date: copy.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    materials: z
      .array(
        z
          .object({
            id,
            sourceId: id.optional(),
            label: copy,
            text,
            kind: z.enum(["source-summary", "teaching-draft", "practice"]),
            assetId: id.optional(),
          })
          .strict()
          .refine(
            (material) => material.kind === "practice" || !!material.sourceId,
            "Real-source materials require their source identity",
          ),
      )
      .min(1)
      .max(20),
    // Authored starter text is localized as one exact prepared input. Runtime user text is never translated.
    starter: z
      .object({
        prompt: z
          .string()
          .min(1)
          .max(2_000)
          .refine((value) => !!value.trim()),
        ...inputs,
      })
      .strict(),
    predict: z.object({ question: copy, options: z.array(label).min(2).max(4) }).strict(),
    // Debriefs appear only after an actual result exists: the teacher reconciles
    // prediction and result. They must stay true for any plausible live output.
    run: z
      .object({
        title: copy,
        note: copy,
        attachmentLabel: copy.optional(),
        debrief: copy.optional(),
      })
      .strict(),
    investigate: z
      .object({
        title: copy,
        brief: copy,
        explanation: copy,
        more: z
          .array(z.object({ question: copy, answer: copy }).strict())
          .max(10)
          .optional(),
        game,
      })
      .strict(),
    modify: z
      .object({
        title: copy,
        brief: copy,
        goal: copy,
        suggestion: copy.optional(),
        debrief: copy.optional(),
        operation: operation.optional(),
        workbench: z
          .object({
            instruction: copy,
            pieces: z
              .array(z.object({ id, label: copy, text: copy }).strict())
              .min(2)
              .max(8),
            carryObservation: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    make: z
      .object({
        title: copy,
        scenario: copy,
        goal: copy,
        ...inputs,
        promptPlaceholder: copy,
        checklist: z.array(copy).min(1).max(12),
        exerciseId: id,
        artifactLabel: copy.optional(),
      })
      .strict(),
    finish: z.object({ title: copy, note: copy }).strict(),
  });
}
