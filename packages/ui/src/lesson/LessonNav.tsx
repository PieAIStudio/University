import { useEffect, useRef } from "react";
import { GameBadge, GameButton, GameSegmentedControl, GameToggle } from "@pieai/swimmer-ui-kit";

import { Tip } from "../Tip.js";
import type { DetailMode } from "../language/detail-mode.js";
import type { CourseView, LessonLocator } from "../view/lesson-view.js";

export interface LessonNeighbour extends LessonLocator {
  readonly title: string;
}

export interface LessonNeighbours {
  readonly previous: LessonNeighbour | null;
  readonly next: LessonNeighbour | null;
  /** 1-based position within the course, for "第 7 节 / 共 41 节". */
  readonly position: number;
  readonly total: number;
}

/**
 * The lesson before and after this one, within its own course.
 *
 * Flattened across units rather than stopping at unit boundaries, because a
 * unit boundary is an authoring decision the learner never agreed to — running
 * out of "next" three lessons in reads as the course ending.
 *
 * Deliberately does not cross into another course. Courses have their own
 * audiences and prerequisites, so falling out of one into whichever happens to
 * sort next would be a worse surprise than stopping.
 */
export function lessonNeighbours(
  courses: readonly CourseView[],
  locator: LessonLocator,
): LessonNeighbours | null {
  const course = courses.find((item) => item.id === locator.courseId);
  if (!course) return null;
  const flat = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({
      studyId: locator.studyId,
      courseId: course.id,
      unitId: unit.id,
      lessonId: lesson.id,
      title: lesson.title,
    })),
  );
  const index = flat.findIndex((item) => item.lessonId === locator.lessonId);
  if (index === -1) return null;
  return {
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
    position: index + 1,
    total: flat.length,
  };
}

const DETAIL_OPTIONS = [
  { id: "standard", label: "标准讲解" },
  { id: "all", label: "详细讲解" },
] as const;

/**
 * How far down a scrollable page a position is, as 0–1.
 *
 * Measured against the whole document rather than the lesson body: the page
 * continues past the prose into the exercise and the next-lesson block, and a
 * bar that filled before the page ended would answer a question nobody asked
 * with a number that looks wrong.
 *
 * A page that does not scroll reads 0, not 1. There is nothing left to read,
 * but a full bar on arrival says "finished" to someone who has not started.
 */
export function readProgress(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const scrollable = scrollHeight - viewportHeight;
  if (!(scrollable > 0)) return 0;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

/**
 * Publishes `readProgress` into `--lesson-read` on the toolbar.
 *
 * Reads and writes are coalesced into one animation frame, so a fast scroll
 * costs one layout read and one style write per painted frame rather than one
 * per scroll event, and the listener is passive so it can never delay a
 * scroll.
 *
 * `animation-timeline: scroll(root)` would do all of this with no listener at
 * all and no main-thread work, and is the better mechanism on paper. It is not
 * used because it could not be confirmed working here: the review browser runs
 * with `visibilityState: "hidden"`, which stops both the compositor and
 * `requestAnimationFrame`, so a scroll timeline and a rAF loop are equally
 * unobservable. That is a limitation of the harness rather than evidence
 * against the CSS, but shipping the mechanism that also carries a unit test is
 * the one that can be shown to be right.
 */
function useReadProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const read = readProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      node.style.setProperty("--lesson-read", read.toFixed(4));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return ref;
}

/**
 * Every lesson control in one sticky band: leave, position, reading prefs,
 * status, and prev/next. Sits under the campus header so the reader never has
 * to scroll back up for navigation or the detail switch.
 */
export function LessonToolbar({
  neighbours,
  onOpenLesson,
  onBackToCourse,
  annotated,
  englishMode,
  onEnglishModeChange,
  detailMode,
  onDetailModeChange,
  completed,
  readConfirmed,
}: {
  readonly neighbours: LessonNeighbours;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onBackToCourse: () => void;
  readonly annotated: boolean;
  readonly englishMode: boolean;
  readonly onEnglishModeChange: (enabled: boolean) => void;
  readonly detailMode: DetailMode;
  readonly onDetailModeChange: (mode: DetailMode) => void;
  readonly completed: boolean;
  readonly readConfirmed: boolean;
}) {
  const { previous, next } = neighbours;
  const detailed = detailMode === "all";
  const barRef = useReadProgress();

  return (
    <div className="lesson-toolbar" ref={barRef}>
      {/*
        Two zones, not three.

        The band used to run 返回/位置 · 外语模式/讲解层级/状态 · 上一节/下一节 —
        three groups with no separation, and the state badge parked between two
        pressable chips, where it read as a third one. Nothing about
        「待确认本次更新」 is pressable; it is the answer to "does this lesson
        count yet", which is the same kind of fact as 「第 2 节 / 共 41 节」.
        So the left side is now everything that describes where you are, and
        the right side is everything you can do.
      */}
      <nav className="lesson-toolbar__nav" aria-label="课程导航">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          ← 返回课程
        </GameButton>
        <span className="lesson-toolbar__position">
          第 {neighbours.position} 节 / 共 {neighbours.total} 节
        </span>
        <GameBadge tone={completed ? "success" : "warning"}>
          {completed ? "已完成" : readConfirmed ? "课文已确认 · 练习待完成" : "待确认本次更新"}
        </GameBadge>
      </nav>

      <div className="lesson-toolbar__controls">
        {annotated ? (
          // Only offered where there is something to offer. A toggle that
          // does nothing on most lessons teaches the learner to ignore it.
          //
          // The kit's, now that it can show its own state. On 1.3.0
          // `.game-ui-toggle-track` had one unconditional rule and no
          // `[aria-checked="true"]` anywhere, so on and off were identical in
          // every theme; 1.3.1 fixes that upstream rather than here.
          <Tip term="english-mode">
            <GameToggle
              checked={englishMode}
              label="外语模式"
              onClick={() => onEnglishModeChange(!englishMode)}
            />
          </Tip>
        ) : null}

        {/*
          The kit's own segmented control, replacing a hand-rolled one whose
          pressed, hover and focus states were maintained here alone, on a
          surface where every other control comes from the kit. A reader learns
          one vocabulary of "this is pressable" per product, and a switch that
          is nearly but not quite the kit's is the expensive kind of nearly.

          `label` reaches the group's `aria-label` and nothing else, so the
          visible one is ours: two bare pills reading 标准讲解 / 详细讲解 do not
          say what they are two settings *of*.
        */}
        <span className="lesson-toolbar__label" id="lesson-detail-label">
          讲解层级
        </span>
        <GameSegmentedControl
          label="讲解层级"
          activeId={detailed ? "all" : "standard"}
          options={DETAIL_OPTIONS}
          onSelect={(id) => onDetailModeChange(id === "all" ? "all" : "standard")}
        />

        <span className="lesson-toolbar__split" aria-hidden="true" />

        {previous ? (
          <GameButton variant="ghost" onClick={() => onOpenLesson(previous)}>
            上一节
          </GameButton>
        ) : null}
        {next ? (
          <GameButton variant="ghost" onClick={() => onOpenLesson(next)}>
            下一节
          </GameButton>
        ) : null}
      </div>
    </div>
  );
}
