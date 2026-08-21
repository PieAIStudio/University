import { useEffect, useMemo, useRef, useState } from "react";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { Tip } from "../Tip.js";
import { lessonPath, readJson } from "../api/client.js";
import { EvidenceSourceSheet } from "../evidence/EvidenceSourceSheet.js";
import { LessonUaLayers } from "../evidence/EvidenceUaPlace.js";
import { readDetailMode, writeDetailMode, type DetailMode } from "../language/detail-mode.js";
import {
  readForeignSettings,
  writeForeignSettings,
  type ForeignSettings,
} from "../language/foreign-settings.js";
import { readForeignLanguageMode, writeForeignLanguageMode } from "../language/reading-mode.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";
import { ExerciseBlock } from "../review/ExerciseBlock.js";
import { ReviewCard } from "../review/ReviewCard.js";
import { isCurrentLessonCompleted, type LessonRef, type LessonView } from "../view/lesson-view.js";
import { LessonToolbar, type LessonNeighbours } from "./LessonNav.js";
import { LessonMarkList } from "./LessonMarkList.js";
import { LessonMargin } from "./LessonMargin.js";
import { LessonBacklinks } from "./LessonRelated.js";
import { LessonNextStep } from "./LessonNextStep.js";
import { LessonSourceVersion } from "./LessonSourceVersion.js";
import { LessonWordList } from "./LessonWordList.js";
import { SelectionMenu, type SelectionTarget } from "./SelectionMenu.js";
import {
  buildQuestionPrompt,
  type ReaderMark,
} from "@pieai/university-core/domain/reader-marks.js";

/**
 * How many nested detours to remember.
 *
 * Deep enough that following a link from a linked lesson still works, shallow
 * enough that "返回" always means somewhere the reader recognises. A stack that
 * remembers twenty hops is a stack nobody can predict.
 */
export const LINK_RETURN_DEPTH = 5;

type SourceTriggerKind = "inline" | "rail" | "unknown";

interface SourceReturnFocus {
  readonly element: HTMLElement | null;
  readonly index: number;
  readonly kind: SourceTriggerKind;
  readonly triggerId: string | null;
}

