import { GameBadge, GameButton, GameCallout } from "@pieai/swimmer-ui-kit";

import { Tip } from "@pieai/university-ui/Tip.js";
import { ReviewCard } from "@pieai/university-ui/review/ReviewCard.js";
import { VocabularyReview } from "@pieai/university-ui/review/VocabularyReview.js";
import type { BootstrapData, LessonLocator } from "@pieai/university-ui/view/lesson-view.js";
import { focusParts, progressLabel } from "@pieai/university-ui/view/lesson-view.js";

/**
 * The page someone opens every day, so the largest thing on it should be the
 * thing that changes.
 *
 * It used to be 「先完成一节课，再巩固记忆。」 at 85px — true, well put, and
 * identical every morning for as long as the product is used, while the lesson
 * it was telling you to start sat underneath it at 22px inside a card. A rule
 * of the system earns that size once, on the first visit; after that it is
 * furniture, and the reader has to look past the biggest thing on the page to
 * find the only thing they came for.
 *
 * So the lesson's own title is the headline now and the principle keeps its
 * words at the size a standing note deserves. Nothing was cut.
 */
export function TodaySection({
  data,
  onOpenLesson,
  onReviewed,
}: {
  readonly data: BootstrapData;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onReviewed: () => Promise<void>;
}) {
  const card = data.today.card;
  const next = data.today.nextLesson;
  const focus = data.today.focus ? focusParts(data.today.focus, data.studies) : null;
  return (
    <div className="today-layout">
      <section className="today-hero">
        <p className="eyebrow">{next ? "今天的第一件事" : "今天，从回忆开始"}</p>
        {next ? (
          <>
            <h2>{next.lessonTitle}</h2>
            <p className="today-hero__meta">
              {next.studyTitle} · {next.courseTitle}
            </p>
            <div className="today-hero__action">
              <GameButton variant="primary" onClick={() => onOpenLesson(next)}>
                {next.progress ? "继续学习" : "开始学习"}
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
        {/* Without this the ordering looks arbitrary: the learner sees a lesson
            from one study and has no way to tell whether that was a choice. */}
        {focus ? (
          <p className="today-focus">
            主攻 <strong>{focus.study}</strong>
            {focus.detail ? <span className="today-focus__detail"> · {focus.detail}</span> : null}
            <span> · 复习卡片仍来自全部 study</span>
          </p>
        ) : null}
      </section>

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
          {next ? "完成上面的课程后，新卡片会进入 FSRS 复习安排。" : "今天的复习已经清空。"}
        </GameCallout>
      )}

      <VocabularyReview requestToken={data.requestToken} />

      {/*
        A count is a metric while there is something to count. At zero it was a
        display-sized 0 sitting beside a callout that had already said 「今天没有
        到期卡片」 — the same fact twice, one of them rendered at the scale this
        page uses for achievement. Nothing due is good news, and the callout is
        where it belongs.
      */}
      {data.today.dueCount > 0 ? (
        <div className="today-metric">
          <span>{data.today.dueCount}</span>
          <Tip term="due-cards" as="div">
            <p>今天到期的复习卡片</p>
          </Tip>
        </div>
      ) : null}
      {data.today.issues.length > 0 ? (
        <GameCallout heading="有学习数据暂时无法使用" tone="warning">
          {data.today.issues.join("；")}
        </GameCallout>
      ) : null}
    </div>
  );
}
