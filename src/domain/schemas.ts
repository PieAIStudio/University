import { z } from "zod";

export const SchemaVersion = z.literal(1);
export const StableId = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const Sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const GitCommit = z.string().regex(/^[a-f0-9]{40}$/);
export const GitTree = z.string().regex(/^[a-f0-9]{40}$/);
export const IsoDateTime = z.string().datetime({ offset: true });

/**
 * What the learner is working through right now. The shelf can hold more than
 * one study, and without this "今日学习" simply picks whichever incomplete
 * lesson it meets first — an order that has nothing to do with what the learner
 * has decided to focus on.
 *
 * It only reorders which lesson is offered next. Due cards keep coming from
 * every study, because a card is something already learned and forgetting it
 * while focused elsewhere is exactly what spaced repetition exists to prevent.
 */
export const LearningFocusSchema = z
  .object({
    studyId: StableId,
    // An ordered run, not a single pin. What a learner focuses on is usually a
    // sequence — finish the zero-basics tier, then the formal courses — and a
    // single course would hand them back to alphabetical order the moment they
    // finished it.
    courseIds: z.array(StableId).default([]),
  })
  .strict();

export const UniversityLocalConfigSchema = z
  .object({
    schemaVersion: SchemaVersion,
    studiesRoot: z.string().min(1),
    focus: LearningFocusSchema.optional(),
  })
  .strict();

export const StudyManifestSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    title: z.string().min(1).max(160),
    description: z.string().max(2_000).default(""),
    goals: z.array(z.string().min(1).max(500)).default([]),
    defaultCourseId: StableId.nullable().default(null),
    status: z.enum(["active", "archived"]).default("active"),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict();

export const SourceRegistrationSchema = z
  .object({
    schemaVersion: SchemaVersion,
    kind: z.literal("local-git"),
    sourceRoot: z.string().min(1),
    defaultRef: z.string().min(1).max(256).default("HEAD"),
    registeredAt: IsoDateTime,
  })
  .strict();

export const RepositoryRelativePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value.includes("//") &&
      value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "Path must be a normalized repository-relative path",
  );

export const UaEngineProvenanceSchema = z
  .object({
    source: z.enum(["user-skill-local-git", "claude-plugin-local-git"]),
    revision: GitCommit,
    contentHash: Sha256,
    dirty: z.boolean(),
    entryPath: RepositoryRelativePath,
  })
  .strict();

const CleanSnapshotSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    mode: z.literal("clean"),
    sourceCommit: GitCommit,
    sourceTree: GitTree,
    createdAt: IsoDateTime,
    status: z.literal("ready"),
    toolVersion: z.string().min(1),
    excludedPaths: z.array(RepositoryRelativePath).default([]),
    submodulePaths: z.array(RepositoryRelativePath).default([]),
    lfsPaths: z.array(RepositoryRelativePath).default([]),
  })
  .strict();

export const SnapshotManifestSchema = CleanSnapshotSchema;

const UaAnalysisBaseSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    engine: z.literal("understand-anything"),
    engineVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    snapshotId: StableId,
    sourceCommit: GitCommit,
    outputLanguage: z.string().min(2).max(16),
    configHash: Sha256,
    // Optional so manifests created before engine provenance was introduced remain readable.
    engineProvenance: UaEngineProvenanceSchema.optional(),
    createdAt: IsoDateTime,
  })
  .strict();

export const UaAnalysisManifestSchema = z.discriminatedUnion("status", [
  UaAnalysisBaseSchema.extend({
    status: z.literal("preparing"),
  }).strict(),
  UaAnalysisBaseSchema.extend({
    status: z.literal("failed"),
    failure: z.string().min(1).max(4_000),
    completedAt: IsoDateTime,
  }).strict(),
  UaAnalysisBaseSchema.extend({
    status: z.enum(["ready", "legacy-import"]),
    graphHash: Sha256,
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    completedAt: IsoDateTime,
  }).strict(),
  UaAnalysisBaseSchema.extend({
    status: z.literal("superseded"),
    graphHash: Sha256,
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    completedAt: IsoDateTime,
    supersededAt: IsoDateTime,
    supersededBy: StableId.nullable(),
    supersededReason: z.string().min(1).max(1_000),
  }).strict(),
]);

