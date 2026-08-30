import { useCallback, useSyncExternalStore } from "react";
import {
  answerStatsOf,
  lessonRefKey,
  type LessonAnswerStats,
  type LessonRef,
  type ProgressDocument,
  type ProgressPort,
} from "@pieai/university-core";
import type { StudyView } from "@pieai/university-ui/view/lesson-view.js";

import answerOverviewStyles from "./answer-overview.css?inline";

export interface AnswerLessonRow {
  readonly locator: LessonRef;
  readonly title: string;
  readonly unitTitle: string;
  readonly contentRevision: number;
  readonly exerciseCount: number;
  readonly stats: LessonAnswerStats;
}

export interface AnswerCourseGroup {
  readonly courseId: string;
  readonly title: string;
  readonly lessonCount: number;
  /** Only the lessons this browser has actually answered, most stuck first. */
  readonly lessons: readonly AnswerLessonRow[];
  /** How many of `lessonCount` have no first answer recorded yet. */
  readonly unansweredCount: number;
}

export interface AnswerOverviewModel {
  readonly courses: readonly AnswerCourseGroup[];
  /** True when nothing in this study has been answered in this browser yet. */
  readonly empty: boolean;
}

/**
 * How badly a lesson is stuck, lowest first.
 *
 * A lesson nobody answered is not a lesson that went well, so it is not ranked
 * at all — it is counted and named, and never given a number it did not earn.
 * Among answered lessons the first-pass rate leads and the attempt count breaks
 * ties, because two lessons can both sit at zero and the one that was tried six
 * times is the one costing the learner more.
 */
function stuckOrder(a: AnswerLessonRow, b: AnswerLessonRow): number {
  const rateOf = (row: AnswerLessonRow) =>
    row.stats.pendingFirstAttemptCount > 0 ? 2 : (row.stats.firstPassRate ?? 1);
  const byRate = rateOf(a) - rateOf(b);
  if (byRate !== 0) return byRate;
  return b.stats.totalAttempts - a.stats.totalAttempts;
}

/**
 * Build the author-only read model.
 *
 * The heading asks which lesson is stuck, so the answer has to be at the top of
 * the list rather than somewhere inside it. Listing every lesson in course order
 * put 362 identical "暂无答题数据" rows across a 45,000px page on a real study,
 * which is a table that asks the reader to do the work the heading promised.
 */
export function buildAnswerOverview(
  studyView: StudyView,
  document: Pick<ProgressDocument, "exerciseAttempts">,
): AnswerOverviewModel {
  const courses = studyView.courses.map((course) => {
    const rows = course.units.flatMap((unit) =>
      unit.lessons.map((lesson) => {
        const locator: LessonRef = {
          studyId: studyView.study.id,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
        };
        return {
          locator,
          title: lesson.title,
          unitTitle: unit.title,
          contentRevision: lesson.contentRevision,
          exerciseCount: lesson.exerciseCount,
          stats: answerStatsOf(document, locator, lesson.contentRevision, lesson.exerciseCount),
        } satisfies AnswerLessonRow;
      }),
    );
    const answered = rows.filter((row) => row.stats.firstAttemptCount > 0).sort(stuckOrder);
    return {
      courseId: course.id,
      title: course.title,
      lessonCount: rows.length,
      lessons: answered,
      unansweredCount: rows.length - answered.length,
    } satisfies AnswerCourseGroup;
  });

  return { courses, empty: courses.every((course) => course.lessons.length === 0) };
}

function rateLabel(stats: LessonAnswerStats): string {
  if (stats.firstAttemptCount === 0) return "暂无答题数据";
  if (stats.pendingFirstAttemptCount > 0) return "首答待判定";
  return `${Math.round((stats.firstPassRate ?? 0) * 100)}%`;
}

function pendingLabel(stats: LessonAnswerStats): string | null {
  return stats.pendingFirstAttemptCount > 0
    ? `${stats.pendingFirstAttemptCount} 道题的首答还在等待宿主判定，暂不计算通过率`
    : null;
}

