import { GameBadge, GameButton, GameCallout } from "@pieai/swimmer-ui-kit";
import type { ReactNode } from "react";

import { Tip } from "../Tip.js";
import { ReviewCard } from "../review/ReviewCard.js";
import { REVIEW_EMPTY_TITLE, reviewEmptyDescription } from "../review/review-empty.js";
import type { ReviewCardPort, VocabularyReviewPort } from "../review/ports.js";
import { VocabularyReview } from "../review/VocabularyReview.js";
import type { LessonProgress, LessonRef, NextLesson, TodayCard } from "../view/lesson-view.js";
import { progressLabel } from "../view/lesson-view.js";

/** The richer Today surface shared by both shells. */
export interface TodaySectionData {
  readonly card: TodayCard | null;
  readonly nextLesson: NextLesson | null;
  readonly dueCount: number;
  readonly issues: readonly string[];
}

/**
 * What the button on 「今天」 says.
 *
 * Exported because this panel is not the only thing that offers today's
 * lesson: below the rail's breakpoint a floating card on the map takes over,
 * and it used to say 「开始第一节」/「继续」 while this said 「开始学习」/「继续学习」.
 * Same action, same lesson, two vocabularies, decided by window width — which
 * is exactly the kind of difference nobody can see until they resize.
 *
 * On progress rather than on a streak, too. The streak says how many days in a
 * row you have shown up; it says nothing about whether *this* lesson is one
 * you have already begun, which is the only thing 「继续」 can honestly mean.
 */
export function todayCtaLabel(progress: LessonProgress | null | undefined): string {
  return progress ? "继续学习" : "开始学习";
}

export function todayMeta(
  studyTitle: string,
  progress: { readonly done: number; readonly total: number } | null,
): string {
  if (progress == null || progress.done === 0) return studyTitle;
  return `${studyTitle} · 还剩 ${Math.max(0, progress.total - progress.done)} 关`;
}

export function reviewLine(dueCount: number, dueTomorrow: number): string | null {
  if (dueCount > 0) return `复习 · ${dueCount} 张到期`;
  if (dueTomorrow > 0) return `复习 · 明天 ${dueTomorrow} 张`;
  return null;
}

export function TodaySection({
  data,
  onOpenLesson,
  onReviewed,
  contextAction,
  requestToken,
  review,
  vocabularyReview,
}: {
  readonly data: TodaySectionData;
  readonly onOpenLesson: (locator: LessonRef) => void;
  readonly onReviewed: () => Promise<void>;
  /** A secondary action belonging to the study named by this panel. */
  readonly contextAction?: ReactNode;
  /** Required only by the local HTTP grading/vocabulary fallback. */
  readonly requestToken?: string;
  /** Online's cloud scheduler implementation. */
  readonly review?: ReviewCardPort;
  readonly vocabularyReview?: VocabularyReviewPort;
}) {
  const card = data.card;
  const next = data.nextLesson;
  return (
    <div className="today-layout">
      <section className="today-hero">
        <p className="eyebrow">{next ? "今天的第一件事" : "今天，从回忆开始"}</p>
        {next ? (
          <>
            <h2>{next.lessonTitle}</h2>
            <div className="today-hero__context-row">
              <p className="today-hero__meta">
                {next.studyTitle} · {next.courseTitle}
              </p>
              {contextAction ? (
                <div className="today-hero__context-action">{contextAction}</div>
              ) : null}
            </div>
            <div className="today-hero__action">
              <GameButton variant="primary" onClick={() => onOpenLesson(next)}>
                {todayCtaLabel(next.progress)}
              </GameButton>
              <GameBadge tone="warning">
                {progressLabel(next.progress, next.contentRevision)}
              </GameBadge>
            </div>
          </>
        ) : (
          <h2>课程这边暂时没有待办。</h2>
        )}
        <p className="today-hero__note">课程负责建立理解，卡片只负责把重要知识留在长期记忆里。</p>
      </section>

      {card ? (
        <ReviewCard
          card={card}
          requestToken={requestToken}
          review={review}
          onReviewed={onReviewed}
          remaining={data.dueCount}
        />
      ) : (
        <GameCallout heading={REVIEW_EMPTY_TITLE} tone="success" className="today-empty">
          {reviewEmptyDescription(Boolean(next))}
        </GameCallout>
      )}

      <VocabularyReview requestToken={requestToken} review={vocabularyReview} />

      {data.dueCount > 0 ? (
        <div className="today-metric">
          <span>{data.dueCount}</span>
          <Tip term="due-cards" as="div">
            <p>今天到期的复习卡片</p>
          </Tip>
        </div>
      ) : null}
      {data.issues.length > 0 ? (
        <GameCallout heading="有学习数据暂时无法使用" tone="warning">
          {data.issues.join("；")}
        </GameCallout>
      ) : null}
    </div>
  );
}
