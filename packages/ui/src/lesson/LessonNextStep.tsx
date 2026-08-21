import { GameButton } from "@pieai/swimmer-ui-kit";

import type { LessonRef } from "../view/lesson-view.js";
import type { LessonNeighbours } from "./LessonNav.js";

/**
 * The end of a lesson, which until now was the campus footer.
 *
 * A reader who finished the exercise had one way onward: a 6.5rem ghost button
 * called 下一节, four thousand pixels back up in the sticky toolbar, which does
 * not say what it leads to. So the moment a lesson has just earned — the one
 * where someone is most willing to do another — spent itself on scrolling back.
 *
 * The block names the next lesson rather than pointing at it, because "继续"
 * next to a title is a decision the reader can make and "下一节" is one they
 * can only take on faith.
 *
 * It also refuses to shout before it has the right to. This product will not
 * mark a lesson done until the reader confirms the text and passes the
 * exercise, and an eye-catching way out sitting above an unfinished lesson
 * would be arguing with that rule. Unfinished, this is a quiet signpost that
 * says so; finished, it is the primary action on the page. Either way it stays
 * clickable — nobody gets held in a lesson they want to leave.
 */
export function LessonNextStep({
  neighbours,
  completed,
  onOpenLesson,
  onBackToCourse,
}: {
  readonly neighbours: LessonNeighbours;
  readonly completed: boolean;
  readonly onOpenLesson: (locator: LessonRef) => void;
  readonly onBackToCourse: () => void;
}) {
  const { next, position, total } = neighbours;

  if (!next) {
    return (
      <section className="lesson-next" data-state="course-end" aria-label="学到这里">
        <p className="lesson-next__eyebrow">第 {total} 节 · 这门课的最后一节</p>
        <h2 className="lesson-next__title">这门课到这里就走完了。</h2>
        <p className="lesson-next__note">
          回到课程页可以看到这门课覆盖了项目的哪些地方，以及接下来还有哪些课。
        </p>
        <GameButton variant="primary" onClick={onBackToCourse}>
          回到课程
        </GameButton>
      </section>
    );
  }

  return (
    <section
      className="lesson-next"
      data-state={completed ? "ready" : "unfinished"}
      aria-label="下一节"
    >
      <p className="lesson-next__eyebrow">
        下一节 · 第 {position + 1} 节 / 共 {total} 节
      </p>
      <h2 className="lesson-next__title">{next.title}</h2>
      {completed ? null : (
        <p className="lesson-next__note">
          这节还没标为完成。上面确认课文、答完练习之后，这节才会计入进度。
        </p>
      )}
      <GameButton variant={completed ? "primary" : "ghost"} onClick={() => onOpenLesson(next)}>
        {completed ? "继续下一节" : "先去下一节"}
      </GameButton>
    </section>
  );
}
