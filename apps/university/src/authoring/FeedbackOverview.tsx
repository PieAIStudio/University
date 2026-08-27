import { useEffect, useState } from "react";
import {
  lessonRefKey,
  type FeedbackAnswerAggregate,
  type FeedbackRecord,
  type FeedbackReviewSource,
  type LessonRef,
} from "@pieai/university-core";
import type { CourseView, StudyView } from "@pieai/university-ui/view/lesson-view.js";

import feedbackOverviewStyles from "./feedback-overview.css?inline";

export interface FeedbackAnswerStats {
  readonly exerciseCount: number;
  readonly firstAttemptCount: number;
  readonly firstPassCount: number;
  readonly firstPassRate: number | null;
  readonly totalAttempts: number;
}

export interface FeedbackLessonGroup {
  readonly locator: LessonRef;
  readonly title: string;
  readonly contentRevision: number;
  readonly feedback: readonly FeedbackRecord[];
  readonly answer: FeedbackAnswerStats;
}

export interface FeedbackRevisionGroup {
  readonly contentRevision: number;
  readonly feedbackCount: number;
  readonly answer: FeedbackAnswerStats;
  readonly lessons: readonly FeedbackLessonGroup[];
}

export interface FeedbackCourseGroup {
  readonly courseId: string;
  readonly title: string;
  readonly feedbackCount: number;
  readonly answer: FeedbackAnswerStats;
  readonly revisions: readonly FeedbackRevisionGroup[];
}

export interface FeedbackOverviewModel {
  readonly courses: readonly FeedbackCourseGroup[];
  readonly unlocated: readonly FeedbackRecord[];
}

const EMPTY_ANSWER_STATS: FeedbackAnswerStats = {
  exerciseCount: 0,
  firstAttemptCount: 0,
  firstPassCount: 0,
  firstPassRate: null,
  totalAttempts: 0,
};

export function answerStatsForAggregates(
  aggregates: readonly FeedbackAnswerAggregate[],
): FeedbackAnswerStats {
  const firstAttemptCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.firstAttemptCount,
    0,
  );
  const firstPassCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.firstPassCount,
    0,
  );
  return {
    exerciseCount: aggregates.reduce((total, aggregate) => total + aggregate.exerciseCount, 0),
    firstAttemptCount,
    firstPassCount,
    firstPassRate: firstAttemptCount > 0 ? firstPassCount / firstAttemptCount : null,
    totalAttempts: aggregates.reduce((total, aggregate) => total + aggregate.totalAttempts, 0),
  };
}

function combineAnswerStats(stats: readonly FeedbackAnswerStats[]): FeedbackAnswerStats {
  const combined = stats.reduce<{
    readonly exerciseCount: number;
    readonly firstAttemptCount: number;
    readonly firstPassCount: number;
    readonly totalAttempts: number;
  }>(
    (total, current) => ({
      exerciseCount: total.exerciseCount + current.exerciseCount,
      firstAttemptCount: total.firstAttemptCount + current.firstAttemptCount,
      firstPassCount: total.firstPassCount + current.firstPassCount,
      totalAttempts: total.totalAttempts + current.totalAttempts,
    }),
    { ...EMPTY_ANSWER_STATS },
  );
  return {
    ...combined,
    firstPassRate:
      combined.firstAttemptCount > 0 ? combined.firstPassCount / combined.firstAttemptCount : null,
  };
}

function courseLesson(course: CourseView, locator: LessonRef) {
  return course.units
    .find((unit) => unit.id === locator.unitId)
    ?.lessons.find((lesson) => lesson.id === locator.lessonId);
}

function courseLessonsAtRevision(course: CourseView, studyId: string, contentRevision: number) {
  return course.units.flatMap((unit) =>
    unit.lessons
      .filter((lesson) => lesson.contentRevision === contentRevision)
      .map((lesson) => ({
        locator: {
          studyId,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
        },
      })),
  );
}

function answerStatsForCourseRevision(
  course: CourseView,
  studyId: string,
  contentRevision: number,
  answerByKey: ReadonlyMap<string, FeedbackAnswerAggregate>,
): FeedbackAnswerStats {
  return answerStatsForAggregates(
    courseLessonsAtRevision(course, studyId, contentRevision).flatMap((lesson) => {
      const aggregate = answerByKey.get(`${lessonRefKey(lesson.locator)}\u0000${contentRevision}`);
      return aggregate ? [aggregate] : [];
    }),
  );
}

