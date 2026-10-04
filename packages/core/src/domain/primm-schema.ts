import { z } from "zod";

/** Inject the existing source/ID schemas: no second citation contract or schema cycle. */
export function createPrimmPayloadSchema<S extends z.ZodType>(source: S, id: z.ZodString) {
  const copy = z.string().trim().min(1).max(2_000);
  const text = z.string().trim().min(1).max(20_000);
  const operation = z.enum(["vision", "text", "transcribe", "audio-text", "source-search"]);
  const inputs = { materialIds: z.array(id).max(20), assetIds: z.array(id).max(20), operation };
  const label = z.object({ id, label: copy }).strict();
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
  // A 你知道吗 line: real-world, one of the lesson's own sources.
  const aside = z.object({ text: copy, sourceId: id }).strict();
  const finish = z
    .object({
      title: copy,
      note: copy,
      didYouKnow: aside.optional(),
      // One thing to do today, outside the lesson.
      today: copy.optional(),
    })
    .strict();
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
        // Absent when the lesson has nothing to attach (a text-only request).
        attachmentLabel: copy.optional(),
        // Shown while the request runs; the one real-world line of Run.
        wait: aside.optional(),
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
        // Said on a wrong pairing, instead of the generic line.
        miss: copy.optional(),
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
        // A wrong side says `miss` and the card stays until it goes right.
        cards: z
          .array(
            z.object({ id, text: copy, bucketId: id, why: copy, miss: copy.optional() }).strict(),
          )
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
        // Said when pieces are missing or out of order.
        hint: copy.optional(),
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
  return steps;
}