export function AnswerOverview({
  progress,
  studyView,
}: {
  readonly progress: ProgressPort;
  readonly studyView: StudyView | null;
}) {
  const subscribe = useCallback((listener: () => void) => progress.subscribe(listener), [progress]);
  const getSnapshot = useCallback(() => progress.snapshot(), [progress]);
  const document = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const styles = <style data-answer-overview-styles>{answerOverviewStyles}</style>;

  if (!studyView) {
    return (
      <>
        {styles}
        <section className="answer-overview" aria-label="作者自己的答题汇总">
          <p className="eyebrow">作者答题</p>
          <h2>先选择一个项目</h2>
          <p>选中项目后，这里会从本机进度文档逐节列出答题事实。</p>
        </section>
      </>
    );
  }

  const model = buildAnswerOverview(studyView, document);
  if (model.courses.length === 0) {
    return (
      <>
        {styles}
        <section className="answer-overview" aria-label="作者自己的答题汇总">
          <p className="eyebrow">作者答题</p>
          <h2>还没有可统计的课</h2>
          <p>课程结构读到后，答题总览会在这里出现。</p>
        </section>
      </>
    );
  }

  if (model.empty) {
    const lessonTotal = model.courses.reduce((sum, course) => sum + course.lessonCount, 0);
    return (
      <>
        {styles}
        <section className="answer-overview" aria-label="作者自己的答题汇总">
          <p className="eyebrow">作者答题</p>
          <h2>这个项目你还没答过题</h2>
          <p>
            这个浏览器的进度文档里，{lessonTotal} 节课都还没有首答记录。
            自己走一遍课、答几道题之后，卡住的那几节会排在这里最前面。
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      {styles}
      <section className="answer-overview" aria-label="作者自己的答题汇总">
        <header className="answer-overview__header">
          <div>
            <p className="eyebrow">作者答题</p>
            <h2>再看一眼，哪一节卡住了</h2>
            <p>
              只读当前浏览器的
              ProgressDocument。它代表作者本人，不代表其他学习者；全体学习者的答题汇总还没接好，
              所以这里不填全体数字。未来接好 owner-only 聚合接口后再替换这一列。
            </p>
          </div>
          <div className="answer-overview__source" role="group" aria-label="答题数据来源">
            <strong>本机</strong>
            <span>作者自己的进度</span>
          </div>
        </header>

        <div className="answer-overview__courses">
          {model.courses
            .filter((course) => course.lessons.length > 0)
            .map((course) => (
              <section className="answer-overview__course" key={course.courseId}>
                <header className="answer-overview__course-header">
                  <h3>{course.title}</h3>
                  <span>
                    {course.lessons.length}/{course.lessonCount} 节答过
                    {course.unansweredCount > 0 ? ` · 还有 ${course.unansweredCount} 节没答过` : ""}
                  </span>
                </header>
                <div className="answer-overview__rows">
                  {course.lessons.map((lesson) => {
                    const pending = pendingLabel(lesson.stats);
                    return (
                      <article
                        className="answer-overview__lesson"
                        key={lessonRefKey(lesson.locator)}
                      >
                        <div className="answer-overview__identity">
                          <p className="eyebrow">{lesson.unitTitle}</p>
                          <h4>{lesson.title}</h4>
                          <span>第 {lesson.contentRevision} 版</span>
                        </div>
                        <div
                          className="answer-overview__metrics"
                          role="group"
                          aria-label={`${lesson.title}答题指标`}
                        >
                          <div className="answer-overview__metric">
                            <strong>{rateLabel(lesson.stats)}</strong>
                            <span>第一次通过率</span>
                          </div>
                          <div className="answer-overview__metric">
                            <strong>{lesson.stats.totalAttempts}</strong>
                            <span>次尝试</span>
                          </div>
                          <div className="answer-overview__metric">
                            <strong>
                              {lesson.stats.firstAttemptCount}/{lesson.stats.exerciseCount}
                            </strong>
                            <span>道题有首答记录</span>
                          </div>
                        </div>
                        {pending ? <p className="answer-overview__pending">{pending}</p> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      </section>
    </>
  );
}
