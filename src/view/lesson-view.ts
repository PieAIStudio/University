import type {
  EvidenceAnchorRange,
  LanguageLayer,
  LessonLinkRange,
  LessonLinkTarget,
} from "../domain/lesson-marks.js";

/**
 * The shapes the API returns, and the pure functions that turn them into what
 * the screen shows.
 *
 * Nothing here touches React. Wire marks (`LanguageLayer`, lesson/evidence
 * ranges) live in `src/domain/lesson-marks` so the browser view layer and the
 * server share one shape without either importing a renderer. This module is
 * still browser-only: it owns composition of those marks into screen models,
 * and every symbol in it is exercised directly by `App.test.tsx` rather than
 * through a rendered component tree.
 */

export interface DefaultCourseSummary {
  readonly id: string;
  readonly title: string;
  readonly status: "draft" | "active" | "stale" | "retired";
}

/**
 * What a study *is* — the fields `/api/studies/:id` actually returns.
 *
 * Split out from `StudySummary` because the two endpoints genuinely disagree
 * about what a study is, and pretending otherwise cost real pixels: the study
 * page typed its identity object as the full summary and read `snapshotCount`
 * off it, which the detail endpoint has never sent. React renders `undefined`
 * as nothing, so the counters shipped blank — a defect no type check could
 * catch, because the lie was told at an HTTP boundary where nothing is checked.
 */
export interface StudyIdentity {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly goals: readonly string[];
  readonly defaultCourseId: string | null;
}

/** A study plus everything the shelf counts about it. Only `/api/bootstrap` sends this. */
export interface StudySummary extends StudyIdentity {
  readonly sourceRegistered: boolean;
  readonly snapshotCount: number;
  readonly uaAnalysisCount: number;
  readonly readyUaAnalysisCount: number;
  readonly courseCount: number;
  readonly activeCourseCount: number;
  readonly defaultCourse: DefaultCourseSummary | null;
  readonly hasLearningDatabase: boolean;
  /** Last time anything was reviewed, answered, or completed here; null if never. */
  readonly lastActivityAt: string | null;
}