/** Pure, deterministic grouping: lesson locator first, authored revision second. */
export function buildFeedbackOverview(
  records: readonly FeedbackRecord[],
  answerAggregates: readonly FeedbackAnswerAggregate[],
  studyView: StudyView,
): FeedbackOverviewModel {
  const coursesById = new Map(studyView.courses.map((course) => [course.id, course]));
  const answerByKey = new Map(
    answerAggregates
      .filter((aggregate) => aggregate.locator.studyId === studyView.study.id)
      .map((aggregate) => [
        `${lessonRefKey(aggregate.locator)}\u0000${aggregate.contentRevision}`,
        aggregate,
      ]),
  );
  const unlocated: FeedbackRecord[] = [];
  const byCourse = new Map<string, Map<number, Map<string, FeedbackRecord[]>>>();

  for (const record of records) {
    const locator = record.context.locator;
    const revision = record.context.contentRevision;
    if (!locator || revision === null) {
      unlocated.push(record);
      continue;
    }
    if (locator.studyId !== studyView.study.id) continue;
    const byRevision = byCourse.get(locator.courseId) ?? new Map();
    const byLesson = byRevision.get(revision) ?? new Map();
    const feedback = byLesson.get(locator.lessonId) ?? [];
    feedback.push(record);
    byLesson.set(locator.lessonId, feedback);
    byRevision.set(revision, byLesson);
    byCourse.set(locator.courseId, byRevision);
  }

  const courses = [...byCourse.entries()]
    .sort(([left], [right]) => {
      const leftIndex = studyView.courses.findIndex((course) => course.id === left);
      const rightIndex = studyView.courses.findIndex((course) => course.id === right);
      return (
        (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
      );
    })
    .map(([courseId, byRevision]) => {
      const course = coursesById.get(courseId);
      const revisions = [...byRevision.entries()]
        .sort(([left], [right]) => right - left)
        .map(([contentRevision, byLesson]) => {
          const lessons = [...byLesson.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([lessonId, feedback]) => {
              const locator = feedback[0]!.context.locator!;
              const lesson = course ? courseLesson(course, locator) : undefined;
              const aggregate = answerByKey.get(`${lessonRefKey(locator)}\u0000${contentRevision}`);
              const answer = aggregate ? answerStatsForAggregates([aggregate]) : EMPTY_ANSWER_STATS;
              return {
                locator,
                title: lesson?.title ?? lessonId,
                contentRevision,
                feedback: [...feedback].sort((left, right) =>
                  right.createdAt.localeCompare(left.createdAt),
                ),
                answer,
              } satisfies FeedbackLessonGroup;
            });
          const answer = course
            ? answerStatsForCourseRevision(course, studyView.study.id, contentRevision, answerByKey)
            : EMPTY_ANSWER_STATS;
          return {
            contentRevision,
            feedbackCount: lessons.reduce((total, lesson) => total + lesson.feedback.length, 0),
            answer,
            lessons,
          } satisfies FeedbackRevisionGroup;
        });
      return {
        courseId,
        title: course?.title ?? courseId,
        feedbackCount: revisions.reduce((total, revision) => total + revision.feedbackCount, 0),
        answer: combineAnswerStats(revisions.map((revision) => revision.answer)),
        revisions,
      } satisfies FeedbackCourseGroup;
    });

  return {
    courses,
    unlocated: unlocated.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

function rateLabel(stats: FeedbackAnswerStats, answerAvailable: boolean): string {
  if (!answerAvailable) return "答题汇总还没接好";
  return stats.firstPassRate === null
    ? "暂无答题数据"
    : `${Math.round(stats.firstPassRate * 100)}%`;
}

function answerDetail(stats: FeedbackAnswerStats, answerAvailable: boolean): string {
  if (!answerAvailable) return "答题汇总还没接好，不填数字";
  if (stats.totalAttempts === 0) return "还没有答题记录";
  return `${stats.totalAttempts} 次尝试 · ${stats.firstAttemptCount}/${stats.exerciseCount} 道题有首答记录`;
}

function feedbackMessages(records: readonly FeedbackRecord[]) {
  return (
    <ul className="feedback-overview__messages">
      {records.map((record) => (
        <li key={record.id}>{record.message || "（没写内容）"}</li>
      ))}
    </ul>
  );
}

export function FeedbackOverview({
  source,
  studyView,
}: {
  readonly source: FeedbackReviewSource;
  readonly studyView: StudyView | null;
}) {
  const [state, setState] = useState<
    | { readonly kind: "idle" }
    | { readonly kind: "loading" }
    | {
        readonly kind: "ready";
        readonly model: FeedbackOverviewModel;
        readonly answerAvailable: boolean;
      }
    | { readonly kind: "unavailable" }
  >({ kind: "idle" });

  useEffect(() => {
    if (!studyView) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void Promise.allSettled([
      source.listAll(),
      source.listAnswerAggregates(studyView.study.id),
    ]).then(([feedbackResult, answerResult]) => {
      if (cancelled) return;
      if (feedbackResult.status === "rejected") {
        setState({ kind: "unavailable" });
        return;
      }
      const answerAvailable = answerResult.status === "fulfilled";
      setState({
        kind: "ready",
        model: buildFeedbackOverview(
          feedbackResult.value,
          answerAvailable ? answerResult.value : [],
          studyView,
        ),
        answerAvailable,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [source, studyView]);

  const styles = <style data-feedback-overview-styles>{feedbackOverviewStyles}</style>;

  if (!studyView) {
    return (
      <>
        {styles}
        <section className="feedback-overview" aria-label="意见与答题数据">
          <p className="eyebrow">意见与答题</p>
          <h2>先选择一个项目</h2>
          <p>选中项目后，这里会按课程和内容版本把意见与已有答题数据并排列出来。</p>
        </section>
      </>
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <>
        {styles}
        <section className="feedback-overview" aria-label="意见与答题数据">
          <p className="eyebrow">意见与答题</p>
          <h2>正在读取反馈</h2>
          <p>只读 SwimmerBackend 的反馈数据；还没有读到时不会先填一个数字。</p>
        </section>
      </>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <>
        {styles}
        <section
          className="feedback-overview feedback-overview--unavailable"
          aria-label="意见与答题数据"
        >
          <p className="eyebrow">意见与答题</p>
          <h2>反馈数据还没接好</h2>
          <p>SwimmerBackend 的反馈表或权限还没有就绪。这里不会拿假的意见数填上。</p>
        </section>
      </>
    );
  }

  const { model, answerAvailable } = state;
  if (model.courses.length === 0 && model.unlocated.length === 0) {
    return (
      <>
        {styles}
        <section className="feedback-overview" aria-label="意见与答题数据">
          <p className="eyebrow">意见与答题</p>
          <h2>还没有收到反馈</h2>
          <p>意见会按课程和内容版本确定性分组；有真实记录后，答题数据会在旁边一起出现。</p>
        </section>
      </>
    );
  }

  return (
    <>
      {styles}
      <section className="feedback-overview" aria-label="意见与答题数据">
        <header className="feedback-overview__header">
          <div>
            <p className="eyebrow">意见与答题</p>
            <h2>先看两种信号，再决定改什么</h2>
            <p>
              意见按课程和内容版本分组；答题侧只接受 owner-only
              的聚合接口，不读取学习者原始答案。意见不会单独决定课程变简单。
              {!answerAvailable ? " 答题汇总还没接好，右侧不填数字。" : ""}
            </p>
          </div>
          <div className="feedback-overview__principle">
            <strong>
              {model.courses.reduce((total, course) => total + course.feedbackCount, 0)}
            </strong>
            <span>条已定位意见</span>
          </div>
        </header>

        <div className="feedback-overview__summary" aria-label="按课程汇总">
          {model.courses.map((course) => (
            <article className="feedback-overview__course-card" key={course.courseId}>
              <p className="eyebrow">课程</p>
              <h3>{course.title}</h3>
              <p>
                {course.feedbackCount} 条意见 · {course.revisions.length} 个内容版本
              </p>
              <strong>{rateLabel(course.answer, answerAvailable)}</strong>
              <span>第一次通过率 · {answerDetail(course.answer, answerAvailable)}</span>
            </article>
          ))}
        </div>

        <div className="feedback-overview__details">
          {model.courses.map((course) =>
            course.revisions.map((revision) => (
              <details
                className="feedback-overview__revision"
                key={`${course.courseId}:${revision.contentRevision}`}
                open
              >
                <summary>
                  <span>
                    《{course.title}》· 第 {revision.contentRevision} 版
                  </span>
                  <span>
                    {revision.feedbackCount} 条意见 · 第一次通过率{" "}
                    {rateLabel(revision.answer, answerAvailable)}
                  </span>
                </summary>
                <div className="feedback-overview__revision-body">
                  {revision.lessons.map((lesson) => (
                    <article
                      className="feedback-overview__lesson"
                      key={lessonRefKey(lesson.locator)}
                    >
                      <div className="feedback-overview__opinions">
                        <p className="eyebrow">{lesson.title}</p>
                        <h3>{lesson.feedback.length} 条意见</h3>
                        {feedbackMessages(lesson.feedback)}
                      </div>
                      <div className="feedback-overview__answers">
                        <strong>{rateLabel(lesson.answer, answerAvailable)}</strong>
                        <span>第一次通过率</span>
                        <p>{answerDetail(lesson.answer, answerAvailable)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            )),
          )}
          {model.unlocated.length > 0 ? (
            <details className="feedback-overview__revision" open>
              <summary>
                <span>未定位到具体课程</span>
                <span>{model.unlocated.length} 条意见</span>
              </summary>
              <div className="feedback-overview__revision-body">
                {feedbackMessages(model.unlocated)}
                <p className="feedback-overview__unlocated-note">
                  这组没有课程版本，所以不虚构答题对照。
                </p>
              </div>
            </details>
          ) : null}
        </div>
      </section>
    </>
  );
}
