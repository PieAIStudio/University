import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameProgress } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonRef, LessonSectionView } from "../view/lesson-view.js";

export interface LessonNeighbour extends LessonRef {
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
  locator: LessonRef,
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

/**
 * How far down a scrollable page a position is, as 0–1.
 *
 * Fallback for a lesson that has no `##` sections to count. Measured against
 * the scrolling box the toolbar lives in — on the delivery shell that is
 * `.reader`, not `window`.
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

export interface HeadingBox {
  readonly top: number;
  readonly height: number;
}

/**
 * 1-based index of the section the reader is in.
 *
 * A heading whose top is at or above `readLine` has been entered. Until the
 * first heading crosses, the reader is in section 1 — the opening of the
 * lesson is the first section, not a prologue with no number.
 *
 * Headings that have not been laid out yet (height 0) are ignored, so a jsdom
 * mount with empty rects stays on 1 rather than jumping to the last section.
 */
export function currentSectionNumber(headings: readonly HeadingBox[], readLine: number): number {
  if (headings.length === 0) return 0;
  let current = 1;
  let sawLaidOut = false;
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    if (!(heading.height > 0)) continue;
    sawLaidOut = true;
    if (heading.top <= readLine) current = index + 1;
  }
  return sawLaidOut ? current : 1;
}

export function sectionProgressRatio(current: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, current / total));
}

function boxOf(node: HTMLElement): HeadingBox {
  const rect = node.getBoundingClientRect();
  return { top: rect.top, height: rect.height };
}

function headingBoxesFor(sections: readonly LessonSectionView[]): HeadingBox[] {
  if (sections.length === 0) return [];
  const nodes = document.querySelectorAll<HTMLElement>("[data-section-id]");
  const byId = new Map<string, HTMLElement>();
  for (const node of nodes) {
    const id = node.dataset.sectionId;
    if (id && !byId.has(id)) byId.set(id, node);
  }
  const matched = sections.map((section) => byId.get(section.id));
  if (matched.every((node) => node)) {
    return matched.map((node) => boxOf(node!));
  }
  // Title matching can miss (smart quotes, trimmed markdown). The prose
  // headings are still the sections; count them in document order.
  const prose = document.querySelector(".lesson-prose, .lesson__body, .markdown-body");
  const headings = [...(prose?.querySelectorAll<HTMLElement>("h2") ?? [])];
  return sections.map((_, index) => {
    const node = headings[index];
    return node ? boxOf(node) : { top: Number.POSITIVE_INFINITY, height: 0 };
  });
}

function nearestScroller(node: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

function scrollMetrics(from: HTMLElement | null): {
  readonly scrollY: number;
  readonly scrollHeight: number;
  readonly viewportHeight: number;
} {
  const scroller = from ? nearestScroller(from) : null;
  if (scroller) {
    return {
      scrollY: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
    };
  }
  return {
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  };
}

/**
 * Section progress into state, coalesced to one layout read per frame.
 *
 * The listener goes on the element that actually scrolls, found by walking up
 * for an `overflow-y` of `auto` or `scroll`. The delivery shell scrolls
 * `main.reader`; the authoring shell scrolls the window.
 *
 * A capture-phase listener on `window` was tried first, on the reasoning that
 * capture reaches a non-bubbling event's target anyway. Measured in a browser,
 * it receives nothing from an element scroll — the bar sat at 1/8 from the top
 * of the lesson to the bottom of it. jsdom has no layout and no scrolling, so
 * every unit test agreed with the comment rather than with the browser.
 */
function useLessonProgress(sections: readonly LessonSectionView[]) {
  const ref = useRef<HTMLDivElement>(null);
  const total = sections.length;
  const [current, setCurrent] = useState(total > 0 ? 1 : 0);
  const [ratio, setRatio] = useState(total > 0 ? sectionProgressRatio(1, total) : 0);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const node = ref.current;
      if (sections.length > 0) {
        const readLine = node?.getBoundingClientRect().bottom ?? 0;
        const now = currentSectionNumber(headingBoxesFor(sections), readLine);
        setCurrent(now);
        setRatio(sectionProgressRatio(now, sections.length));
        return;
      }
      const metrics = scrollMetrics(node);
      const read = readProgress(metrics.scrollY, metrics.scrollHeight, metrics.viewportHeight);
      setCurrent(0);
      setRatio(read);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };
    paint();
    const scroller = ref.current ? nearestScroller(ref.current) : null;
    const scrollTarget: EventTarget = scroller ?? window;
    scrollTarget.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scrollTarget.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sections]);

  return { ref, current, total, ratio };
}

/**
 * Entering a lesson leaves one way out and how far you are. The right-hand
 * slot is for in-lesson tools (language, reading mode), not destinations.
 */
export function LessonToolbar({
  onClose,
  sections,
  children,
}: {
  readonly onClose: () => void;
  readonly sections: readonly LessonSectionView[];
  readonly children?: ReactNode;
}) {
  const { ref, current, total, ratio } = useLessonProgress(sections);
  const valued = total > 0;
  const valueNow = valued ? current : Math.round(ratio * 100);
  const valueMax = valued ? total : 100;

  return (
    <div className="lesson-toolbar" ref={ref}>
      <button
        type="button"
        className="lesson-toolbar__close"
        aria-label="离开课文"
        onClick={onClose}
      >
        ✕
      </button>
      <GameProgress
        className="lesson-toolbar__progress"
        label="课文进度"
        value={valueNow}
        max={valueMax}
        tone="accent"
        valueLabel={valued ? `${current}/${total}` : undefined}
      />
      {children ? <div className="lesson-toolbar__tools">{children}</div> : null}
    </div>
  );
}