export const ContentStatus = z.enum(["draft", "active", "stale", "retired"]);
export const EvidenceKind = z.enum(["fact", "inference"]);

export const EvidenceReferenceSchema = z
  .object({
    kind: EvidenceKind,
    snapshotId: StableId,
    sourceCommit: GitCommit,
    sourcePath: RepositoryRelativePath,
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    analysisId: StableId.optional(),
    graphHash: Sha256.optional(),
    nodeIds: z.array(z.string().min(1)).default([]),
    note: z.string().max(1_000).optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.lineStart && evidence.lineEnd && evidence.lineEnd < evidence.lineStart) {
      context.addIssue({
        code: "custom",
        message: "lineEnd must be greater than or equal to lineStart",
        path: ["lineEnd"],
      });
    }
    const uaFields = [evidence.analysisId, evidence.graphHash];
    if (uaFields.some(Boolean) && uaFields.some((value) => !value)) {
      context.addIssue({
        code: "custom",
        message: "analysisId and graphHash must be supplied together",
        path: ["analysisId"],
      });
    }
    if (evidence.nodeIds.length > 0 && !evidence.analysisId) {
      context.addIssue({
        code: "custom",
        message: "nodeIds require an analysisId and graphHash binding",
        path: ["nodeIds"],
      });
    }
    if (evidence.analysisId && evidence.nodeIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "UA-backed evidence must reference at least one nodeId",
        path: ["nodeIds"],
      });
    }
  });

export const CourseManifestSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    title: z.string().min(1).max(200),
    description: z.string().max(2_000).default(""),
    audience: z.string().min(1).max(500),
    objectives: z.array(z.string().min(1).max(500)).min(1),
    unitIds: z.array(StableId),
    status: ContentStatus,
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict();

export const UnitManifestSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    title: z.string().min(1).max(200),
    objective: z.string().min(1).max(1_000),
    prerequisiteUnitIds: z.array(StableId).default([]),
    lessonIds: z.array(StableId),
    status: ContentStatus,
  })
  .strict();

export const LessonManifestSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    title: z.string().min(1).max(200),
    courseId: StableId,
    unitId: StableId,
    exerciseIds: z.array(StableId).default([]),
    cardIds: z.array(StableId).default([]),
    contentRevision: z.number().int().positive(),
    contentHash: Sha256,
    status: ContentStatus,
    evidence: z.array(EvidenceReferenceSchema).min(1),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict();

