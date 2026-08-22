import { useEffect, useState, useSyncExternalStore } from "react";

import { loadCourse } from "../content/library";
import { dueCards, gradeCard, snapshot, subscribe } from "../progress/store";

export function ReviewHost({ onDone }: { onDone: () => void }) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const [revealed, setRevealed] = useState(false);
  const [cards, setCards] = useState<
    Record<string, { front: string; back: string; course: string }>
  >({});
  const queue = dueCards();
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    void loadCourse(current.studyId, current.courseId).then((course) => {
      const lesson = course.units
        .flatMap((unit) => unit.lessons)
        .find((entry) => entry.id === current.lessonId);
      const cardId = current.cardKey.split("/").pop();
      const card = lesson?.cards.find((entry) => entry.id === cardId);
      if (card) {
        setCards((existing) => ({
          ...existing,
          [current.cardKey]: { front: card.front, back: card.back, course: course.title },
        }));
      }
    });
  }, [current, progress]);

  if (!current) {
    return (
      <div className="review">
        <div className="review__done">
          <b>今天没有到期卡片</b>
          <p>学一节新课，它会掉落新的卡片，明天就有事做了。</p>
          <button className="primary" onClick={onDone}>
            回到世界地图
          </button>
        </div>
      </div>
    );
  }

  const card = cards[current.cardKey];

  return (
    <div className="review">
      <div className="review__bar">
        <span>还剩 {queue.length} 张</span>
        <button className="linkish" onClick={onDone}>
          稍后再复习
        </button>
      </div>
      <div className="review__card">
        <p className="review__from">来自 {card?.course ?? "…"}</p>
        <div className="review__front">{card?.front ?? "读取中…"}</div>
        {revealed ? <div className="review__back">{card?.back}</div> : null}
        {revealed ? (
          <div className="review__grades">
            {(
              [
                // "没想起来" rather than "忘了": FSRS reads this rating as the
                // card not arriving in time, not as a failure, and the word on
                // the button is the only place a learner meets that difference.
                ["again", "没想起来"],
                ["hard", "有点吃力"],
                ["good", "想起来了"],
                ["easy", "很轻松"],
              ] as const
            ).map(([rating, label]) => (
              <button
                key={rating}
                onClick={() => {
                  gradeCard(current.cardKey, rating);
                  setRevealed(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button className="primary block" onClick={() => setRevealed(true)}>
            显示答案
          </button>
        )}
      </div>
    </div>
  );
}
