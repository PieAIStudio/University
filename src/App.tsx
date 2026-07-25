import { useEffect, useMemo, useRef, useState } from "react";
import {
  GameBadge,
  GameButton,
  GameCallout,
  GamePanel,
  GameProgress,
  GameTabs,
} from "@pieai/swimmer-ui-kit";

import { MarkdownContent } from "./MarkdownContent.js";

type SectionId = "today" | "studies";

interface DefaultCourseSummary {
  readonly id: string;
  readonly title: string;
  readonly status: "draft" | "active" | "stale" | "retired";
}

interface StudySummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly goals: readonly string[];
  readonly defaultCourseId: string | null;
  readonly sourceRegistered: boolean;
  readonly snapshotCount: number;
  readonly uaAnalysisCount: number;
  readonly readyUaAnalysisCount: number;
  readonly courseCount: number;
  readonly defaultCourse: DefaultCourseSummary | null;
  readonly hasLearningDatabase: boolean;
}

interface LessonLocator {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

interface CourseReviewCardLocator extends LessonLocator {
  readonly kind: "course-card";
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
}

interface KnowledgeReviewCardLocator {
  readonly kind: "knowledge-card";
  readonly studyId: string;
  readonly noteId: string;
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
}

export type ReviewCardLocator = CourseReviewCardLocator | KnowledgeReviewCardLocator;

type TodayCard = ReviewCardLocator & {
  readonly dueAt: string;
};

interface NextLesson extends LessonLocator {
  readonly studyTitle: string;
  readonly courseTitle: string;
  readonly lessonTitle: string;
  readonly progress: LessonProgress | null;
}

interface BootstrapData {
  readonly product: "UniversityLocal";
  readonly requestToken: string;
  readonly studiesRoot: string;
  readonly studies: readonly StudySummary[];
  readonly shelfIssues: readonly string[];
  readonly today: {
    readonly dueCount: number;
    readonly card: TodayCard | null;
    readonly nextLesson: NextLesson | null;
    readonly issues: readonly string[];
  };
}

interface LessonProgress {
  readonly contentRevision: number;
  readonly status: "not-started" | "in-progress" | "completed";
  readonly progress: number;
  readonly updatedAt: string;
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

interface UnitView {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly status: string;
  readonly lessons: readonly LessonSummary[];
}

interface StudyView {
  readonly study: StudySummary;
  readonly course: null | {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly audience: string;
    readonly objectives: readonly string[];
    readonly status: string;
    readonly units: readonly UnitView[];
  };
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

interface EvidenceView {
  readonly kind: string;
  readonly sourcePath: string;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  readonly sourceCommit: string;
  readonly nodeIds: readonly string[];
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
}

export interface EvidenceToken {
  readonly content: string;
  readonly color?: string;
}

export interface RetrievalAttemptDraft {
  readonly commandId: string;
  readonly startedAt: string;
}

export interface CardRevealPayload extends RetrievalAttemptDraft {
  readonly contentRevision: number;
  readonly answer: string;
  readonly usedHint: false;
  readonly confidence?: number;
}

/**
 * `expectedAnswer` is deliberately optional: the API withholds the reference
 * answer until the attempt is correct or the learner has tried twice, so a
 * single wrong guess does not end the retrieval practice.
 */
interface ExerciseAttemptResult {
  readonly correct: boolean;
  readonly attemptCount: number;
  readonly expectedAnswer?: string;
}

interface LessonView {
  readonly lesson: {
    readonly id: string;
    readonly title: string;
    readonly contentRevision: number;
    readonly content: string;
    readonly progress: LessonProgress | null;
    readonly evidence: readonly EvidenceView[];
    readonly exercises: readonly {
      readonly id: string;
      readonly kind: string;
      readonly title: string;
      readonly prompt: string;
      readonly contentRevision: number;
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

const tabs = [
  { id: "today", label: "今日学习", panelId: "panel-today" },
  { id: "studies", label: "学习项目", panelId: "panel-studies" },
] as const;

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { readonly error?: string };
  if (!response.ok) throw new Error(body.error ?? `请求失败（${response.status}）`);
  return body;
}

function lessonPath(locator: LessonLocator): string {
  return `/api/studies/${locator.studyId}/courses/${locator.courseId}/units/${locator.unitId}/lessons/${locator.lessonId}`;
}

export function cardActionPath(card: ReviewCardLocator, action: "reveal" | "review"): string {
  if (card.kind === "knowledge-card") {
    return `/api/studies/${card.studyId}/notes/${card.noteId}/cards/${card.cardId}/${action}`;
  }
  return `${lessonPath(card)}/cards/${card.cardId}/${action}`;
}

function reviewCardIdentity(card: ReviewCardLocator): string {
  if (card.kind === "knowledge-card") {
    return `knowledge/${card.studyId}/${card.noteId}/${card.cardId}@${card.contentRevision}`;
  }
  return `course/${card.studyId}/${card.courseId}/${card.unitId}/${card.lessonId}/${card.cardId}@${card.contentRevision}`;
}

function progressLabel(progress: LessonProgress | null): string {
  if (!progress) return "尚未开始";
  if (progress.status === "completed") return "已完成";
  return `进行中 · ${Math.round(progress.progress * 100)}%`;
}

function EmptyCampus() {
  return (
    <GamePanel className="empty-state" tone="strong">
      <span className="empty-state__mark" aria-hidden="true">
        U
      </span>
      <div>
        <p className="eyebrow">CAMPUS SETUP</p>
        <h2>第一项学习还没有准备好。</h2>
        <p>用 AI 宿主注册一个真实项目后，它会出现在这里；源码不会被学习资料污染。</p>
      </div>
    </GamePanel>
  );
}

function ReviewCard({
  card,
  requestToken,
  onReviewed,
}: {
  readonly card: ReviewCardLocator;
  readonly requestToken: string;
  readonly onReviewed: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [back, setBack] = useState<string | null>(null);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealFailed, setRevealFailed] = useState(false);
  const [retrievalDraft, setRetrievalDraft] = useState(createRetrievalAttemptDraft);
  const cardIdentity = reviewCardIdentity(card);
  const previousCardIdentity = useRef(cardIdentity);

  useEffect(() => {
    if (previousCardIdentity.current === cardIdentity) return;
    previousCardIdentity.current = cardIdentity;
    setAnswer("");
    setBack(null);
    setNextDue(null);
    setError(null);
    setRevealFailed(false);
    setRetrievalDraft(createRetrievalAttemptDraft());
  }, [cardIdentity]);

  async function post(path: string, body: unknown) {
    return fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": requestToken,
      },
      body: JSON.stringify(body),
    });
  }

