/**
 * What you just earned.
 *
 * Before this screen a lesson simply stopped. The answer was graded, cards were
 * written to storage, an island somewhere gained a house — and none of it was
 * shown to the person it happened to. A loop whose reward is invisible is a
 * loop nobody comes back to, and this is the one screen that decides whether
 * tomorrow happens.
 *
 * Everything here is read from real state rather than composed for effect: the
 * card count is the cards that dropped, the date is what FSRS actually
 * returned, and the course line is counted from the store. If the numbers are
 * ever wrong, the screen is wrong, which is the only honest way to build a
 * reward.
 *
 * It also names what changed *in the world*, because that is the product's
 * whole claim — the reading happens in the DOM and the reason to care happens
 * on the map, and this is the sentence that connects them.
 */
import type { Card } from "../content/library";

/** How the settlement talks about a due date a learner has to plan around. */
function whenDue(dueAt: number, now = Date.now()): string {
  const hours = (dueAt - now) / 3_600_000;
  if (hours <= 0) return "现在就可以复习";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟后回来`;
  if (hours < 20) return `${Math.round(hours)} 小时后回来`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "明天回来" : `${days} 天后回来`;
}

/**
 * What the island gained, in the same words the map uses.
 *
 * The bands match `dress()` in Maps.tsx: nature is always there, the settlement
 * is what progress owns, and the hall only appears when the course is finished.
 * Saying "多了一间房子" when no house appeared would be the reward lying, so the
 * thresholds are the same numbers the world is drawn from.
 */
function whatGrew(before: number, after: number, lessons: number): string | null {
  if (lessons <= 0) return null;
  if (after >= 1) return "这座岛建成了 —— 村子中央立起了会堂。";
  const claim = Math.max(1, Math.round(lessons * 0.45));
  const built = (fraction: number) => Math.round(fraction * claim);
  if (built(after) <= built(before)) return null;
  const first = built(before) === 0;
  return first ? "岛上开出了第一块地，井挖好了。" : "岛上又立起了一间房子。";
}

export function Settlement({
  lessonTitle,
  courseTitle,
  dropped,
  doneBefore,
  doneAfter,
  lessons,
  streakDays,
  onNext,
  onMap,
  nextTitle,
}: {
  lessonTitle: string;
  courseTitle: string;
  /** The cards this lesson just dropped, with the schedule FSRS gave them. */
  dropped: readonly { readonly card: Card; readonly dueAt: number }[];
  doneBefore: number;
  doneAfter: number;
  lessons: number;
  streakDays: number;
  onNext: (() => void) | null;
  onMap: () => void;
  nextTitle: string | null;
}) {
  const soonest = dropped.reduce(
    (best, entry) => (best === null || entry.dueAt < best ? entry.dueAt : best),
    null as number | null,
  );
  const grew = whatGrew(doneBefore / lessons, doneAfter / lessons, lessons);

  return (
    <main className="settle">
      <p className="settle__eyebrow">{courseTitle}</p>
      <h1 className="settle__title">{lessonTitle}</h1>
      <p className="settle__done">读完了。</p>

      <ol className="settle__gains">
        <li>
          <b>{doneAfter}</b>
          <span>
            / {lessons} 关 · 还剩 {Math.max(0, lessons - doneAfter)} 关
          </span>
        </li>
        {dropped.length > 0 ? (
          <li>
            <b>{dropped.length}</b>
            <span>张卡片进了复习队列{soonest === null ? "" : ` · ${whenDue(soonest)}`}</span>
          </li>
        ) : null}
        {streakDays > 0 ? (
          <li>
            <b>{streakDays}</b>
            <span>天连击</span>
          </li>
        ) : null}
      </ol>

      {grew ? <p className="settle__world">{grew}</p> : null}

      {dropped.length > 0 ? (
        <section className="settle__cards">
          <h2>今天记下的是这些</h2>
          {dropped.map(({ card }) => (
            <div className="settle__card" key={card.id}>
              <b>{card.front}</b>
              <span>{card.back}</span>
            </div>
          ))}
          <p className="settle__note">现在不用背。到期时它们会自己回来，这是间隔重复该做的事。</p>
        </section>
      ) : null}

      <div className="settle__actions">
        {onNext ? (
          <button className="primary" onClick={onNext}>
            下一关{nextTitle ? ` · ${nextTitle}` : ""} →
          </button>
        ) : null}
        <button className={onNext ? "ghost" : "primary"} onClick={onMap}>
          回关卡地图
        </button>
      </div>
    </main>
  );
}