const PracticeBaseSchema = z.object({
  schemaVersion: SchemaVersion,
  id: StableId,
  title: z.string().min(1).max(200),
  courseId: StableId,
  unitId: StableId,
  lessonId: StableId,
  prompt: z.string().min(1).max(20_000),
  contentRevision: z.number().int().positive(),
  contentHash: Sha256,
  status: ContentStatus,
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

export const ExerciseSchema = z.discriminatedUnion("kind", [
  PracticeBaseSchema.extend({
    kind: z.literal("short-answer"),
    expectedAnswer: z.string().min(1),
  }).strict(),
  PracticeBaseSchema.extend({
    kind: z.literal("explain"),
    rubric: z.array(z.string().min(1)).min(1),
  }).strict(),
]);

export const CardContentSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    kind: z.enum(["basic", "cloze"]),
    courseId: StableId,
    unitId: StableId,
    lessonId: StableId,
    front: z.string().min(1).max(20_000),
    back: z.string().min(1).max(20_000),
    contentRevision: z.number().int().positive(),
    contentHash: Sha256,
    status: ContentStatus,
    tags: z.array(StableId).default([]),
    evidence: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

export const KnowledgeClaimType = z.enum(["source-fact", "inference", "personal-understanding"]);

export const KnowledgeOriginSchema = z
  .object({
    kind: z.enum(["ai-conversation", "source-refresh"]),
    host: z.string().trim().min(1).max(100),
    capturedAt: IsoDateTime,
    sessionId: z.string().trim().min(1).max(256).optional(),
    captureId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  })
  .strict();

export const KnowledgeCardSchema = z
  .object({
    id: StableId,
    kind: z.literal("basic"),
    front: z.string().trim().min(1).max(20_000),
    back: z.string().trim().min(1).max(20_000),
    tags: z.array(StableId).default([]),
  })
  .strict()
  .superRefine((card, context) => {
    if (new Set(card.tags).size !== card.tags.length) {
      context.addIssue({
        code: "custom",
        message: "Knowledge card tags must not contain duplicate IDs",
        path: ["tags"],
      });
    }
  });

export const KnowledgeNoteSchema = z
  .object({
    schemaVersion: SchemaVersion,
    id: StableId,
    title: z.string().trim().min(1).max(200),
    question: z.string().trim().min(1).max(2_000),
    summary: z.string().trim().min(1).max(10_000),
    claimType: KnowledgeClaimType,
    status: ContentStatus,
    contentRevision: z.number().int().positive(),
    contentHash: Sha256,
    tags: z.array(StableId).default([]),
    evidence: z.array(EvidenceReferenceSchema).default([]),
    origin: KnowledgeOriginSchema,
    // Keep schema v1 readable for notes created before the capture workflow adopted a 3-card limit.
    cards: z.array(KnowledgeCardSchema).default([]),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((note, context) => {
    if (new Set(note.tags).size !== note.tags.length) {
      context.addIssue({
        code: "custom",
        message: "Knowledge note tags must not contain duplicate IDs",
        path: ["tags"],
      });
    }
    const cardIds = note.cards.map((card) => card.id);
    if (new Set(cardIds).size !== cardIds.length) {
      context.addIssue({
        code: "custom",
        message: "Knowledge note cards must not contain duplicate IDs",
        path: ["cards"],
      });
    }
    if (new Date(note.updatedAt).getTime() < new Date(note.createdAt).getTime()) {
      context.addIssue({
        code: "custom",
        message: "updatedAt must not be earlier than createdAt",
        path: ["updatedAt"],
      });
    }
    if (
      note.status === "active" &&
      note.claimType !== "personal-understanding" &&
      note.evidence.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: `Active ${note.claimType} knowledge requires source evidence`,
        path: ["evidence"],
      });
    }
    if (
      note.claimType === "source-fact" &&
      note.evidence.some((reference) => reference.kind !== "fact")
    ) {
      context.addIssue({
        code: "custom",
        message: "source-fact knowledge may only use fact evidence references",
        path: ["evidence"],
      });
    }
  });

export type UniversityLocalConfig = z.infer<typeof UniversityLocalConfigSchema>;
export type LearningFocus = z.infer<typeof LearningFocusSchema>;
export type StudyManifest = z.infer<typeof StudyManifestSchema>;
export type SourceRegistration = z.infer<typeof SourceRegistrationSchema>;
export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;
export type UaAnalysisManifest = z.infer<typeof UaAnalysisManifestSchema>;
export type UaEngineProvenance = z.infer<typeof UaEngineProvenanceSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
export type CourseManifest = z.infer<typeof CourseManifestSchema>;
export type UnitManifest = z.infer<typeof UnitManifestSchema>;
export type LessonManifest = z.infer<typeof LessonManifestSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type CardContent = z.infer<typeof CardContentSchema>;
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimType>;
export type KnowledgeOrigin = z.infer<typeof KnowledgeOriginSchema>;
export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>;
export type KnowledgeNote = z.infer<typeof KnowledgeNoteSchema>;
