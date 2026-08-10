import { useEffect, useMemo, useRef, useState } from "react";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { Tip } from "../Tip.js";
import { lessonPath, readJson } from "../api/client.js";
import { EvidenceSourceSheet } from "../evidence/EvidenceSourceSheet.js";
import { readDetailMode, writeDetailMode, type DetailMode } from "../language/detail-mode.js";
import { readForeignLanguageMode, writeForeignLanguageMode } from "../language/reading-mode.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";
import { ExerciseBlock } from "../review/ExerciseBlock.js";
import { ReviewCard } from "../review/ReviewCard.js";
import {
  isCurrentLessonCompleted,
  type LessonLocator,
  type LessonView,
} from "../view/lesson-view.js";
import { LessonToolbar, type LessonNeighbours } from "./LessonNav.js";
import { LessonRelated, uniqueOutgoingTargets } from "./LessonRelated.js";
import { LessonWordList } from "./LessonWordList.js";

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
  const completed = isCurrentLessonCompleted(view.lesson.progress, view.lesson.contentRevision);
  const readConfirmed = Boolean(
    view.lesson.progress?.readConfirmed &&
    view.lesson.progress.contentRevision === view.lesson.contentRevision,
  );
  const [englishMode, setEnglishMode] = useState(readForeignLanguageMode);
  const [detailMode, setDetailMode] = useState<DetailMode>(readDetailMode);
  const [vocabularyStages, setVocabularyStages] = useState<ReadonlyMap<string, string>>(new Map());
  const [vocabularyError, setVocabularyError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const sourceReturnFocus = useRef<SourceReturnFocus | null>(null);
  const sourceHistoryOpen = useRef(false);
  const previousSourceIndex = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
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

  const lexicon = view.lesson.language?.lexicon ?? [];
  const backlinks = view.lesson.backlinks ?? [];
  const outgoing = useMemo(() => uniqueOutgoingTargets(view.lesson.links), [view.lesson.links]);
  const showLeftContent = Boolean(onReturn) || outgoing.length > 0 || backlinks.length > 0;
  const showRightContent = englishMode && annotated && lexicon.length > 0;

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
        <aside
          className="lesson-rail lesson-rail--left"
          {...(showLeftContent ? { "aria-label": "去其他课" } : { "aria-hidden": true })}
        >
          {onReturn ? (
            <button type="button" className="lesson-return" onClick={onReturn}>
              ← 回到刚才那一课
            </button>
          ) : null}
          <LessonRelated outgoing={outgoing} backlinks={backlinks} onFollowLink={onFollowLink} />
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
            </div>
          </header>
          <div className="markdown-body">
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
              vocabularyStages={vocabularyStages}
              onStageWord={stageWord}
              {...(view.lesson.links ? { lessonLinks: view.lesson.links } : {})}
              {...(onFollowLink ? { onFollowLink } : {})}
              {...(view.lesson.evidenceAnchors
                ? { evidenceAnchors: view.lesson.evidenceAnchors }
                : {})}
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
              <LessonWordList
                lexicon={lexicon}
                stages={vocabularyStages}
                reasons={liveReasons}
                onStageWord={stageWord}
              />
            </>
          ) : null}
        </aside>
      </div>
      <EvidenceSourceSheet
        basePath={lessonPath(locator)}
        evidence={view.lesson.evidence}
        index={sourceIndex}
        onClose={closeSourceSheet}
        onSelectIndex={setSourceIndex}
      />
    </article>
  );
}