export interface LessonLocator {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

export interface CourseReviewCardLocator extends LessonLocator {
  readonly kind: "course-card";
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
}

export interface KnowledgeReviewCardLocator {
  readonly kind: "knowledge-card";
  readonly studyId: string;
  readonly noteId: string;
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
}

export type ReviewCardLocator = CourseReviewCardLocator | KnowledgeReviewCardLocator;

export type TodayCard = ReviewCardLocator & {
  readonly dueAt: string;
};

export interface NextLesson extends LessonLocator {
  readonly studyTitle: string;
  readonly courseTitle: string;
  readonly lessonTitle: string;
  readonly contentRevision: number;
  readonly progress: LessonProgress | null;
}

export interface BootstrapData {
  readonly product: "UniversityLocal";
  readonly requestToken: string;
  readonly studiesRoot: string;
  readonly studies: readonly StudySummary[];
  readonly shelfIssues: readonly string[];
  readonly today: {
    readonly dueCount: number;
    readonly card: TodayCard | null;
    readonly nextLesson: NextLesson | null;
    readonly focus: LearningFocus | null;
    readonly issues: readonly string[];
  };
}

export interface LearningFocus {
  readonly studyId: string;
  readonly courseIds: readonly string[];
}

/**
 * Prefers human titles, but never hides a focus that points at nothing. A long
 * run is summarised by where it starts and how long the pinned route is — not
 * the study's total course count (that lives on the shelf).
 */
export function focusLabel(focus: LearningFocus, studies: readonly StudySummary[]): string {
  const study = studies.find((candidate) => candidate.id === focus.studyId);
  const studyLabel = study?.title ?? `${focus.studyId}（不在书架上）`;
  const [head, ...rest] = focus.courseIds;
  if (!head) return studyLabel;
  return rest.length === 0
    ? `${studyLabel} · ${head}`
    : `${studyLabel} · ${head} 起 · 主攻路线 ${focus.courseIds.length} 门`;
}

export interface LessonProgress {
  readonly contentRevision: number;
  readonly status: "not-started" | "in-progress" | "completed";
  readonly progress: number;
  readonly updatedAt: string;
  readonly readConfirmed: boolean;
}

export interface LessonSectionView {
  readonly id: string;
  readonly title: string;
}

/**
 * `contentRevision` is the revision the lesson is on now. Progress earned on an
 * earlier revision is real history but not current standing: the lesson's cards
 * are re-enrolled for review only when it is completed again, so calling it
 * "已完成" would hide the one action that puts the cards back in the queue.
 */
export function progressLabel(progress: LessonProgress | null, contentRevision?: number): string {
  if (!progress) return "尚未开始";
  const stale = contentRevision !== undefined && progress.contentRevision !== contentRevision;
  if (stale) return "课文有新版 · 待阅读确认";
  if (progress.status === "completed" && progress.readConfirmed) return "已完成";
  if (progress.readConfirmed) return "课文已确认 · 练习待完成";
  return `进行中 · ${Math.round(progress.progress * 100)}%`;
}

export function isCurrentLessonCompleted(
  progress: LessonProgress | null,
  contentRevision: number,
): boolean {
  return Boolean(
    progress?.readConfirmed &&
    progress.status === "completed" &&
    progress.contentRevision === contentRevision,
  );
}

interface LessonSummary {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly contentRevision: number;
  readonly cardCount: number;
  readonly exerciseCount: number;
  readonly progress: LessonProgress | null;
}

export interface UnitView {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly status: string;
  readonly lessons: readonly LessonSummary[];
}

export interface CourseView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly audience: string;
  readonly objectives: readonly string[];
  readonly status: string;
  readonly isDefault: boolean;
  readonly units: readonly UnitView[];
}

export interface StudyView {
  /** Identity only — the counters live on the bootstrap summary, not here. */
  readonly study: StudyIdentity;
  readonly courses: readonly CourseView[];
  readonly notes: readonly KnowledgeNoteView[];
}

export interface KnowledgeNoteView {
  readonly id: string;
  readonly title: string;
  readonly question: string;
  readonly summary: string;
  readonly claimType: "source-fact" | "inference" | "personal-understanding";
  readonly status: "draft" | "active" | "stale" | "retired";
  readonly contentRevision: number;
  readonly cardCount: number;
  readonly evidence: readonly EvidenceView[];
  readonly content: string;
}

export interface EvidenceView {
  readonly kind: string;
  readonly sourcePath: string;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  readonly sourceCommit: string;
  readonly nodeIds: readonly string[];
  readonly note: string | null;
}

/**
 * Clipboard payload for editor jump (Cmd/Ctrl+P). Start line only — VS Code–
 * style Quick Open accepts `path:line`, not `path:7-9` or a trailing commit.
 * Commit pin and full line range stay in the post-copy hint, not the paste.
 */
export function evidenceEditorLocator(reference: EvidenceView): string {
  return reference.lineStart
    ? `${reference.sourcePath}:${reference.lineStart}`
    : reference.sourcePath;
}

export function evidenceRangeLabel(reference: EvidenceView): string | null {
  if (!reference.lineStart) return null;
  if (reference.lineEnd && reference.lineEnd !== reference.lineStart) {
    return `L${reference.lineStart}–${reference.lineEnd}`;
  }
  return `L${reference.lineStart}`;
}

export function editorJumpShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+P";
  // `userAgentData` is User-Agent Client Hints, which the DOM lib this project
  // compiles against does not declare — reading it as a typed property fails
  // `pnpm typecheck`. It is still the accurate source on current Chrome, so it
  // is read defensively rather than dropped or given a global declaration for
  // one shortcut label.
  const hints = (navigator as { readonly userAgentData?: { readonly platform?: string } })
    .userAgentData;
  const platform = hints?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform) ? "Cmd+P" : "Ctrl+P";
}