  async function reveal() {
    setPending(true);
    setError(null);
    try {
      const response = await post(
        cardActionPath(card, "reveal"),
        buildCardRevealPayload(retrievalDraft, card.contentRevision, answer),
      );
      const result = await readJson<{ readonly back: string }>(response);
      setBack(result.back);
      setRevealFailed(false);
      setRetrievalDraft(createRetrievalAttemptDraft());
    } catch (reason) {
      // The answer field stays editable on failure. Locking it on *attempt*
      // used to strand the learner: a 409 revision conflict disabled the
      // field and every retry replayed the same stale contentRevision.
      const message = reason instanceof Error ? reason.message : "暂时无法揭示答案";
      setRevealFailed(true);
      setError(message);
      if (/revision/i.test(message)) {
        // Card content moved underneath us; pull the fresh revision so the
        // retry has something valid to send.
        await onReviewed().catch(() => undefined);
      }
    } finally {
      setPending(false);
    }
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    setPending(true);
    setError(null);
    try {
      const response = await post(cardActionPath(card, "review"), {
        commandId: crypto.randomUUID(),
        contentRevision: card.contentRevision,
        rating,
      });
      const result = await readJson<{ readonly state: { readonly dueAt: string } }>(response);
      setNextDue(result.state.dueAt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法保存复习结果");
      setPending(false);
      return;
    }
    // The grade is committed at this point. A failure refreshing the rest of
    // the campus must not be reported as "the grade was not saved".
    try {
      await onReviewed();
    } catch {
      setError("评分已保存，但界面没能刷新，请重新加载页面。");
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="review-card" tone="strong">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ANSWER BEFORE REVEAL</p>
          <h2>先想，再看答案</h2>
        </div>
        <GameBadge tone="ai">FSRS</GameBadge>
      </div>
      <p className="review-card__question">{card.front}</p>
      <label className="answer-field">
        <span>你的回答</span>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={pending || back !== null || nextDue !== null}
          placeholder="先写下自己的答案；非空后才能揭示。"
          rows={4}
        />
      </label>
      {back === null ? (
        <GameButton
          variant="primary"
          onClick={() => void reveal()}
          disabled={!answer.trim() || pending}
        >
          {pending ? "正在核对…" : revealFailed ? "重试揭示" : "揭示答案"}
        </GameButton>
      ) : (
        <div className="answer-reveal" aria-live="polite">
          <p className="eyebrow">参考答案</p>
          <p>{back}</p>
          {nextDue ? (
            <GameCallout heading="复习结果已保存" tone="success">
              下一次安排：{new Date(nextDue).toLocaleString("zh-CN")}
            </GameCallout>
          ) : (
            <div className="rating-row" aria-label="根据回忆难度评分">
              <GameButton variant="danger" onClick={() => void rate(1)} disabled={pending}>
                重来
              </GameButton>
              <GameButton variant="ghost" onClick={() => void rate(2)} disabled={pending}>
                困难
              </GameButton>
              <GameButton variant="secondary" onClick={() => void rate(3)} disabled={pending}>
                良好
              </GameButton>
              <GameButton variant="success" onClick={() => void rate(4)} disabled={pending}>
                简单
              </GameButton>
            </div>
          )}
        </div>
      )}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </GamePanel>
  );
}

function ExerciseBlock({
  locator,
  exercise,
  requestToken,
  onCompleted,
}: {
  readonly locator: LessonLocator;
  readonly exercise: LessonView["lesson"]["exercises"][number];
  readonly requestToken: string;
  readonly onCompleted: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ExerciseAttemptResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${lessonPath(locator)}/exercises/${exercise.id}/attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-University-Local-Token": requestToken,
        },
        body: JSON.stringify({
          commandId: crypto.randomUUID(),
          contentRevision: exercise.contentRevision,
          answer,
        }),
      });
      const body = await readJson<ExerciseAttemptResult>(response);
      setResult(body);
      if (body.correct) {
        // The attempt is already recorded server-side; a refresh failure is a
        // display problem, not a lost answer.
        await onCompleted().catch(() => setError("答案已记录，但界面没能刷新，请重新加载页面。"));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法提交练习");
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="exercise-panel" title={exercise.title}>
      <p>{exercise.prompt}</p>
      <label className="answer-field">
        <span>你的答案</span>
        <textarea
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setResult(null);
          }}
          placeholder="用自己的话先回答。"
          rows={3}
        />
      </label>
      <GameButton
        variant="primary"
        onClick={() => void submit()}
        disabled={!answer.trim() || pending || result?.correct === true}
      >
        {pending ? "正在提交…" : result?.correct ? "已完成" : "提交答案"}
      </GameButton>
      {result ? (
        <GameCallout
          heading={result.correct ? "回答正确" : "这次还没答对"}
          tone={result.correct ? "success" : "warning"}
          role="status"
        >
          {result.expectedAnswer !== undefined
            ? `参考答案：${result.expectedAnswer}${
                result.correct ? "。课程进度已经保存。" : "。看清差异后可以修改并重试。"
              }`
            : "先不看答案，再自己回想一次。回到上面的课文找依据，然后重新作答；再答错一次会给出参考答案。"}
        </GameCallout>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </GamePanel>
  );
}

function trustedThemeColor(color: string | undefined): string | undefined {
  return color && /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color) ? color : undefined;
}

export function EvidenceCode({
  snippet,
  lines,
}: {
  readonly snippet: EvidenceSnippetView;
  readonly lines: readonly (readonly EvidenceToken[])[];
}) {
  return (
    <pre
      className="evidence-code"
      tabIndex={0}
      aria-label={`${snippet.sourcePath} 第 ${snippet.startLine} 到 ${snippet.endLine} 行`}
    >
      <code>
        {lines.map((tokens, index) => {
          const lineNumber = snippet.startLine + index;
          const highlighted =
            snippet.highlightStartLine !== null &&
            snippet.highlightEndLine !== null &&
            lineNumber >= snippet.highlightStartLine &&
            lineNumber <= snippet.highlightEndLine;
          return (
            <span
              className={`evidence-code__line${highlighted ? " evidence-code__line--highlighted" : ""}`}
              key={lineNumber}
            >
              <span className="evidence-code__line-number" aria-hidden="true">
                {lineNumber}
              </span>
              <span className="evidence-code__line-content">
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={`${tokenIndex}:${token.content.length}`}
                    style={{ color: trustedThemeColor(token.color) }}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function EvidenceRail({
  basePath,
  evidence,
  panelIdPrefix,
  ariaLabel = "课程证据",
  title = "这节课依据什么",
}: {
  readonly basePath: string;
  readonly evidence: readonly EvidenceView[];
  readonly panelIdPrefix: string;
  readonly ariaLabel?: string;
  readonly title?: string;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokenLines, setTokenLines] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  async function toggleEvidence(index: number) {
    if (expandedIndex === index) {
      requestSequence.current += 1;
      setExpandedIndex(null);
      setSnippet(null);
      setTokenLines([]);
      setLoading(false);
      setError(null);
      return;
    }

    const sequence = ++requestSequence.current;
    setExpandedIndex(index);
    setSnippet(null);
    setTokenLines([]);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${basePath}/evidence/${index}`);
      const nextSnippet = await readJson<EvidenceSnippetView>(response);
      const nextTokens = await highlightEvidenceCode(nextSnippet.code, nextSnippet.language);
      if (requestSequence.current !== sequence) return;
      setSnippet(nextSnippet);
      setTokenLines(nextTokens);
    } catch (reason) {
      if (requestSequence.current !== sequence) return;
      setError(reason instanceof Error ? reason.message : "无法读取这条源码证据");
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }

  return (
    <aside className="evidence-rail" aria-label={ariaLabel}>
      <p className="eyebrow">EVIDENCE</p>
      <h3>{title}</h3>
      <ol className="evidence-list">
        {evidence.map((reference, index) => {
          const expanded = expandedIndex === index;
          const panelId = `evidence-snippet-${panelIdPrefix}-${index}`;
          return (
            <li
              className="evidence-item"
              key={`${index}:${reference.sourcePath}:${reference.lineStart}`}
            >
              <button
                type="button"
                className="evidence-item__trigger"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => void toggleEvidence(index)}
              >
                <code>{reference.sourcePath}</code>
                <span>
                  {reference.lineStart
                    ? `L${reference.lineStart}${reference.lineEnd ? `–${reference.lineEnd}` : ""}`
                    : "完整文件"}
                </span>
                <small>{reference.sourceCommit.slice(0, 8)}</small>
                <strong aria-hidden="true">{expanded ? "收起" : "查看"}</strong>
              </button>
              {expanded ? (
                <div className="evidence-snippet" id={panelId} aria-live="polite">
                  {loading ? <p>正在从固定提交读取源码…</p> : null}
                  {error ? (
                    <p className="inline-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  {snippet ? (
                    <>
                      <div className="evidence-snippet__meta">
                        <span>{snippet.language}</span>
                        <span>
                          L{snippet.startLine}–{snippet.endLine}
                        </span>
                        <span>{snippet.sourceCommit.slice(0, 12)}</span>
                      </div>
                      <EvidenceCode snippet={snippet} lines={tokenLines} />
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function LessonReader({
  locator,
  view,
  requestToken,
  onLearningChanged,
}: {
  readonly locator: LessonLocator;
  readonly view: LessonView;
  readonly requestToken: string;
  readonly onLearningChanged: () => Promise<void>;
}) {
  const [completed, setCompleted] = useState(view.lesson.progress?.status === "completed");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setCompleted(view.lesson.progress?.status === "completed");
  }, [view.lesson.id, view.lesson.contentRevision, view.lesson.progress?.status]);

  // Opening a lesson swaps the whole main region. Without moving focus, a
  // keyboard or screen-reader user is left on a control that just unmounted
  // and has to tab through the entire chrome to reach the new content.
  useEffect(() => {
    titleRef.current?.focus();
  }, [view.lesson.id]);

  async function complete() {
    setCompleted(true);
    await onLearningChanged();
  }

  return (
    <article className="lesson-reader">
      <header className="lesson-reader__header">
        <div>
          <p className="eyebrow">LESSON · REV {view.lesson.contentRevision}</p>
          <h2 ref={titleRef} tabIndex={-1}>
            {view.lesson.title}
          </h2>
        </div>
        <GameBadge tone={completed ? "success" : "warning"}>
          {completed ? "已完成" : "学习中"}
        </GameBadge>
      </header>
      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="markdown-body">
            <MarkdownContent>{view.lesson.content}</MarkdownContent>
          </div>
          {view.lesson.exercises.map((exercise) => (
            <ExerciseBlock
              key={exercise.id}
              locator={locator}
              exercise={exercise}
              requestToken={requestToken}
              onCompleted={complete}
            />
          ))}
          {completed && view.lesson.cards.length > 0 ? (
            <section className="lesson-practice">
              <div>
                <p className="eyebrow">RETRIEVAL PRACTICE</p>
                <h2>把刚学到的内容，从脑子里拿出来。</h2>
              </div>
              {view.lesson.cards.map((card) => (
                <ReviewCard
                  key={card.id}
                  card={{
                    kind: "course-card",
                    ...locator,
                    cardId: card.id,
                    front: card.front,
                    contentRevision: card.contentRevision,
                  }}
                  requestToken={requestToken}
                  onReviewed={onLearningChanged}
                />
              ))}
            </section>
          ) : null}
        </div>
        <EvidenceRail
          basePath={lessonPath(locator)}
          evidence={view.lesson.evidence}
          panelIdPrefix={`${locator.studyId}-${locator.courseId}-${locator.unitId}-${locator.lessonId}`}
        />
      </div>
    </article>
  );
}

function TodaySection({
  data,
  onOpenLesson,
  onReviewed,
}: {
  readonly data: BootstrapData;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onReviewed: () => Promise<void>;
}) {
  const card = data.today.card;
  return (
    <div className="today-layout">
      <section className="today-intro">
        <p className="eyebrow">TODAY · PERSONAL CAMPUS</p>
        <h2>{data.today.nextLesson ? "先完成一节课，再巩固记忆。" : "今天，从回忆开始。"}</h2>
        <p>课程负责建立理解，卡片只负责把重要知识留在长期记忆里。</p>
      </section>

      {data.today.nextLesson ? (
        <GamePanel className="next-lesson" tone="strong">
          <div>
            <p className="eyebrow">NEXT LESSON</p>
            <h2>{data.today.nextLesson.lessonTitle}</h2>
            <p>
              {data.today.nextLesson.studyTitle} · {data.today.nextLesson.courseTitle}
            </p>
          </div>
          <div className="next-lesson__action">
            <GameBadge tone="warning">{progressLabel(data.today.nextLesson.progress)}</GameBadge>
            <GameButton variant="primary" onClick={() => onOpenLesson(data.today.nextLesson!)}>
              {data.today.nextLesson.progress ? "继续学习" : "开始学习"}
            </GameButton>
          </div>
        </GamePanel>
      ) : null}

      {/* The review card is the day's actual work, so it leads the row and the
          tab order; the due-count metric is the supporting rail beside it. */}
      {card ? (
        <ReviewCard card={card} requestToken={data.requestToken} onReviewed={onReviewed} />
      ) : (
        <GameCallout heading="今天没有到期卡片" tone="success" className="today-empty">
          {data.today.nextLesson
            ? "完成上面的课程后，新卡片会进入 FSRS 复习安排。"
            : "今天的复习已经清空，可以继续研究下一门课。"}
        </GameCallout>
      )}

      <div className="today-metric">
        <span>{data.today.dueCount}</span>
        <div>
          <p className="eyebrow">DUE CARDS</p>
          <p>今天到期的复习卡片</p>
        </div>
      </div>
      {data.today.issues.length > 0 ? (
        <GameCallout heading="有学习数据暂时无法使用" tone="warning">
          {data.today.issues.join("；")}
        </GameCallout>
      ) : null}
    </div>
  );
}

function StudyShelf({
  data,
  selectedStudyId,
  onSelect,
}: {
  readonly data: BootstrapData;
  readonly selectedStudyId: string | null;
  readonly onSelect: (studyId: string) => void;
}) {
  return (
    <aside className="study-shelf" aria-label="学习项目列表">
      <p className="eyebrow">YOUR STUDIES</p>
      {data.studies.map((study) => (
        <button
          key={study.id}
          type="button"
          className="study-shelf__item"
          data-active={selectedStudyId === study.id}
          // `data-active` only reaches CSS. Screen-reader users need the
          // selected project announced, not just tinted.
          aria-current={selectedStudyId === study.id ? "true" : undefined}
          onClick={() => onSelect(study.id)}
        >
          <span>{study.title}</span>
          <small>{study.defaultCourse?.status === "active" ? "可学习" : "准备中"}</small>
        </button>
      ))}
    </aside>
  );
}

export function StudyEvidenceStatus({
  snapshotCount,
  readyUaAnalysisCount,
}: {
  readonly snapshotCount: number;
  readonly readyUaAnalysisCount: number;
}) {
  return (
    <section className="study-evidence-status" aria-label="研究证据状态">
      <div className="study-evidence-status__metric">
        <strong>{snapshotCount}</strong>
        <span>份源码快照</span>
      </div>
      <div className="study-evidence-status__metric">
        <strong>{readyUaAnalysisCount}</strong>
        <span>份 UA READY 分析</span>
      </div>
      <p className="study-evidence-status__boundary">
        <strong>资料边界</strong>
        <span>UA 原生地图/导览是课程证据，不是正式课程。</span>
      </p>
    </section>
  );
}

const claimTypeLabels: Readonly<Record<KnowledgeNoteView["claimType"], string>> = {
  "source-fact": "源码事实",
  inference: "推论",
  "personal-understanding": "个人理解",
};

function noteStatusPresentation(status: KnowledgeNoteView["status"]): {
  readonly label: string;
  readonly tone: "success" | "warning" | "neutral";
} {
  if (status === "active") return { label: "可复习", tone: "success" };
  if (status === "draft") return { label: "草稿", tone: "warning" };
  if (status === "stale") return { label: "待重新核验", tone: "warning" };
  return { label: "已归档", tone: "neutral" };
}

function noteReviewAvailability(note: KnowledgeNoteView): string {
  if (note.status === "draft") return "缺证据，未入复习";
  if (note.status === "stale") return "来源已变化，暂停复习";
  if (note.status === "retired") return "已经归档，不再进入复习";
  return note.cardCount > 0 ? `${note.cardCount} 张卡片可进入复习` : "当前没有派生卡片";
}

export function KnowledgeNotesSection({
  studyId,
  notes,
}: {
  readonly studyId: string;
  readonly notes: readonly KnowledgeNoteView[];
}) {
  return (
    <section className="knowledge-notes" aria-labelledby="knowledge-notes-title">
      <header className="knowledge-notes__header">
        <div>
          <p className="eyebrow">MY QUESTIONS · CLASS NOTES</p>
          <h2 id="knowledge-notes-title">我的追问 / 课堂笔记</h2>
        </div>
        <GameBadge tone="ai">AI 宿主沉淀</GameBadge>
      </header>
      <p className="knowledge-notes__boundary">
        这里保存你与 Grok 等 AI 宿主追问后沉淀的知识；它与经过编排的正式课程分开管理。
      </p>
      {notes.length === 0 ? (
        <GameCallout heading="还没有课堂笔记" tone="neutral">
          在 AI 宿主中把一次追问保存为知识点后，它会出现在这里。
        </GameCallout>
      ) : (
        <div className="knowledge-note-list">
          {notes.map((note) => {
            const status = noteStatusPresentation(note.status);
            return (
              <article className="knowledge-note" data-status={note.status} key={note.id}>
                <header className="knowledge-note__summary">
                  <div>
                    <p className="eyebrow">
                      {claimTypeLabels[note.claimType]} · REV {note.contentRevision}
                    </p>
                    <h3>{note.title}</h3>
                  </div>
                  <GameBadge tone={status.tone}>{status.label}</GameBadge>
                </header>
                <p className="knowledge-note__question">{note.question}</p>
                <p className="knowledge-note__abstract">{note.summary}</p>
                <div className="knowledge-note__meta">
                  <span>{note.cardCount} 张派生卡片</span>
                  <span>
                    {note.evidence.length > 0
                      ? `${note.evidence.length} 条固定源码证据`
                      : "没有源码证据"}
                  </span>
                  <strong>{noteReviewAvailability(note)}</strong>
                </div>
                <details className="knowledge-note__details">
                  <summary>展开笔记正文与证据</summary>
                  <div className="knowledge-note__body markdown-body">
                    <MarkdownContent>{note.content}</MarkdownContent>
                  </div>
                  {note.evidence.length > 0 ? (
                    <EvidenceRail
                      basePath={`/api/studies/${studyId}/notes/${note.id}`}
                      evidence={note.evidence}
                      panelIdPrefix={`${studyId}-${note.id}`}
                      ariaLabel={`${note.title} 的知识证据`}
                      title="这条知识依据什么"
                    />
                  ) : (
                    <p className="knowledge-note__no-evidence">
                      {note.claimType === "personal-understanding"
                        ? "这是个人理解；可以保留，但不要把它冒充源码事实。"
                        : "尚未通过源码证据门禁。"}
                    </p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StudyDetail({
  view,
  summary,
  onOpenLesson,
}: {
  readonly view: StudyView;
  readonly summary: StudySummary;
  readonly onOpenLesson: (locator: LessonLocator) => void;
}) {
  const course = view.course;
  const lessons = course?.units.flatMap((unit) => unit.lessons) ?? [];
  const completed = lessons.filter((lesson) => lesson.progress?.status === "completed").length;
  return (
    <section className="study-detail">
      <header className="study-detail__header">
        <div>
          <p className="eyebrow">STUDY · {view.study.id}</p>
          <h2>{view.study.title}</h2>
          <p>{view.study.description}</p>
        </div>
      </header>
      <StudyEvidenceStatus
        snapshotCount={summary.snapshotCount}
        readyUaAnalysisCount={summary.readyUaAnalysisCount}
      />
      {course ? (
        <section className="formal-course" aria-labelledby="formal-course-title">
          <header className="formal-course__header">
            <div>
              <p className="eyebrow">FORMAL CURRICULUM</p>
              <h2 id="formal-course-title">正式课程 · {course.title}</h2>
              <p>{course.description}</p>
            </div>
            <GameBadge tone={course.status === "active" ? "success" : "warning"}>
              {course.status === "active" ? "课程已发布" : course.status}
            </GameBadge>
          </header>
          <GameProgress value={completed} max={Math.max(lessons.length, 1)} label="课程完成度" />
          <div className="course-objectives">
            <p className="eyebrow">LEARNING OUTCOMES</p>
            <ul>
              {course.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </div>
          <div className="unit-list">
            {course.units.map((unit, unitIndex) => (
              <section className="unit-card" key={unit.id}>
                <div className="unit-card__number">{String(unitIndex + 1).padStart(2, "0")}</div>
                <div className="unit-card__body">
                  <p className="eyebrow">UNIT</p>
                  <h3>{unit.title}</h3>
                  <p>{unit.objective}</p>
                  <div className="lesson-list">
                    {unit.lessons.map((lesson) => (
                      <button
                        type="button"
                        className="lesson-row"
                        key={lesson.id}
                        onClick={() =>
                          onOpenLesson({
                            studyId: view.study.id,
                            courseId: course.id,
                            unitId: unit.id,
                            lessonId: lesson.id,
                          })
                        }
                      >
                        <span>
                          <strong>{lesson.title}</strong>
                          <small>
                            {lesson.exerciseCount} 道练习 · {lesson.cardCount} 张卡片
                          </small>
                        </span>
                        <GameBadge
                          tone={lesson.progress?.status === "completed" ? "success" : "neutral"}
                        >
                          {progressLabel(lesson.progress)}
                        </GameBadge>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : (
        <GamePanel className="formal-course-empty" tone="strong">
          <p className="eyebrow">FORMAL CURRICULUM</p>
          <h2>正式课程尚未发布</h2>
          <p>源码、UA 地图与课堂笔记可以先存在，但它们不会冒充经过编排的正式课程。</p>
        </GamePanel>
      )}
      <KnowledgeNotesSection studyId={view.study.id} notes={view.notes} />
    </section>
  );
}

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("today");
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [studyView, setStudyView] = useState<StudyView | null>(null);
  const [lessonLocator, setLessonLocator] = useState<LessonLocator | null>(null);
  const [lessonView, setLessonView] = useState<LessonView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Monotonic request ids. Every study/lesson response is checked against the
  // latest issued id before it is allowed to touch state, so a slow response
  // for the study or lesson the learner just navigated away from can never
  // overwrite the one they are actually looking at.
  const studyRequestId = useRef(0);
  const lessonRequestId = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  async function loadBootstrap() {
    const next = await readJson<BootstrapData>(await fetch("/api/bootstrap"));
    setData(next);
    setSelectedStudyId((current) => current ?? next.studies[0]?.id ?? null);
  }

  async function loadStudy(studyId: string, signal?: AbortSignal) {
    const requestId = (studyRequestId.current += 1);
    const next = await readJson<StudyView>(await fetch(`/api/studies/${studyId}`, { signal }));
    if (studyRequestId.current !== requestId) return;
    setStudyView(next);
  }

  async function loadLesson(locator: LessonLocator, signal?: AbortSignal) {
    const requestId = (lessonRequestId.current += 1);
    const next = await readJson<LessonView>(await fetch(lessonPath(locator), { signal }));
    if (lessonRequestId.current !== requestId) return;
    setLessonView(next);
  }

  /** Ignore the rejection an in-flight fetch produces when we abort it. */
  function isAbort(reason: unknown): boolean {
    return reason instanceof DOMException && reason.name === "AbortError";
  }

  useEffect(() => {
    void loadBootstrap()
      .then(() => setError(null))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "无法连接 UniversityLocal 服务"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection !== "studies" || !selectedStudyId) return;
    const controller = new AbortController();
    // Drop the previous study's detail immediately, so the header never shows
    // one project's metrics next to another project's units.
    setStudyView(null);
    void loadStudy(selectedStudyId, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setError(reason instanceof Error ? reason.message : "无法读取学习项目");
      });
    return () => controller.abort();
  }, [activeSection, selectedStudyId]);

  useEffect(() => {
    if (!lessonLocator) {
      setLessonView(null);
      setLessonError(null);
      return;
    }
    const controller = new AbortController();
    setLessonView(null);
    setLessonError(null);
    void loadLesson(lessonLocator, controller.signal)
      .then(() => setError(null))
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setLessonError(reason instanceof Error ? reason.message : "无法读取课程");
      });
    return () => controller.abort();
  }, [lessonLocator]);

  // Closing a lesson unmounts the button that was focused, which drops focus
  // to <body>. Hand it to the panel the learner lands on instead. This runs
  // as an effect rather than after requestAnimationFrame on the click: rAF
  // does not fire while the tab is hidden, so the focus move would silently
  // be skipped for anyone who switched away and back.
  const lessonWasOpen = useRef(false);
  useEffect(() => {
    const lessonIsOpen = lessonLocator !== null;
    if (lessonWasOpen.current && !lessonIsOpen) mainRef.current?.focus();
    lessonWasOpen.current = lessonIsOpen;
  }, [lessonLocator]);

  const completedStudies = useMemo(
    () => data?.studies.filter((study) => study.defaultCourse?.status === "active").length ?? 0,
    [data],
  );
  const selectedStudySummary = useMemo(
    () => data?.studies.find((study) => study.id === selectedStudyId) ?? null,
    [data, selectedStudyId],
  );

  function openLesson(locator: LessonLocator) {
    setSelectedStudyId(locator.studyId);
    setLessonLocator(locator);
    setActiveSection("studies");
  }

  async function refreshLearning() {
    await loadBootstrap();
    if (selectedStudyId) await loadStudy(selectedStudyId);
    if (lessonLocator) await loadLesson(lessonLocator);
  }

  return (
    <div className="campus" data-game-ui-theme="night">
      <header className="campus-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            U
          </span>
          <div>
            <p>PIE · PERSONAL CAMPUS</p>
            <h1>UniversityLocal</h1>
          </div>
        </div>
        <div className="campus-status" aria-label="校园状态">
          <GameBadge tone="success">资料仅在本机</GameBadge>
          <span>{data?.studies.length ?? 0} 个 study</span>
          <span>{completedStudies} 门可学课程</span>
        </div>
      </header>

      <nav className="campus-nav" aria-label="UniversityLocal 主导航">
        <GameTabs
          id="campus-section"
          tabs={tabs}
          activeId={activeSection}
          onSelect={(id) => {
            setActiveSection(id as SectionId);
            if (id === "today") setLessonLocator(null);
          }}
        />
      </nav>

      <main
        ref={mainRef}
        id={`panel-${activeSection}`}
        role="tabpanel"
        tabIndex={-1}
        aria-labelledby={`campus-section-${activeSection}`}
        className="campus-main"
      >
        {error ? (
          <GameCallout
            heading="有一项操作没有完成"
            tone="warning"
            className="global-error"
            role="alert"
          >
            {error}
          </GameCallout>
        ) : null}
        {data && data.shelfIssues.length > 0 ? (
          <GameCallout heading="书架上有资料读不出来" tone="warning" className="global-error">
            {data.shelfIssues.join("；")}
          </GameCallout>
        ) : null}
        {loading ? <p className="loading-copy">正在打开校园档案…</p> : null}
        {data && data.studies.length === 0 ? <EmptyCampus /> : null}
        {data && data.studies.length > 0 && activeSection === "today" ? (
          <TodaySection data={data} onOpenLesson={openLesson} onReviewed={refreshLearning} />
        ) : null}
        {data && data.studies.length > 0 && activeSection === "studies" ? (
          lessonLocator ? (
            <div>
              <GameButton variant="ghost" onClick={() => setLessonLocator(null)}>
                ← 返回课程
              </GameButton>
              {lessonView ? (
                <LessonReader
                  locator={lessonLocator}
                  view={lessonView}
                  requestToken={data.requestToken}
                  onLearningChanged={refreshLearning}
                />
              ) : lessonError ? (
                <GameCallout heading="这节课打不开" tone="warning" role="alert">
                  {lessonError}
                </GameCallout>
              ) : (
                <p className="loading-copy">正在打开这节课…</p>
              )}
            </div>
          ) : (
            <div className="studies-layout">
              <StudyShelf
                data={data}
                selectedStudyId={selectedStudyId}
                onSelect={(studyId) => {
                  setSelectedStudyId(studyId);
                  setLessonLocator(null);
                }}
              />
              {studyView && selectedStudySummary ? (
                <StudyDetail
                  view={studyView}
                  summary={selectedStudySummary}
                  onOpenLesson={openLesson}
                />
              ) : null}
            </div>
          )
        ) : null}
      </main>

      <footer className="campus-footer">
        <span>学习资料默认保存在</span>
        <code>{data?.studiesRoot ?? "./studies"}</code>
      </footer>
    </div>
  );
}
