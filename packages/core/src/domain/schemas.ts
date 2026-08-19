import { z } from "zod";

const SchemaVersion = z.literal(1);
export const StableId = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const Sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const GitCommit = z.string().regex(/^[a-f0-9]{40}$/);
const GitTree = z.string().regex(/^[a-f0-9]{40}$/);
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

/**
 * The identity card of an airlock: a sealed, read-only checkout of a repository
 * that also happens to be this project, kept outside the project so that
 * studying it needs no exception to the source/studies separation guard.
 *
 * Everything here exists to answer one question before an analysis runs: is the
 * directory in front of me still the thing I promoted? A path alone cannot
 * answer that — a path can be deleted and refilled with another repository. So
 * the seal pins the upstream's canonical location, its Git directory, and its
 * object format, and refuses to proceed when any of them has moved.
 */
export const AirlockSealSchema = z
  .object({
    schemaVersion: SchemaVersion,
    airlockRoot: z.string().min(1),
    upstream: z
      .object({
        root: z.string().min(1),
        /** Resolved `.git` directory. Diagnostic only — see `rootCommit`. */
        commonDir: z.string().min(1),
        /**
         * The root commit of the promoted history: the one identifier that
         * survives renames and does not come back the same when a directory is
         * deleted and refilled with a different project. `null` only when the
         * upstream history is shallow enough to have no reachable root.
         */
        rootCommit: GitCommit.nullable(),
        objectFormat: z.enum(["sha1", "sha256"]),
      })
      .strict(),
    allowedRef: z.string().min(1).max(256),
    promotedCommit: GitCommit,
    promotedTree: GitCommit,
    /** What the airlock held before this promotion; `null` on the first one. */
    previousCommit: GitCommit.nullable(),
    promotedAt: IsoDateTime,
    toolVersion: z.string().min(1).max(32),
    /** Proof that the import gate ran, and what it saw. */
    scan: z
      .object({
        trackedFileCount: z.number().int().nonnegative(),
        largestBlobBytes: z.number().int().nonnegative(),
        /** Dirty upstream paths deliberately left out of this promotion. */
        excludedDirtyPaths: z.array(z.string().min(1)).max(2000),
      })
      .strict(),
  })
  .strict();

export type AirlockSeal = z.infer<typeof AirlockSealSchema>;

/**
 * One English word placed at one exact spot in one exact lesson revision.
 *
 * `quote` is the Chinese text being annotated and `occurrence` says which
 * appearance of it, counting from one. That pair is a position, and it is a
 * stable position only because lesson revisions are immutable: the overlay
 * records the `contentHash` it was written against, so a match proves the text
 * is byte-identical and the anchor cannot have drifted. A mismatch is not a
 * repair job — it means this revision has not been annotated yet.
 */
export const LanguageAnchorSchema = z
  .object({
    quote: z.string().min(1).max(200),
    occurrence: z.number().int().positive(),
    senseId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/, "sense id must be lowercase dotted-kebab"),
  })
  .strict();

/**
 * The English layer for one lesson revision.
 *
 * It is stored beside the study's courses rather than inside them, and the
 * lesson's own bytes never change. That is the whole design: turning English
 * mode on, off, or up must not produce a new `contentRevision`, because
 * completion and review scheduling are scoped to the revision they were earned
 * on — a lesson that gains a revision goes back to unfinished, and with host
 * grading that costs a full round trip to an assistant to earn back.
 */
export const LanguageOverlaySchema = z
  .object({
    schemaVersion: SchemaVersion,
    language: z.literal("en"),
    courseId: StableId,
    unitId: StableId,
    lessonId: StableId,
    contentRevision: z.number().int().positive(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    anchors: z.array(LanguageAnchorSchema).max(200),
    updatedAt: IsoDateTime,
  })
  .strict();

export type LanguageAnchor = z.infer<typeof LanguageAnchorSchema>;
export type LanguageOverlay = z.infer<typeof LanguageOverlaySchema>;

/**
 * What a learner sees when they tap an annotated word.
 *
 * A sense, not a word: `commit` in Git and `commit` in a database are different
 * things to learn, and a single gloss per spelling would teach the wrong one
 * roughly half the time.
 */
export const LexiconEntrySchema = z
  .object({
    senseId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/),
    headword: z.string().min(1).max(80),
    /** IPA. Shown even when no local voice is available to speak it. */
    phonetic: z.string().min(1).max(80),
    partOfSpeech: z.string().min(1).max(32),
    /** One meaning, in this context. Not a dictionary dump. */
    gloss: z.string().min(1).max(200),
    /** Where this sense comes up in real work, so the word has somewhere to live. */
    usage: z.string().min(1).max(300),
    track: z.enum(["technical", "general"]),
  })
  .strict();

export type LexiconEntry = z.infer<typeof LexiconEntrySchema>;

const RepositoryRelativePath = z
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
const EvidenceKind = z.enum(["fact", "inference"]);

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