export function LessonReader({
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
  readonly locator: LessonRef;
  readonly view: LessonView;
  readonly requestToken: string;
  readonly onLearningChanged: () => Promise<void>;
  /** Absent until the study tree has loaded; the lesson reads fine without it. */
  readonly neighbours?: LessonNeighbours | null;
  readonly onOpenLesson?: (locator: LessonRef) => void;
  readonly onBackToCourse?: () => void;
  readonly onFollowLink?: ((target: LessonLinkTarget) => void) | undefined;
  /** Present only when a cross-lesson link brought the reader here. */
  readonly onReturn?: (() => void) | undefined;
}) {
  const completed = isCurrentLessonCompleted(view.lesson.progress, view.lesson.contentRevision);
  const readConfirmed = Boolean(
    view.lesson.progress?.readConfirmed &&
    view.lesson.progress.contentRevision === view.lesson.contentRevision,
  );
  const [englishMode, setEnglishMode] = useState(readForeignLanguageMode);
  const [detailMode, setDetailMode] = useState<DetailMode>(readDetailMode);
  const [vocabularyStages, setVocabularyStages] = useState<ReadonlyMap<string, string>>(new Map());
  const [vocabularyError, setVocabularyError] = useState<string | null>(null);
  const [foreignSettings, setForeignSettings] = useState(readForeignSettings);
  const [marks, setMarks] = useState<readonly ReaderMark[]>([]);
  const [markError, setMarkError] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const sourceReturnFocus = useRef<SourceReturnFocus | null>(null);
  const sourceHistoryOpen = useRef(false);
  const previousSourceIndex = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** The prose only. Selecting inside an exercise or the toolbar is not a mark. */
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Margin notes are placed relative to this column's top edge. */
  const marginRef = useRef<HTMLElement>(null);
  const annotated = view.lesson.language?.status === "annotated";

  const senseIds = view.lesson.language?.lexicon?.map((entry) => entry.senseId) ?? [];
  const senseKey = senseIds.join(",");
  const liveReasons = useMemo(() => {
    const original = view.lesson.language?.reasons;
    if (!original) return undefined;
    const next: Record<string, "new" | "learning" | "familiar"> = { ...original };
    for (const [senseId, stage] of vocabularyStages) {
      if (stage === "learning") next[senseId] = "learning";
      else if (stage === "familiar" || stage === "stable" || stage === "paused") {
        next[senseId] = "familiar";
      } else if (stage === "candidate") {
        next[senseId] = "new";
      }
    }
    return next;
  }, [view.lesson.language?.reasons, vocabularyStages]);

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
        setVocabularyError(null);
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

  /**
   * Marks are per-lesson here, even though the store keeps them per study: this
   * rail belongs to the lesson on screen, and a list that grew across every
   * lesson ever read would stop being a working set.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await readJson<{ readonly marks: readonly ReaderMark[] }>(
          await fetch(`/api/studies/${encodeURIComponent(locator.studyId)}/marks`),
        );
        if (!cancelled) setMarks(body.marks);
      } catch {
        // Marks are the reader's own annotations on top of a lesson that reads
        // fine without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locator.studyId, view.lesson.id]);

  const lessonKey = `${locator.courseId}/${locator.unitId}/${locator.lessonId}`;
  /*
    Open marks on this lesson.

    Resolved ones are filtered here rather than in each consumer. The server
    already omits them, but marking one resolved sets `resolvedAt` on the copy
    held in state instead of dropping it — so that the undo path has something
    to put back — and a margin that kept rendering it would leave the note
    sitting beside the passage after the reader said they were done with it.
  */
  const lessonMarks = useMemo(
    () => marks.filter((mark) => mark.lessonKey === lessonKey && mark.resolvedAt === null),
    [marks, lessonKey],
  );

  async function recordMark(kind: "question" | "highlight", target: SelectionTarget) {
    setMarkBusy(true);
    try {
      const body = await readJson<{ readonly mark: ReaderMark }>(
        await fetch(`${lessonPath(locator)}/marks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-University-Local-Token": requestToken,
          },
          body: JSON.stringify({
            contentRevision: view.lesson.contentRevision,
            kind,
            exact: target.quote.exact,
            prefix: target.quote.prefix,
            suffix: target.quote.suffix,
            ...(target.sectionTitle ? { sectionTitle: target.sectionTitle } : {}),
          }),
        }),
      );
      setMarks((current) => [...current, body.mark]);
    } catch (reason) {
      setMarkError(reason instanceof Error ? reason.message : "这条标记没有保存");
    } finally {
      setMarkBusy(false);
    }
  }

  async function mutateMark(markId: string, method: "POST" | "DELETE") {
    const previous = marks;
    // Removed from the list first: the rail is the reader's own scratch space,
    // and a delete that waits on a round trip feels broken on a local app.
    setMarks((current) =>
      method === "DELETE"
        ? current.filter((mark) => mark.markId !== markId)
        : current.map((mark) =>
            mark.markId === markId ? { ...mark, resolvedAt: new Date().toISOString() } : mark,
          ),
    );
    try {
      const response = await fetch(
        `/api/studies/${encodeURIComponent(locator.studyId)}/marks/${encodeURIComponent(markId)}`,
        {
          method,
          // Bodyless, but the server requires this on every state-changing
          // request: a form-encoded POST is the shape a cross-site form can
          // send without a preflight, so demanding JSON is part of what keeps
          // the loopback API from being driven by a page in another tab.
          headers: {
            "Content-Type": "application/json",
            "X-University-Local-Token": requestToken,
          },
        },
      );
      if (!response.ok) throw new Error("标记没有更新");
    } catch (reason) {
      setMarks(previous);
      setMarkError(reason instanceof Error ? reason.message : "标记没有更新");
    }
  }

  async function stageWord(senseId: string, stage: "learning" | "familiar" | "paused") {
    const previous = vocabularyStages;
    setVocabularyError(null);
    setVocabularyStages((current) => new Map(current).set(senseId, stage));
    try {
      const body = await readJson<{
        readonly state: { readonly senseId: string; readonly stage: string };
      }>(
        await fetch(`/api/vocabulary/${encodeURIComponent(senseId)}/stage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-University-Local-Token": requestToken,
          },
          body: JSON.stringify({ stage }),
        }),
      );
      setVocabularyStages((current) => new Map(current).set(body.state.senseId, body.state.stage));
    } catch (reason) {
      setVocabularyStages(previous);
      setVocabularyError(reason instanceof Error ? reason.message : "词义状态没有保存");
    }
  }

  // Opening a lesson swaps the whole main region. Without moving focus, a
  // keyboard or screen-reader user is left on a control that just unmounted
  // and has to tab through the entire chrome to reach the new content.
  useEffect(() => {
    titleRef.current?.focus();
  }, [view.lesson.id]);

  useEffect(() => {
    if (previousSourceIndex.current !== null && sourceIndex === null) {
      const source = sourceReturnFocus.current;
      // The modal unmounts in the same React turn as popstate. Waiting one task
      // lets the portal release focus first, so keyboard users land back on the
      // evidence control that opened the sheet rather than on document.body.
      window.setTimeout(() => {
        if (!source) return;
        const trigger = source.element?.isConnected
          ? source.element
          : source.triggerId
            ? [...document.querySelectorAll<HTMLElement>("[data-evidence-trigger-id]")].find(
                (candidate) => candidate.dataset.evidenceTriggerId === source.triggerId,
              )
            : document.querySelector<HTMLElement>(
                source.kind === "unknown"
                  ? `[data-evidence-index="${source.index}"]`
                  : `[data-evidence-index="${source.index}"][data-evidence-trigger="${source.kind}"]`,
              );
        trigger?.focus();
      }, 50);
    }
    previousSourceIndex.current = sourceIndex;
  }, [sourceIndex]);

  useEffect(() => {
    if (sourceIndex === null) return;
    if (!sourceHistoryOpen.current) {
      window.history.pushState({ universityLocalSourceSheet: true }, "", window.location.href);
      sourceHistoryOpen.current = true;
    }
    const onPopState = () => {
      sourceHistoryOpen.current = false;
      setSourceIndex(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sourceIndex]);

  function closeSourceSheet() {
    if (sourceHistoryOpen.current) {
      window.history.back();
      return;
    }
    setSourceIndex(null);
  }

  function openSourceSheet(index: number, trigger?: HTMLElement) {
    const element =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const kind: SourceTriggerKind =
      element?.dataset.evidenceTrigger === "inline" || element?.dataset.evidenceTrigger === "rail"
        ? element.dataset.evidenceTrigger
        : "unknown";
    sourceReturnFocus.current = {
      element,
      index,
      kind,
      triggerId: element?.dataset.evidenceTriggerId ?? null,
    };
    setSourceIndex(index);
  }

  async function confirmCurrentRevision() {
    setConfirming(true);
    setConfirmationError(null);
    try {
      await readJson(
        await fetch(`${lessonPath(locator)}/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-University-Local-Token": requestToken,
          },
          body: JSON.stringify({
            commandId: crypto.randomUUID(),
            contentRevision: view.lesson.contentRevision,
          }),
        }),
      );
      await onLearningChanged();
    } catch (reason) {
      setConfirmationError(reason instanceof Error ? reason.message : "暂时无法记录阅读确认");
    } finally {
      setConfirming(false);
    }
  }

  function setEnglishModePersisted(enabled: boolean) {
    setEnglishMode(enabled);
    writeForeignLanguageMode(enabled);
  }

  function setDetailModePersisted(mode: DetailMode) {
    setDetailMode(mode);
    writeDetailMode(mode);
  }

  function setForeignSettingsPersisted(next: ForeignSettings) {
    setForeignSettings(next);
    writeForeignSettings(next);
  }

  const lexicon = view.lesson.language?.lexicon ?? [];
  const backlinks = view.lesson.backlinks ?? [];
  /*
    Outgoing links are deliberately not listed anywhere.

    Every `[[lesson:…]]` already renders as a styled, clickable button standing
    in the sentence that motivated it — which is the context a list can never
    reproduce. Across all 561 lessons there are 370 of these, at most three in
    any one lesson, and 56% of lessons have none; a panel repeating up to three
    links that are already on screen was a second copy competing with the
    original. Backlinks are different: they are the only place a lesson can
    learn that other lessons depend on it, and nothing in this prose points at
    them, so they sit at the end rather than beside a paragraph they have no
    relationship to.
  */
  const showLeftContent = Boolean(onReturn) || lessonMarks.length > 0;
  const showWords = englishMode && annotated && lexicon.length > 0;
  // Marks are not part of the English layer, so the rail has to open for them
  // on their own. Tying them to `englishMode` would hide a reader's own notes
  // the moment they turned vocabulary off.
  const showRightContent = showWords || lessonMarks.length > 0;

  return (
    <article className="lesson-reader">
      {neighbours && onOpenLesson && onBackToCourse ? (
        <LessonToolbar
          neighbours={neighbours}
          onOpenLesson={onOpenLesson}
          onBackToCourse={onBackToCourse}
          annotated={annotated}
          englishMode={englishMode}
          onEnglishModeChange={setEnglishModePersisted}
          detailMode={detailMode}
          onDetailModeChange={setDetailModePersisted}
          completed={completed}
          readConfirmed={readConfirmed}
        />
      ) : null}
      {/*
        Three columns always: empty rails still reserve width so the prose
        column stays page-centred. Empty rails render no box, border, or heading.
      */}
      <div className="lesson-layout">
        {/*
          Not a sticky rail any more. Notes are positioned against the prose, so
          the column has to scroll with it — a sticky container would hold them
          still while the passages they point at moved away.
        */}
        <aside
          ref={marginRef}
          className="lesson-margin-column"
          {...(showLeftContent ? { "aria-label": "页边批注" } : { "aria-hidden": true })}
        >
          {onReturn ? (
            <button type="button" className="lesson-return" onClick={onReturn}>
              ← 回到刚才那一课
            </button>
          ) : null}
          <LessonMargin
            marks={lessonMarks}
            bodyRef={bodyRef}
            columnRef={marginRef}
            onResolve={(markId) => void mutateMark(markId, "POST")}
            onDelete={(markId) => void mutateMark(markId, "DELETE")}
          />
        </aside>
        <div className="lesson-main">
          <header className="lesson-reader__header">
            <div className="lesson-reader__title">
              <p className="eyebrow">
                <Tip term="content-revision">
                  <span>第 {view.lesson.contentRevision} 版</span>
                </Tip>
              </p>
              <h2 ref={titleRef} tabIndex={-1}>
                {view.lesson.title}
              </h2>
              <LessonUaLayers evidence={view.lesson.evidence} />
              {view.lesson.pinnedCommit ? (
                <LessonSourceVersion
                  studyId={locator.studyId}
                  sourceCommit={view.lesson.pinnedCommit.commit}
                  {...(view.lesson.pinnedCommit.date
                    ? { sourceCommitDate: view.lesson.pinnedCommit.date }
                    : {})}
                />
              ) : null}
            </div>
          </header>
          <div className="markdown-body lesson-prose" ref={bodyRef}>
            <MarkdownContent
              {...(view.lesson.language
                ? {
                    language: {
                      ...view.lesson.language,
                      ...(liveReasons ? { reasons: liveReasons } : {}),
                    },
                  }
                : {})}
              englishEnabled={englishMode}
              foreignSettings={foreignSettings}
              vocabularyStages={vocabularyStages}
              onStageWord={stageWord}
              {...(view.lesson.links ? { lessonLinks: view.lesson.links } : {})}
              {...(onFollowLink ? { onFollowLink } : {})}
              {...(view.lesson.evidenceAnchors
                ? { evidenceAnchors: view.lesson.evidenceAnchors }
                : {})}
              {...(view.lesson.termAnchors ? { termAnchors: view.lesson.termAnchors } : {})}
              evidence={view.lesson.evidence}
              evidenceBasePath={lessonPath(locator)}
              onOpenEvidence={(index, trigger) => openSourceSheet(index, trigger)}
              assets={view.lesson.assets}
              sections={view.lesson.sections ?? []}
              detailMode={detailMode}
            >
              {view.lesson.content}
            </MarkdownContent>
          </div>
          {!completed ? (
            <section className="lesson-completion" aria-labelledby="lesson-completion-title">
              <div>
                <h3 id="lesson-completion-title">读到这里，确认你完成了这次课文更新</h3>
                <p>
                  {readConfirmed
                    ? "这版课文已经记录过阅读确认；练习通过后，系统才会把本课标为完成并安排卡片。"
                    : "打开课文、滚动页面或答对练习都不会自动完成。这个确认只针对当前固定版本。"}
                </p>
              </div>
              <button
                type="button"
                className="lesson-completion__action"
                onClick={() => void confirmCurrentRevision()}
                disabled={confirming}
              >
                {confirming ? "正在记录…" : readConfirmed ? "再次确认本次更新" : "完成本次更新"}
              </button>
              {confirmationError ? (
                <p className="inline-error" role="alert">
                  {confirmationError}
                </p>
              ) : null}
            </section>
          ) : null}
          {view.lesson.exercises.map((exercise) => (
            <ExerciseBlock
              key={exercise.id}
              locator={locator}
              exercise={exercise}
              requestToken={requestToken}
              onRefresh={onLearningChanged}
            />
          ))}
          {completed && view.lesson.cards.length > 0 ? (
            <section className="lesson-practice">
              <div>
                <h2>通过答题巩固刚学到的内容</h2>
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
          <LessonBacklinks backlinks={backlinks} {...(onFollowLink ? { onFollowLink } : {})} />
          {neighbours && onOpenLesson && onBackToCourse ? (
            <LessonNextStep
              neighbours={neighbours}
              completed={completed}
              onOpenLesson={onOpenLesson}
              onBackToCourse={onBackToCourse}
            />
          ) : null}
        </div>
        <aside
          className="lesson-rail lesson-rail--right"
          {...(showRightContent ? { "aria-label": "阅读笔记" } : { "aria-hidden": true })}
        >
          {showRightContent ? (
            <>
              {vocabularyError ? (
                <p className="inline-error" role="alert">
                  {vocabularyError}
                </p>
              ) : null}
              {markError ? (
                <p className="inline-error" role="alert">
                  {markError}
                </p>
              ) : null}
              {/*
                The batch, not a second copy of the notes. Each mark already
                shows itself in the margin beside its passage; what the margin
                cannot do is hand the whole set to someone to answer at once.
              */}
              <LessonMarkList
                marks={lessonMarks}
                studyTitle={locator.studyId}
                lessonTitles={new Map([[lessonKey, view.lesson.title]])}
              />
              {showWords ? (
                <LessonWordList
                  lexicon={lexicon}
                  stages={vocabularyStages}
                  reasons={liveReasons}
                  onStageWord={stageWord}
                  settings={foreignSettings}
                  onSettingsChange={setForeignSettingsPersisted}
                />
              ) : null}
            </>
          ) : null}
        </aside>
      </div>
      <SelectionMenu
        containerRef={bodyRef}
        busy={markBusy}
        onMark={(kind, target) => void recordMark(kind, target)}
        onAsk={(target) => {
          // One passage, same prompt shape as the batch — so a single question
          // and a batch of them read the same way to whoever answers.
          void navigator.clipboard?.writeText(
            buildQuestionPrompt(
              [
                {
                  markId: "pending",
                  lessonKey,
                  contentRevision: view.lesson.contentRevision,
                  kind: "question",
                  quote: target.quote,
                  sectionTitle: target.sectionTitle ?? null,
                  note: null,
                  createdAt: new Date().toISOString(),
                  resolvedAt: null,
                },
              ],
              {
                studyTitle: locator.studyId,
                lessonTitles: new Map([[lessonKey, view.lesson.title]]),
              },
            ),
          );
        }}
      />
      <EvidenceSourceSheet
        studyId={locator.studyId}
        basePath={lessonPath(locator)}
        evidence={view.lesson.evidence}
        index={sourceIndex}
        onClose={closeSourceSheet}
        onSelectIndex={setSourceIndex}
      />
    </article>
  );
}
