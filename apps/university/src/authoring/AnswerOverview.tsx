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
  readonly lessons: readonly AnswerLessonRow[];
}

export interface AnswerOverviewModel {
  readonly courses: readonly AnswerCourseGroup[];
}

/** Build the author-only read model in course order, with one row per lesson. */
export function buildAnswerOverview(
  studyView: StudyView,
  document: Pick<ProgressDocument, "exerciseAttempts">,
): AnswerOverviewModel {
  return {
    courses: studyView.courses.map((course) => ({
      courseId: course.id,
      title: course.title,
      lessons: course.units.flatMap((unit) =>
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
      ),
    })),
  };
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
          {model.courses.map((course) => (
            <section className="answer-overview__course" key={course.courseId}>
              <header className="answer-overview__course-header">
                <h3>{course.title}</h3>
                <span>{course.lessons.length} 节课</span>
              </header>
              <div className="answer-overview__rows">
                {course.lessons.map((lesson) => {
                  const pending = pendingLabel(lesson.stats);
                  return (
                    <article className="answer-overview__lesson" key={lessonRefKey(lesson.locator)}>
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