/**
 * Whether a course is supposed to keep up with the repository or to stay where
 * it is.
 *
 * `follow-ref` is the normal case: the course teaches the current state of the
 * code, so when the cited files move underneath it the audit marks it stale and
 * someone revises it. `pinned-history` is a course that is *about* a past state
 * on purpose — how a bug looked before it was fixed, what the architecture was
 * before a migration. Marking that stale is not a warning, it is a false alarm
 * that never goes away, because the thing it points at is finished changing.
 *
 * The distinction has to be recorded rather than inferred. From the outside a
 * pinned course and a neglected course look identical: both cite an old commit.
 * Only the author knows which one it is.
 */
export const CourseCurrency = z.enum(["follow-ref", "pinned-history"]);

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
    currency: CourseCurrency.default("follow-ref"),
    prerequisiteCourseIds: z.array(StableId).default([]),
    /**
     * The named path this course belongs to, when it belongs to one.
     *
     * Prerequisites say what must come before a course. They cannot say that
     * nine particular courses are *one route* a learner picks a starting point
     * on — that is an authoring intention, and until it is written down a
     * consumer can only guess it. The guess that prompted this field was a
     * course-id prefix match in the delivery product, which works today and
     * breaks silently the first time a course is renamed or a tenth is added.
     *
     * Free-form rather than an enum on purpose. A track is a name this study's
     * author chose, and the next study will want names this one never needed.
     */
    trackId: StableId.nullable().default(null),
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

/**
 * The five teaching shapes a lesson can be written in.
 *
 * Shared because two schemas need the same list: the manifest on disk, and the
 * proposal a course-creation workflow accepts. They drifted once — the manifest
 * could hold a variant that no proposal could supply, so a lesson created
 * through the workflow silently arrived without one and the shape checker,
 * which skips variant-less lessons by design, never looked at it.
 */
export const LessonVariantSchema = z.enum(["现象", "对比", "溯源", "决策", "术语"]);

export const LessonSectionSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
  })
  .strict();

export const LessonAssetKindSchema = z.enum([
  "real-screenshot",
  "authorized-external",
  "diagram",
  "ai-illustration",
  "screen-recording",
]);

const LessonAssetSourceSchema = z
  .object({
    sourceUrl: z.string().url().optional(),
    license: z.string().min(1).max(500).optional(),
    attribution: z.string().min(1).max(1_000).optional(),
    aiNote: z.string().min(1).max(1_000).optional(),
  })
  .strict();

const LessonAssetCaptureSchema = z
  .object({
    sourceCommit: GitCommit,
    route: z.string().min(1).max(500),
    state: z.string().min(1).max(1_000),
    viewport: z
      .object({ width: z.number().int().positive(), height: z.number().int().positive() })
      .strict(),
    locale: z.string().min(2).max(32),
    captureRecipe: z.string().min(1).max(2_000),
    capturedAt: IsoDateTime,
  })
  .strict();

export const LessonAssetSchema = z
  .object({
    id: StableId,
    kind: LessonAssetKindSchema,
    path: RepositoryRelativePath,
    sha256: Sha256,
    mime: z.enum([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
    ]),
    bytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationMs: z.number().int().positive().optional(),
    alt: z.string().min(1).max(500),
    caption: z.string().max(1_000).optional(),
    posterAssetId: StableId.optional(),
    subtitlesPath: RepositoryRelativePath.optional(),
    transcript: z.string().max(50_000).optional(),
    source: LessonAssetSourceSchema.optional(),
    capture: LessonAssetCaptureSchema.optional(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.kind === "real-screenshot" && !asset.capture) {
      context.addIssue({ code: "custom", message: "Real screenshots require capture provenance" });
    }
    if (asset.kind === "ai-illustration" && !asset.source?.aiNote) {
      context.addIssue({ code: "custom", message: "AI illustrations require a visible AI note" });
    }
    if (asset.kind === "screen-recording" && !asset.durationMs) {
      context.addIssue({ code: "custom", message: "Screen recordings require durationMs" });
    }
  });

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
    sections: z.array(LessonSectionSchema).max(100).default([]),
    assets: z.array(LessonAssetSchema).max(100).default([]),
    /**
     * Which teaching shape this lesson uses. Metadata about the lesson, so it
     * lives here rather than in the prose: an authoring marker inside
     * `content.md` is a marker the reader can see — react-markdown renders a
     * raw HTML comment as text, and stripping it before parsing would shift
     * every character offset the language and link layers depend on.
     *
     * Optional because 475 lessons predate the shapes.
     */
    variant: LessonVariantSchema.optional(),
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

const KnowledgeClaimType = z.enum(["source-fact", "inference", "personal-understanding"]);

const KnowledgeOriginSchema = z
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
/**
 * What a caller has to supply to write a course, as opposed to what it gets
 * back. Fields with defaults — `currency` — are optional going in and settled
 * coming out, so writers built before a default existed keep compiling.
 */
export type CourseManifestInput = z.input<typeof CourseManifestSchema>;
export type UnitManifest = z.infer<typeof UnitManifestSchema>;
export type LessonManifest = z.infer<typeof LessonManifestSchema>;
export type LessonSection = z.infer<typeof LessonSectionSchema>;
export type LessonAsset = z.infer<typeof LessonAssetSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type CardContent = z.infer<typeof CardContentSchema>;
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimType>;
export type KnowledgeOrigin = z.infer<typeof KnowledgeOriginSchema>;
export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>;
export type KnowledgeNote = z.infer<typeof KnowledgeNoteSchema>;
