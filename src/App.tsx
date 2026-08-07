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
import { Tip } from "./Tip.js";
import { lessonPath, readJson } from "./api/client.js";
import { readForeignLanguageMode, writeForeignLanguageMode } from "./language/reading-mode.js";
import type { LessonLinkTarget } from "./remark-lesson-links.js";
import { formatAddress, parseAddress, type AppAddress } from "./url-state.js";
import type { LexiconEntry } from "./language/WordPopover.js";
import {
  readVoicePreference,
  selectVoice,
  speakWord,
  useEnglishVoices,
  writeVoicePreference,
} from "./language/speech.js";
import { ExerciseBlock } from "./review/ExerciseBlock.js";
import { ReviewCard } from "./review/ReviewCard.js";
import { VocabularyReview } from "./review/VocabularyReview.js";

type SectionId = "today" | "studies";

import type {
  StudySummary,
  LessonLocator,
  BootstrapData,
  CourseView,
  StudyView,
  KnowledgeNoteView,
  EvidenceView,
  EvidenceSnippetView,
  EvidenceToken,
  LessonView,
} from "./view/lesson-view.js";
import {
  focusLabel,
  progressLabel,
  evidenceEditorLocator,
  evidenceRangeLabel,
  editorJumpShortcutLabel,
  highlightEvidenceCode,
} from "./view/lesson-view.js";

const tabs = [
  { id: "today", label: "今日学习", panelId: "panel-today" },
  { id: "studies", label: "学习项目", panelId: "panel-studies" },
] as const;

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

/**
 * Copies a clean editor locator; shows commit pin + how-to beside the button.
 * Keeping version out of the clipboard is deliberate — paste must work in Quick Open.
 */