export interface EvidenceSnippetView {
  readonly sourcePath: string;
  readonly sourceCommit: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly highlightStartLine: number | null;
  readonly highlightEndLine: number | null;
  readonly language: string;
  readonly code: string;
  readonly truncatedBefore?: boolean;
  readonly truncatedAfter?: boolean;
}

export interface LessonAssetView {
  readonly id: string;
  readonly kind:
    | "real-screenshot"
    | "authorized-external"
    | "diagram"
    | "ai-illustration"
    | "screen-recording";
  readonly mime: string;
  readonly url: string;
  readonly posterUrl?: string;
  readonly alt: string;
  readonly caption?: string;
  readonly transcript?: string;
  readonly sourceCommit?: string;
  readonly capture?: {
    readonly route: string;
    readonly state: string;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly locale: string;
    readonly captureRecipe: string;
    readonly capturedAt: string;
  };
  readonly attribution?: string;
  readonly license?: string;
  readonly aiNote?: string;
}

export interface EvidenceToken {
  readonly content: string;
  readonly color?: string;
}

interface RetrievalAttemptDraft {
  readonly commandId: string;
  readonly startedAt: string;
}

interface CardRevealPayload extends RetrievalAttemptDraft {
  readonly contentRevision: number;
  readonly answer: string;
  readonly usedHint: false;
  readonly confidence?: number;
}

/** One earlier answer to a review card. Only ever sent back with a reveal. */
export interface PriorAttempt {
  readonly answer: string;
  readonly revealedAt: string;
  readonly contentRevision: number;
}

/**
 * The clipboard text that hands a review card to an AI host.
 *
 * It asks for an explanation, never a grade. The four buttons underneath are
 * FSRS ratings, and FSRS is asking how hard the recall felt — a question only
 * the person doing the recalling can answer. An outside verdict pasted into
 * that slot would schedule someone else's memory.
 */
export function buildCardCoachingPacket(input: {
  readonly front: string;
  readonly back: string;
  readonly answer: string;
  readonly priorAttempts: readonly PriorAttempt[];
}): string {
  const history = input.priorAttempts
    .map(
      (attempt) =>
        `- ${new Date(attempt.revealedAt).toLocaleDateString("zh-CN")}：${attempt.answer}`,
    )
    .join("\n");
  return [
    "我在用间隔重复复习一张卡片，想请你**讲解**，不要判分。",
    "",
    `## 卡片问题\n${input.front}`,
    `## 参考答案\n${input.back}`,
    `## 我这次的回答\n${input.answer}`,
    history ? `## 我以前的回答\n${history}` : "",
    "",
    "请：",
    "1. 指出我的回答和参考答案之间**实质**的差距（措辞不同不算）。",
    "2. 如果我以前答过，说说我的理解有没有变化。",
    "3. 补一个能帮我记住它的具体例子或类比。",
    "",
    "不要给我打分，也不要说我该选「困难」还是「良好」——那个我自己判断。",
  ]
    .filter(Boolean)
    .join("\n");
}

/** An AI host's verdict, written back through the CLI or the loopback API. */
export interface HostExerciseGradeView {
  readonly passed: boolean;
  readonly evaluation: string;
  readonly extensions: readonly string[];
  readonly host: string | null;
  readonly learnerAnswer: string | null;
  readonly occurredAt: string;
}

/**
 * What submitting returns. `correct` is always false here — the page records
 * the answer and nothing more, and the verdict arrives later from a host. The
 * reference answer never comes back on this route; it is disclosed, under the
 * tried-twice rule, only inside the server-built coaching packet.
 */
export interface ExerciseAttemptResult {
  readonly correct: boolean;
  readonly attemptCount: number;
  readonly score: number;
  readonly maxScore: number;
  readonly awaitingHostGrade?: boolean;
  readonly hostGrade?: HostExerciseGradeView | null;
}

