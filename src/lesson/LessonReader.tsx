import { useEffect, useRef, useState } from "react";
import { GameBadge } from "@pieai/swimmer-ui-kit";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { Tip } from "../Tip.js";
import { lessonPath, readJson } from "../api/client.js";
import { EvidenceRail } from "../evidence/EvidenceRail.js";
import { readForeignLanguageMode, writeForeignLanguageMode } from "../language/reading-mode.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";
import { ExerciseBlock } from "../review/ExerciseBlock.js";
import { ReviewCard } from "../review/ReviewCard.js";
import type { LessonLocator, LessonView } from "../view/lesson-view.js";
import { LessonNav, type LessonNeighbours } from "./LessonNav.js";
import { LessonWordList } from "./LessonWordList.js";

/**
 * How many nested detours to remember.
 *
 * Deep enough that following a link from a linked lesson still works, shallow
 * enough that "返回" always means somewhere the reader recognises. A stack that
 * remembers twenty hops is a stack nobody can predict.
 */
export const LINK_RETURN_DEPTH = 5;

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