function CopyLocatorButton({ reference }: { readonly reference: EvidenceView }) {
  const [copied, setCopied] = useState(false);
  const locator = evidenceEditorLocator(reference);
  const range = evidenceRangeLabel(reference);
  const commitShort = reference.sourceCommit.slice(0, 12);
  const jumpKey = editorJumpShortcutLabel();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 4500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="evidence-item__copy-wrap">
      <button
        type="button"
        className="evidence-item__copy"
        title={`复制 ${locator}，供编辑器 ${jumpKey} 跳转`}
        aria-describedby={copied ? `copy-hint-${locator}` : undefined}
        onClick={() => {
          void navigator.clipboard?.writeText(locator).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? "已复制" : "复制位置"}
      </button>
      {copied ? (
        <p
          className="evidence-item__copy-hint"
          id={`copy-hint-${locator}`}
          role="status"
          aria-live="polite"
        >
          <span className="evidence-item__copy-hint-line">
            已复制 <code>{locator}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            {range ? `证据范围 ${range} · ` : null}
            钉在提交 <code>{commitShort}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            在被学项目工作区按 {jumpKey}，粘贴后回车即可跳转
          </span>
        </p>
      ) : null}
    </div>
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
              {reference.note ? <p className="evidence-item__note">{reference.note}</p> : null}
              <CopyLocatorButton reference={reference} />
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

/**
 * What each vocabulary stage means to someone reading the panel, rather than
 * to the scheduler. "认识" is not "已掌握": the word stays scheduled until a
 * retrieval on a later day earns that, and saying otherwise here would make
 * the panel disagree with the queue.
 */
const STAGE_PRESENTATION: Readonly<
  Record<string, { readonly label: string; readonly tone: "warning" | "success" | "neutral" }>
> = {
  learning: { label: "复习中", tone: "warning" },
  familiar: { label: "认识", tone: "success" },
  stable: { label: "已掌握", tone: "success" },
  paused: { label: "已暂停", tone: "neutral" },
  candidate: { label: "读到过", tone: "neutral" },
};

/**
 * The English words this lesson actually annotates, and where each one stands.
 *
 * Turning English mode on used to change only the body text, which left the
 * learner with no way to answer "how many words are in this lesson, and which
 * ones have I already dealt with" short of hovering every underline. The rail
 * beside the lesson had the room for it and was showing nothing.
 */
/**
 * How many nested detours to remember.
 *
 * Deep enough that following a link from a linked lesson still works, shallow
 * enough that "返回" always means somewhere the reader recognises. A stack that
 * remembers twenty hops is a stack nobody can predict.
 */
const LINK_RETURN_DEPTH = 5;

const REASON_RANK: Record<string, number> = { new: 0, learning: 1, familiar: 2 };

function LessonWordList({
  lexicon,
  stages,
  reasons,
}: {
  readonly lexicon: readonly LexiconEntry[];
  readonly stages: ReadonlyMap<string, string>;
  readonly reasons?: Readonly<Record<string, "new" | "learning" | "familiar">> | undefined;
}) {
  const voices = useEnglishVoices();
  const [voiceURI, setVoiceURI] = useState(readVoicePreference);
  const active = selectVoice(voices, voiceURI);

  const counts = useMemo(() => {
    let handled = 0;
    for (const entry of lexicon) {
      const stage = stages.get(entry.senseId);
      if (stage && stage !== "candidate") handled += 1;
    }
    return { handled, total: lexicon.length };
  }, [lexicon, stages]);

  if (lexicon.length === 0) return null;

  return (
    <section className="word-list" aria-label="本课外语词">
      <p className="eyebrow">ENGLISH IN THIS LESSON</p>
      <h3>
        {counts.total} 个词 · 已处理 {counts.handled}
      </h3>
      {voices.length > 1 ? (
        <label className="word-list__voice">
          <span>朗读声音</span>
          {/*
            No ranking is right on every machine, and the person listening is
            the only one who can hear the result. The default is the best-ranked
            local voice; this is the escape hatch when that judgement is wrong.
          */}
          <select
            value={active?.voiceURI ?? ""}
            onChange={(event) => {
              setVoiceURI(event.target.value);
              writeVoicePreference(event.target.value);
              const chosen = voices.find((voice) => voice.voiceURI === event.target.value);
              if (chosen) speakWord("preview", chosen);
            }}
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}（{voice.lang}）
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ul className="word-list__items">
        {/* Words the learner has not met lead the list. The ones they have
            claimed stay visible — this is also where they take it back — but
            they sink, so the list answers "what is new here" at a glance. */}
        {lexicon
          .toSorted(
            (left, right) =>
              (REASON_RANK[reasons?.[left.senseId] ?? "new"] ?? 0) -
              (REASON_RANK[reasons?.[right.senseId] ?? "new"] ?? 0),
          )
          .map((entry) => {
            const stage = stages.get(entry.senseId);
            const presentation = stage ? STAGE_PRESENTATION[stage] : undefined;
            return (
              <li key={entry.senseId} data-reason={reasons?.[entry.senseId]}>
                <button
                  type="button"
                  className="word-list__word"
                  onClick={() => {
                    const anchor = document.querySelector<HTMLElement>(
                      `[data-sense-id="${CSS.escape(entry.senseId)}"]`,
                    );
                    anchor?.scrollIntoView({ block: "center", behavior: "smooth" });
                    anchor?.focus();
                  }}
                >
                  <span lang="en">{entry.headword}</span>
                  <small>{entry.gloss}</small>
                </button>
                {presentation ? (
                  <GameBadge tone={presentation.tone}>{presentation.label}</GameBadge>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}

function LessonReader({
  locator,
  view,
  requestToken,
  onLearningChanged,
  neighbours,
  onOpenLesson,
  onBackToCourse,
  onFollowLink,
  onReturn,
}: {
  readonly locator: LessonLocator;
  readonly view: LessonView;
  readonly requestToken: string;
  readonly onLearningChanged: () => Promise<void>;
  /** Absent until the study tree has loaded; the lesson reads fine without it. */
  readonly neighbours?: LessonNeighbours | null;
  readonly onOpenLesson?: (locator: LessonLocator) => void;
  readonly onBackToCourse?: () => void;
  readonly onFollowLink?: ((target: LessonLinkTarget) => void) | undefined;
  /** Present only when a cross-lesson link brought the reader here. */
  readonly onReturn?: (() => void) | undefined;
}) {
  const [completed, setCompleted] = useState(view.lesson.progress?.status === "completed");
  const [englishMode, setEnglishMode] = useState(readForeignLanguageMode);
  const [vocabularyStages, setVocabularyStages] = useState<ReadonlyMap<string, string>>(new Map());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const annotated = view.lesson.language?.status === "annotated";

  const senseIds = view.lesson.language?.lexicon?.map((entry) => entry.senseId) ?? [];
  const senseKey = senseIds.join(",");

  useEffect(() => {
    if (!englishMode || senseKey.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const body = await readJson<{
          readonly states: readonly { readonly senseId: string; readonly stage: string }[];
        }>(await fetch("/api/vocabulary"));
        if (cancelled) return;
        setVocabularyStages(new Map(body.states.map((state) => [state.senseId, state.stage])));
      } catch {
        // Word stages are decoration on top of a lesson that reads fine without
        // them. Failing to load them must not take the lesson down with it.
      }
      // Recording that words appeared is deliberately fire-and-forget, and the
      // server counts one appearance per word per lesson per day however many
      // times this fires.
      void fetch("/api/vocabulary/presented", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-University-Local-Token": requestToken },
        body: JSON.stringify({
          studyId: locator.studyId,
          lessonId: locator.lessonId,
          senseIds: senseKey.split(","),
        }),
      }).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [englishMode, senseKey, locator.studyId, locator.lessonId, requestToken]);

  function stageWord(senseId: string, stage: "learning" | "familiar" | "paused") {
    setVocabularyStages((previous) => new Map(previous).set(senseId, stage));
    void fetch(`/api/vocabulary/${encodeURIComponent(senseId)}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-University-Local-Token": requestToken },
      body: JSON.stringify({ stage }),
    }).catch(() => undefined);
  }

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
      {onReturn ? (
        <button type="button" className="lesson-return" onClick={onReturn}>
          ← 回到刚才那一课
        </button>
      ) : null}
      {neighbours && onOpenLesson && onBackToCourse ? (
        <LessonNav
          neighbours={neighbours}
          onOpenLesson={onOpenLesson}
          onBackToCourse={onBackToCourse}
          variant="top"
        />
      ) : null}
      <header className="lesson-reader__header">
        <div>
          <p className="eyebrow">
            LESSON ·{" "}
            <Tip term="content-revision">
              <span>REV {view.lesson.contentRevision}</span>
            </Tip>
          </p>
          <h2 ref={titleRef} tabIndex={-1}>
            {view.lesson.title}
          </h2>
        </div>
        <div className="lesson-reader__header-actions">
          {annotated ? (
            // Only offered where there is something to offer. A toggle that
            // does nothing on most lessons teaches the learner to ignore it.
            <Tip term="english-mode">
              <button
                type="button"
                className="english-toggle"
                aria-pressed={englishMode}
                onClick={() => {
                  const next = !englishMode;
                  setEnglishMode(next);
                  writeForeignLanguageMode(next);
                }}
              >
                {englishMode ? "外语模式 · 开" : "外语模式 · 关"}
              </button>
            </Tip>
          ) : null}
          <GameBadge tone={completed ? "success" : "warning"}>
            {completed ? "已完成" : "学习中"}
          </GameBadge>
        </div>
      </header>
      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="markdown-body">
            <MarkdownContent
              {...(view.lesson.language ? { language: view.lesson.language } : {})}
              englishEnabled={englishMode}
              vocabularyStages={vocabularyStages}
              onStageWord={stageWord}
              {...(view.lesson.links ? { lessonLinks: view.lesson.links } : {})}
              {...(onFollowLink ? { onFollowLink } : {})}
              {...(view.lesson.evidenceAnchors
                ? { evidenceAnchors: view.lesson.evidenceAnchors }
                : {})}
            >
              {view.lesson.content}
            </MarkdownContent>
            {view.lesson.backlinks && view.lesson.backlinks.length > 0 ? (
              // The other half of associative linking. Without it, a link is a
              // one-way exit and the lesson it points at never learns it is
              // part of something.
              <section className="lesson-backlinks" aria-label="哪些课提到了这一课">
                <p className="eyebrow">MENTIONED BY</p>
                <ul>
                  {view.lesson.backlinks.map((entry) => (
                    <li key={`${entry.courseId}/${entry.unitId}/${entry.lessonId}`}>
                      <button
                        type="button"
                        onClick={() => onFollowLink?.(entry)}
                        disabled={!onFollowLink}
                      >
                        {entry.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          {view.lesson.exercises.map((exercise) => (
            <ExerciseBlock
              key={exercise.id}
              locator={locator}
              exercise={exercise}
              requestToken={requestToken}
              onCompleted={complete}
              onRefresh={onLearningChanged}
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
        <div className="lesson-rail">
          <EvidenceRail
            basePath={lessonPath(locator)}
            evidence={view.lesson.evidence}
            panelIdPrefix={`${locator.studyId}-${locator.courseId}-${locator.unitId}-${locator.lessonId}`}
          />
          {englishMode && annotated ? (
            <LessonWordList
              lexicon={view.lesson.language?.lexicon ?? []}
              stages={vocabularyStages}
              reasons={view.lesson.language?.reasons}
            />
          ) : null}
        </div>
      </div>
      {neighbours && onOpenLesson && onBackToCourse ? (
        <LessonNav
          neighbours={neighbours}
          onOpenLesson={onOpenLesson}
          onBackToCourse={onBackToCourse}
          variant="bottom"
        />
      ) : null}
    </article>
  );
}

export interface LessonNeighbour extends LessonLocator {
  readonly title: string;
}

export interface LessonNeighbours {
  readonly previous: LessonNeighbour | null;
  readonly next: LessonNeighbour | null;
  /** 1-based position within the course, for "第 7 节 / 共 41 节". */
  readonly position: number;
  readonly total: number;
}

/**
 * The lesson before and after this one, within its own course.
 *
 * Flattened across units rather than stopping at unit boundaries, because a
 * unit boundary is an authoring decision the learner never agreed to — running
 * out of "next" three lessons in reads as the course ending.
 *
 * Deliberately does not cross into another course. Courses have their own
 * audiences and prerequisites, so falling out of one into whichever happens to
 * sort next would be a worse surprise than stopping.
 */
export function lessonNeighbours(
  courses: readonly CourseView[],
  locator: LessonLocator,
): LessonNeighbours | null {
  const course = courses.find((item) => item.id === locator.courseId);
  if (!course) return null;
  const flat = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({
      studyId: locator.studyId,
      courseId: course.id,
      unitId: unit.id,
      lessonId: lesson.id,
      title: lesson.title,
    })),
  );
  const index = flat.findIndex((item) => item.lessonId === locator.lessonId);
  if (index === -1) return null;
  return {
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
    position: index + 1,
    total: flat.length,
  };
}

/**
 * Where to go when this lesson is done.
 *
 * Rendered twice per lesson — once quietly above the title, once properly at
 * the end. The bottom copy is the one that matters: finishing a lesson and
 * finding nothing but whitespace is the moment a learner leaves, and asking
 * them to scroll back up to a breadcrumb to continue is asking them to do the
 * app's job.
 */
function LessonNav({
  neighbours,
  onOpenLesson,
  onBackToCourse,
  variant,
}: {
  readonly neighbours: LessonNeighbours;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onBackToCourse: () => void;
  readonly variant: "top" | "bottom";
}) {
  const { previous, next } = neighbours;
  const position = (
    <span className="lesson-nav__position">
      第 {neighbours.position} 节 / 共 {neighbours.total} 节
    </span>
  );

  // Above the title this is a breadcrumb: where am I, and how do I get out.
  // Titles are left off on purpose — a second set of lesson names competing
  // with the actual heading is exactly the noise this variant exists to avoid.
  if (variant === "top") {
    return (
      <nav className="lesson-nav lesson-nav--top" aria-label="课程导航">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          ← 返回课程
        </GameButton>
        {position}
        <span className="lesson-nav__steps">
          {previous ? (
            <GameButton variant="ghost" onClick={() => onOpenLesson(previous)}>
              上一节
            </GameButton>
          ) : null}
          {next ? (
            <GameButton variant="ghost" onClick={() => onOpenLesson(next)}>
              下一节
            </GameButton>
          ) : null}
        </span>
      </nav>
    );
  }

  return (
    <nav className="lesson-nav lesson-nav--bottom" aria-label="学完这节之后">
      <div className="lesson-nav__side">
        {previous ? (
          <GameButton variant="ghost" onClick={() => onOpenLesson(previous)}>
            <span className="lesson-nav__step">← 上一节</span>
            <span className="lesson-nav__title">{previous.title}</span>
          </GameButton>
        ) : null}
      </div>
      <div className="lesson-nav__centre">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          回到目录
        </GameButton>
        {position}
      </div>
      <div className="lesson-nav__side lesson-nav__side--end">
        {next ? (
          <GameButton variant="primary" onClick={() => onOpenLesson(next)}>
            <span className="lesson-nav__step">下一节 →</span>
            <span className="lesson-nav__title">{next.title}</span>
          </GameButton>
        ) : null}
      </div>
    </nav>
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
        {/* Without this the ordering looks arbitrary: the learner sees a lesson
            from one study and has no way to tell whether that was a choice. */}
        {data.today.focus ? (
          <p className="today-focus">
            主攻 <strong>{focusLabel(data.today.focus, data.studies)}</strong>
            <span> · 复习卡片仍来自全部 study</span>
          </p>
        ) : null}
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
            <GameBadge tone="warning">
              {progressLabel(data.today.nextLesson.progress, data.today.nextLesson.contentRevision)}
            </GameBadge>
            <GameButton variant="primary" onClick={() => onOpenLesson(data.today.nextLesson!)}>
              {data.today.nextLesson.progress ? "继续学习" : "开始学习"}
            </GameButton>
          </div>
        </GamePanel>
      ) : null}

      {/* The review card is the day's actual work, so it leads the row and the
          tab order; the due-count metric is the supporting rail beside it. */}
      {card ? (
        <ReviewCard
          card={card}
          requestToken={data.requestToken}
          onReviewed={onReviewed}
          remaining={data.today.dueCount}
        />
      ) : (
        <GameCallout heading="今天没有到期卡片" tone="success" className="today-empty">
          {data.today.nextLesson
            ? "完成上面的课程后，新卡片会进入 FSRS 复习安排。"
            : "今天的复习已经清空，可以继续研究下一门课。"}
        </GameCallout>
      )}

      <VocabularyReview requestToken={data.requestToken} />

      <div className="today-metric">
        <span>{data.today.dueCount}</span>
        <Tip term="due-cards" as="div">
          <p className="eyebrow">DUE CARDS</p>
          <p>今天到期的复习卡片</p>
        </Tip>
      </div>
      {data.today.issues.length > 0 ? (
        <GameCallout heading="有学习数据暂时无法使用" tone="warning">
          {data.today.issues.join("；")}
        </GameCallout>
      ) : null}
    </div>
  );
}

/**
 * How many projects the shortcut row carries. Three is the point where a
 * shortcut stops being one: past that it is just the full list again, in an
 * order that changes under you.
 */
const RECENT_STUDY_LIMIT = 3;

/**
 * The projects actually being worked through, most recent first.
 *
 * Ordered by real learning events rather than by a pin the learner has to
 * maintain — the answer to "what am I in the middle of" is already written in
 * the review and completion log, and asking someone to also keep a pin list
 * current is asking them to restate what the system watched them do.
 *
 * The full list below stays alphabetical on purpose. A shelf that reorders
 * itself is a shelf you have to re-read; the shortcut row absorbs the movement
 * so the list underneath can stay somewhere you can point at from memory.
 */
export function recentStudies(studies: readonly StudySummary[]): readonly StudySummary[] {
  return studies
    .filter((study) => study.lastActivityAt !== null)
    .toSorted((left, right) => Date.parse(right.lastActivityAt!) - Date.parse(left.lastActivityAt!))
    .slice(0, RECENT_STUDY_LIMIT);
}

/** "3 小时前" — the unit a learner thinks in, not a timestamp they have to subtract. */
export function relativeTimeLabel(iso: string, now = Date.now()): string {
  const elapsedMs = now - Date.parse(iso);
  const format = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const scale: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
    ["year", 365 * 24 * 3_600_000],
    ["month", 30 * 24 * 3_600_000],
    ["day", 24 * 3_600_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of scale) {
    const value = Math.trunc(elapsedMs / ms);
    if (value >= 1) return format.format(-value, unit);
  }
  return "刚刚";
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
  const recent = useMemo(() => recentStudies(data.studies), [data.studies]);
  return (
    <aside className="study-shelf" aria-label="学习项目列表">
      {recent.length > 0 ? (
        <nav className="study-shelf__recent" aria-label="正在学习中">
          <p className="eyebrow">正在学习中</p>
          {recent.map((study) => (
            <button
              key={study.id}
              type="button"
              className="study-shelf__recent-item"
              data-active={selectedStudyId === study.id}
              aria-current={selectedStudyId === study.id ? "true" : undefined}
              onClick={() => onSelect(study.id)}
            >
              <span>{study.title}</span>
              <small>{relativeTimeLabel(study.lastActivityAt!)}</small>
            </button>
          ))}
        </nav>
      ) : null}
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
          <small>
            {study.activeCourseCount > 0 ? `${study.activeCourseCount} 门课可学习` : "准备中"}
          </small>
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

function CourseSection({
  studyId,
  course,
  onOpenLesson,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  readonly onOpenLesson: (locator: LessonLocator) => void;
}) {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  // Progress counts only against the revision the lesson is on now, matching
  // the per-lesson badge and the server's choice of next lesson. Counting an
  // old completion would call a course finished while it still has work in it.
  const completed = lessons.filter(
    (lesson) =>
      lesson.progress?.status === "completed" &&
      lesson.progress.contentRevision === lesson.contentRevision,
  ).length;
  const titleId = `course-title-${course.id}`;
  return (
    <section className="formal-course" aria-labelledby={titleId}>
      <header className="formal-course__header">
        <div>
          <p className="eyebrow">FORMAL CURRICULUM</p>
          <h2 id={titleId}>正式课程 · {course.title}</h2>
          <p>{course.description}</p>
        </div>
        <GameBadge tone="success">
          {completed === lessons.length ? "已学完" : "课程已发布"}
        </GameBadge>
      </header>
      {/* A bar with no number is decoration. "14%" is technically the same fact
          as "3 / 21 节", but only one of them tells you how many evenings are
          left — and lessons are the unit this progress is actually counted in. */}
      <GameProgress
        className="course-progress"
        value={completed}
        max={Math.max(lessons.length, 1)}
        label="课程完成度"
        tone={completed === lessons.length ? "success" : "accent"}
        valueLabel={`${completed} / ${lessons.length} 节`}
      />
      {/*
        Collapsed by default, and native <details> so it needs no script and
        works with a screen reader for free. These lines are written for someone
        who has finished the course; to someone opening it they are a wall of
        terms they came here precisely because they do not know yet. Shown
        unbidden that reads as "you are not ready for this".
      */}
      <details className="course-objectives">
        <summary>
          <span className="eyebrow">LEARNING OUTCOMES</span>
          <span>学完能做到的 {course.objectives.length} 件事</span>
        </summary>
        <ul>
          {course.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </details>
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
                        studyId,
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
                      tone={
                        lesson.progress?.status === "completed" &&
                        lesson.progress.contentRevision === lesson.contentRevision
                          ? "success"
                          : "neutral"
                      }
                    >
                      {progressLabel(lesson.progress, lesson.contentRevision)}
                    </GameBadge>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

interface AirlockView {
  readonly airlock: boolean;
  readonly verdict?: string;
  readonly problems?: readonly string[];
  readonly promotedCommit?: string;
  readonly upstream?: { readonly headCommit: string; readonly commitsAhead: number | null } | null;
  readonly course?: { readonly matchesAirlock: boolean | null } | null;
}

/**
 * The three clocks, for a study that is being taught out of an airlock.
 *
 * Being behind is the normal, correct state — the campus teaches the last
 * commit that was promoted, not whatever is in the editor right now — so this
 * reads as a fact rather than a warning. What does deserve attention is a seal
 * that no longer matches its checkout, and that is the only thing coloured as a
 * problem.
 */
function AirlockClocks({ studyId }: { readonly studyId: string }) {
  const [view, setView] = useState<AirlockView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await readJson<AirlockView>(await fetch(`/api/studies/${studyId}/airlock`));
        if (!cancelled) setView(body);
      } catch {
        if (!cancelled) setView({ airlock: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  if (!view?.airlock) return null;
  const ahead = view.upstream?.commitsAhead ?? null;
  return (
    <section className="airlock-clocks">
      <p className="eyebrow">AIRLOCK</p>
      <dl>
        <div>
          <dt>教材钉在</dt>
          <dd>
            <code>{view.promotedCommit?.slice(0, 8)}</code>
          </dd>
        </div>
        <div>
          <dt>上游走到</dt>
          <dd>
            <code>{view.upstream?.headCommit.slice(0, 8) ?? "读不到"}</code>
          </dd>
        </div>
        <div>
          <dt>相差</dt>
          <dd>{ahead === null ? "算不出（上游历史被改写过）" : `${ahead} 个提交`}</dd>
        </div>
        <div>
          <dt>课程快照</dt>
          <dd>{view.course?.matchesAirlock === false ? "落后于 airlock" : "与 airlock 一致"}</dd>
        </div>
      </dl>
      {view.verdict === "blocked" ? (
        <ul className="airlock-clocks__problems">
          {(view.problems ?? []).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : (
        <p className="airlock-clocks__note">
          落后是正常的：这里教的永远是上一次提升的那个提交，不是你编辑器里那份。
        </p>
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
      <AirlockClocks studyId={view.study.id} />
      {view.courses.length > 0 ? (
        view.courses.map((course) => (
          <CourseSection
            key={course.id}
            studyId={view.study.id}
            course={course}
            onOpenLesson={onOpenLesson}
          />
        ))
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
  // Seeded from the address bar, so a refresh or a pasted link lands where it
  // says it will rather than dropping the reader back on Today.
  const initialAddress = useMemo(() => parseAddress(window.location.pathname), []);
  const [activeSection, setActiveSection] = useState<SectionId>(initialAddress.section);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(initialAddress.studyId);
  const [studyView, setStudyView] = useState<StudyView | null>(null);
  const [lessonLocator, setLessonLocator] = useState<LessonLocator | null>(initialAddress.lesson);
  /** Lessons a cross-lesson link led away from, innermost last. */
  const [returnStack, setReturnStack] = useState<readonly LessonLocator[]>([]);
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
    // Open on the project last worked in. Falling straight to `studies[0]` meant
    // the shelf always landed on whichever title sorts first, so the learner's
    // first act every session was to navigate away from it.
    setSelectedStudyId(
      (current) => current ?? recentStudies(next.studies)[0]?.id ?? next.studies[0]?.id ?? null,
    );
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

  // The header counts courses, not studies with courses. It used to read the
  // study's single default course, so the number could never exceed the number
  // of studies no matter how many courses were published.
  const learnableCourses = useMemo(
    () => data?.studies.reduce((total, study) => total + study.activeCourseCount, 0) ?? 0,
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

  /**
   * Following a cross-lesson link, with a way back.
   *
   * The whole promise of the linear-plus-associative design is that a detour
   * is a detour. Without the stack, jumping to the lesson about how browsers
   * parse HTML abandons the lesson that sent you — and next time the reader
   * will not click, which costs the feature.
   *
   * Prev/next and the shelf deliberately clear the stack: those are decisions
   * to move on, not detours, and a "return to" offer that survives them would
   * be pointing somewhere the reader has stopped thinking about.
   */
  function followLessonLink(target: LessonLinkTarget) {
    if (lessonLocator) {
      setReturnStack((current) => [...current, lessonLocator].slice(-LINK_RETURN_DEPTH));
    }
    openLesson({ studyId: selectedStudyId ?? "", ...target });
  }

  function goBackFromLink() {
    const previous = returnStack.at(-1);
    if (!previous) return;
    setReturnStack((current) => current.slice(0, -1));
    openLesson(previous);
  }

  async function refreshLearning() {
    await loadBootstrap();
    if (selectedStudyId) await loadStudy(selectedStudyId);
    if (lessonLocator) await loadLesson(lessonLocator);
  }

  const address: AppAddress = {
    section: activeSection,
    studyId: activeSection === "studies" ? selectedStudyId : null,
    lesson: activeSection === "studies" ? lessonLocator : null,
  };

  // Push on navigation, and listen for the back button.
  //
  // Compared as formatted paths rather than as objects: two states that render
  // the same screen must not stack duplicate history entries, or Back appears
  // to do nothing and the reader presses it again.
  useEffect(() => {
    const next = formatAddress(address);
    if (next !== window.location.pathname) window.history.pushState(null, "", next);
  }, [address]);

  useEffect(() => {
    const onPopState = () => {
      const restored = parseAddress(window.location.pathname);
      setActiveSection(restored.section);
      setSelectedStudyId(restored.studyId);
      setLessonLocator(restored.lesson);
      // The detour stack belongs to a reading session, not to a URL. Going Back
      // past the lesson that offered a link makes "回到刚才那一课" meaningless.
      setReturnStack([]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Reading a lesson is the one screen with a single job. The section tabs and
  // the campus-wide counters answer questions nobody has while they are three
  // paragraphs into an explanation, and they cost the top of every page.
  const reading = activeSection === "studies" && lessonLocator !== null;

  return (
    <div className="campus" data-game-ui-theme="night" data-reading={reading || undefined}>
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
        {reading ? null : (
          <div className="campus-status" aria-label="校园状态">
            <Tip term="airlock">
              <GameBadge tone="success">资料仅在本机</GameBadge>
            </Tip>
            <Tip term="study">
              <span>{data?.studies.length ?? 0} 个 study</span>
            </Tip>
            <span>{learnableCourses} 门可学课程</span>
          </div>
        )}
      </header>

      {reading ? null : (
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
      )}

      <main
        ref={mainRef}
        id={`panel-${activeSection}`}
        // Without the tab list on screen there is no tab for this panel to be
        // labelled by, and claiming the role anyway points assistive tech at an
        // element that is not there.
        {...(reading
          ? { "aria-label": "课程正文" }
          : { role: "tabpanel", "aria-labelledby": `campus-section-${activeSection}` })}
        tabIndex={-1}
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
              {lessonView ? (
                <LessonReader
                  locator={lessonLocator}
                  view={lessonView}
                  requestToken={data.requestToken}
                  onLearningChanged={refreshLearning}
                  neighbours={studyView ? lessonNeighbours(studyView.courses, lessonLocator) : null}
                  onOpenLesson={(locator) => {
                    setReturnStack([]);
                    openLesson(locator);
                  }}
                  onBackToCourse={() => {
                    setReturnStack([]);
                    setLessonLocator(null);
                  }}
                  onFollowLink={followLessonLink}
                  onReturn={returnStack.length > 0 ? goBackFromLink : undefined}
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
