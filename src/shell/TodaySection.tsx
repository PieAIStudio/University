import { GameBadge, GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";

import { Tip } from "../Tip.js";
import { ReviewCard } from "../review/ReviewCard.js";
import { VocabularyReview } from "../review/VocabularyReview.js";
import type { BootstrapData, LessonLocator } from "../view/lesson-view.js";
import { focusParts, progressLabel } from "../view/lesson-view.js";

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
  return (
    <div className="today-layout">
      <section className="today-intro">
        <h2>{data.today.nextLesson ? "先完成一节课，再巩固记忆。" : "今天，从回忆开始。"}</h2>
        <p>课程负责建立理解，卡片只负责把重要知识留在长期记忆里。</p>
        {/* Without this the ordering looks arbitrary: the learner sees a lesson
            from one study and has no way to tell whether that was a choice. */}
        {data.today.focus ? (
          <p className="today-focus">
            主攻 <strong>{focusParts(data.today.focus, data.studies).study}</strong>
            {focusParts(data.today.focus, data.studies).detail ? (
              <span className="today-focus__detail">
                {" "}
                · {focusParts(data.today.focus, data.studies).detail}
              </span>
            ) : null}
            <span> · 复习卡片仍来自全部 study</span>
          </p>
        ) : null}
      </section>

      {data.today.nextLesson ? (
        <GamePanel className="next-lesson" tone="strong">
          <div>
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
