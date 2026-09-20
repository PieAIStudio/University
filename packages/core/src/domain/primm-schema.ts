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
  const intro = z
    .object({
      situation: copy,
      need: copy,
      connection: copy,
      sourceIds: z.array(id).max(4).optional(),
    })
    .strict();
  const sources = z
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
    .max(20);
  const materials = z
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
    .max(20);
  const prompt = z
    .string()
    .min(1)
    .max(2_000)
    .refine((value) => !!value.trim());
  // Authored starter text is localized as one exact prepared input. Runtime user text is never translated.
  const starter = z.object({ prompt, ...inputs }).strict();
  const make = z
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
    .strict();
  const finish = z.object({ title: copy, note: copy }).strict();
  const region = z
    .object({
      id,
      label: copy,
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })
    .strict();
  // One screen, one action. A step belongs to exactly one phase; which steps a
  // phase holds, and how many, is the lesson's choice (see primmStepIssues).
  const phase = z.enum(["predict", "run", "investigate", "modify", "make"]);
  const after = copy.optional();
  const step = z.discriminatedUnion("kind", [
    // A choice. In Predict it is a way of using AI, optionally tied to a request
    // that Run then really sends; with answerId it is a checked choice.
    z
      .object({
        kind: z.literal("choose"),
        id,
        phase,
        title: copy,
        options: z
          .array(z.object({ id, label: copy, requestId: id.optional(), after }).strict())
          .min(2)
          .max(4),
        answerId: id.optional(),
        after,
      })
      .strict(),
    // Attach the prepared input and really run a request: the one chosen in
    // Predict, the one built in Modify, or an authored request.
    z
      .object({
        kind: z.literal("send"),
        id,
        phase: z.enum(["run", "modify"]),
        title: copy,
        request: id,
        attachmentLabel: copy,
        debriefs: z
          .array(z.object({ requestId: id, text: copy }).strict())
          .max(4)
          .optional(),
        after,
      })
      .strict(),
    // Tap the sentence of the latest live result that mentions the terms. Both
    // outcomes are authored: the lesson never assumes what this run contains.
    z
      .object({
        kind: z.literal("find"),
        id,
        phase: z.enum(["run", "investigate", "modify"]),
        title: copy,
        terms: z.array(copy).min(1).max(6),
        found: copy,
        absent: copy,
      })
      .strict(),
    // Really run the other requests, then match each live answer to its request.
    z
      .object({
        kind: z.literal("match"),
        id,
        phase: z.literal("investigate"),
        title: copy,
        requestIds: z.array(id).min(2).max(4),
        after: copy,
      })
      .strict(),
    z
      .object({
        kind: z.literal("sort"),
        id,
        phase: z.enum(["predict", "investigate", "modify"]),
        title: copy,
        buckets: z.array(label).min(2).max(4),
        cards: z
          .array(z.object({ id, text: copy, bucketId: id, why: copy }).strict())
          .min(3)
          .max(10),
        after: copy,
      })
      .strict(),
    // Point at the part of the photo that settles the question yourself.
    z
      .object({
        kind: z.literal("point"),
        id,
        phase,
        title: copy,
        assetId: id,
        regions: z.array(region).min(1).max(8),
        targetId: id,
        miss: copy,
        after: copy,
      })
      .strict(),
    // Assemble a request from pieces; distractors say why they do not belong.
    z
      .object({
        kind: z.literal("build"),
        id,
        phase: z.literal("modify"),
        title: copy,
        context: copy.optional(),
        pieces: z
          .array(z.object({ id, text: copy, why: copy.optional() }).strict())
          .min(2)
          .max(8),
        answers: z.array(z.array(id).min(1).max(8)).min(1).max(4),
        after: copy,
      })
      .strict(),
    // The independent task, configured by the payload's make block.
    z.object({ kind: z.literal("make"), id, phase: z.literal("make"), title: copy }).strict(),
  ]);
  const steps = z.object({
    method: z.literal("PRIMM"),
    experienceVersion: z.literal(3),
    intro,
    sources,
    materials,
    starter,
    // Further prepared requests the learner may really run with the starter's inputs.
    requests: z.array(z.object({ id, prompt }).strict()).max(6).optional(),
    steps: z.array(step).min(5).max(20),
    make,
    finish,
  });
  const classic = z.object({
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
  return z.union([steps, classic]);
}
