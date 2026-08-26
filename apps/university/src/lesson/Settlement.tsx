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
import { useEffect, useState, type ReactNode } from "react";
import { GameButton, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import { NodeCard, type PathLesson, type PathUnit } from "@pieai/university-ui";
import { playSound } from "@pieai/university-ui/sound/index.js";

/**
 * Both sides of a card that just dropped.
 *
 * Not the package's `Card`: this screen is reached in both builds now, and one
 * of them has no package. The two sides are resolved through `ContentPort` by
 * the host, which is the only thing that knows where a card body comes from.
 */
export interface SettledCard {
  readonly id: string;
  readonly front: string;
  readonly back: string;
}

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
 * The counts arrive already measured, from the same function `dress()` draws
 * with. They used to be recomputed here from the lesson count against `0.45`,
 * while the map applied `0.45` to the island's *slot* count — a different
 * number derived from its radius. The two agreed by coincidence and disagreed
 * whenever a course's lesson count and island size pulled apart, so this screen
 * could announce a house that never appeared. A reward that lies is worse than
 * one that stays quiet, which is also why `null` is a normal answer here.
 */
function whatGrew(builtBefore: number, builtAfter: number, complete: boolean): string | null {
  if (complete) return "这座岛建成了 —— 村子中央立起了会堂。";
  if (builtAfter <= builtBefore) return null;
  return builtBefore === 0 ? "岛上开出了第一块地，井挖好了。" : "岛上又立起了一间房子。";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Settlement({
  lessonTitle,
  courseTitle,
  dropped,
  builtBefore,
  builtAfter,
  doneBefore,
  doneAfter,
  lessons,
  streakDays,
  unlocked,
  recap,
  tomorrowDueCount = 0,
  reviewReminder,
  nextLesson,
  nextUnit,
  onNext,
  onMap,
  onStartUnit,
}: {
  lessonTitle: string;
  courseTitle: string;
  /** The cards this lesson just dropped, with the schedule FSRS gave them. */
  dropped: readonly { readonly card: SettledCard; readonly dueAt: number }[];
  /** Buildings on this island before and after, measured by the map itself. */
  builtBefore: number;
  builtAfter: number;
  doneBefore: number;
  doneAfter: number;
  lessons: number;
  streakDays: number;
  /** Catalogue entries this lesson named, already resolved. Missing ids are omitted. */
  unlocked: readonly { readonly id: string; readonly zh: string; readonly tagline: string }[];
  /** The shared learner teach-back prompt, supplied by the screen host. */
  recap?: ReactNode;
  /** All cards due on the learner's next calendar day. */
  tomorrowDueCount?: number;
  /** The consented reminder prompt, supplied by the screen host. */
  reviewReminder?: ReactNode;
  nextLesson: PathLesson | null;
  nextUnit: PathUnit | null;
  onNext: (() => void) | null;
  onMap: () => void;
  onStartUnit: (() => void) | null;
}) {
  const soonest = dropped.reduce(
    (best, entry) => (best === null || entry.dueAt < best ? entry.dueAt : best),
    null as number | null,
  );
  const grew = whatGrew(builtBefore, builtAfter, lessons > 0 && doneAfter >= lessons);
  const finished = lessons > 0 && doneAfter >= lessons;
  const canShowProgress = lessons > 0;
  const reduceMotion = prefersReducedMotion();
  const [shownDone, setShownDone] = useState(reduceMotion ? doneAfter : doneBefore);

  useEffect(() => {
    if (!canShowProgress || reduceMotion || shownDone === doneAfter) return;
    const frame = window.requestAnimationFrame(() => setShownDone(doneAfter));
    return () => window.cancelAnimationFrame(frame);
  }, [canShowProgress, doneAfter, reduceMotion, shownDone]);

  // One sound, not three. This screen can be simultaneously "cards dropped",
  // "the island grew" and "the course is done", and playing all three turns a
  // reward into a slot machine. The loudest true thing wins, which also means
  // the rarest cue is only ever heard when the rarest thing happened.
  useEffect(() => {
    if (finished) playSound("reward.course");
    else if (builtAfter > builtBefore) playSound("reward.built");
    else if (dropped.length > 0) playSound("reward.card");
    // Deliberately mount-only: this screen exists to announce one event, and a
    // re-render is not a second event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settle">
      <p className="settle__eyebrow">{courseTitle}</p>
      <h1 className="settle__title">{lessonTitle}</h1>
      <p className="settle__done">读完了。</p>

      {canShowProgress ? (
        <GameProgress
          className="settle__progress"
          label="课程进度"
          value={shownDone}
          max={lessons}
          tone={finished ? "success" : "accent"}
          valueLabel={`${shownDone} / ${lessons} 关`}
        />
      ) : null}

      <ol className="settle__gains">
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

      {tomorrowDueCount > 0 ? (
        <p className="settle__tomorrow">
          明天有 <b>{tomorrowDueCount}</b> 张复习卡到期。
        </p>
      ) : null}

      {reviewReminder}

      {grew ? <p className="settle__world">{grew}</p> : null}

      {unlocked.length > 0 ? (
        <section className="settle__unlocks">
          <h2>这一节记下的概念</h2>
          {unlocked.map((entry) => (
            <GamePanel key={entry.id} title={entry.zh}>
              <p className="settle__unlock-tagline">{entry.tagline}</p>
            </GamePanel>
          ))}
        </section>
      ) : null}

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

      {recap ? <section className="settle__recap">{recap}</section> : null}

      {onNext && nextLesson && nextUnit ? (
        <section className="settle__next">
          <h2>下一关</h2>
          <NodeCard
            open
            embedded
            lesson={nextLesson}
            unit={nextUnit}
            onStart={onNext}
            onStartUnit={onStartUnit ?? onNext}
          />
        </section>
      ) : null}

      <div className="settle__actions">
        <GameButton variant={onNext ? "ghost" : "primary"} onClick={onMap}>
          回关卡地图
        </GameButton>
      </div>
    </div>
  );
}