/**
 * The packet is built by the server, not here.
 *
 * It has to carry the real source lines the question is about — an assistant in
 * a fresh chat window usually cannot open the repository, and grading code it
 * cannot see is guesswork. It also has to carry the reference answer, but only
 * once the learner has really tried; that rule decides what the learner is
 * allowed to see, so it cannot live in code the learner's own page runs.
 */
export interface CoachingPacketResponse {
  readonly packet: string;
  readonly referenceDisclosed: boolean;
  readonly evidenceCount: number;
  readonly evidenceOmitted: number;
  readonly submissionCount: number;
}

export interface LessonView {
  readonly lesson: {
    readonly id: string;
    readonly title: string;
    readonly contentRevision: number;
    readonly content: string;
    readonly sections: readonly LessonSectionView[];
    readonly language?: LanguageLayer;
    readonly links?: readonly LessonLinkRange[];
    readonly backlinks?: readonly LessonLinkTarget[];
    readonly evidenceAnchors?: readonly EvidenceAnchorRange[];
    readonly progress: LessonProgress | null;
    readonly evidence: readonly EvidenceView[];
    readonly assets?: readonly LessonAssetView[];
    readonly exercises: readonly {
      readonly id: string;
      readonly kind: string;
      readonly title: string;
      readonly prompt: string;
      readonly contentRevision: number;
      readonly awaitingHostGrade?: boolean;
      readonly hostGrade?: HostExerciseGradeView | null;
      readonly latestSubmission?: { readonly answer: string; readonly occurredAt: string } | null;
    }[];
    readonly cards: readonly {
      readonly id: string;
      readonly kind: string;
      readonly front: string;
      readonly contentRevision: number;
    }[];
  };
}

const HIGHLIGHTED_EVIDENCE_LANGUAGES = new Set([
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "css",
  "html",
  "markdown",
  "shellscript",
]);

let evidenceHighlighterPromise:
  | Promise<{
      codeToTokensBase(
        code: string,
        options: { readonly lang: string; readonly theme: string },
      ): readonly (readonly EvidenceToken[])[];
    }>
  | undefined;

function getEvidenceHighlighter() {
  evidenceHighlighterPromise ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/tsx.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/jsx.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/css.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/markdown.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/themes/github-dark.mjs"),
  ]).then(
    async ([
      core,
      engine,
      typescript,
      tsx,
      javascript,
      jsx,
      json,
      css,
      html,
      markdown,
      shellscript,
      githubDark,
    ]) =>
      core.createHighlighterCore({
        langs: [
          typescript.default,
          tsx.default,
          javascript.default,
          jsx.default,
          json.default,
          css.default,
          html.default,
          markdown.default,
          shellscript.default,
        ],
        themes: [githubDark.default],
        engine: engine.createJavaScriptRegexEngine(),
      }),
  );
  return evidenceHighlighterPromise;
}

export function createRetrievalAttemptDraft(
  commandId = crypto.randomUUID(),
  startedAt = new Date().toISOString(),
): RetrievalAttemptDraft {
  return { commandId, startedAt };
}

export function buildCardRevealPayload(
  draft: RetrievalAttemptDraft,
  contentRevision: number,
  answer: string,
  confidence?: number,
): CardRevealPayload {
  return {
    ...draft,
    contentRevision,
    answer,
    usedHint: false,
    ...(confidence === undefined ? {} : { confidence }),
  };
}

export async function highlightEvidenceCode(
  code: string,
  language: string,
): Promise<readonly (readonly EvidenceToken[])[]> {
  if (!HIGHLIGHTED_EVIDENCE_LANGUAGES.has(language)) {
    return code.split("\n").map((line) => [{ content: line }]);
  }
  const highlighter = await getEvidenceHighlighter();
  return highlighter.codeToTokensBase(code, { lang: language, theme: "github-dark" });
}
