import { useEffect, useState } from "react";
import {
  lessonRefKey,
  type FeedbackRecord,
  type FeedbackReviewSource,
  type LessonRef,
} from "@pieai/university-core";
import type { CourseView, StudyView } from "@pieai/university-ui/view/lesson-view.js";

import feedbackOverviewStyles from "./feedback-overview.css?inline";

export interface FeedbackLessonGroup {
  readonly locator: LessonRef;
  readonly title: string;
  readonly contentRevision: number;
  readonly feedback: readonly FeedbackRecord[];
}

export interface FeedbackRevisionGroup {
  readonly contentRevision: number;
  readonly feedbackCount: number;
  readonly lessons: readonly FeedbackLessonGroup[];
}

export interface FeedbackCourseGroup {
  readonly courseId: string;
  readonly title: string;
  readonly feedbackCount: number;
  readonly revisions: readonly FeedbackRevisionGroup[];
}

export interface FeedbackOverviewModel {
  readonly courses: readonly FeedbackCourseGroup[];
  readonly unlocated: readonly FeedbackRecord[];
}

function courseLesson(course: CourseView, locator: LessonRef) {
  return course.units
    .find((unit) => unit.id === locator.unitId)
    ?.lessons.find((lesson) => lesson.id === locator.lessonId);
}

/** Pure, deterministic grouping: lesson locator first, authored revision second. */
export function buildFeedbackOverview(
  records: readonly FeedbackRecord[],
  studyView: StudyView,
): FeedbackOverviewModel {
  const coursesById = new Map(studyView.courses.map((course) => [course.id, course]));
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
              return {
                locator,
                title: lesson?.title ?? lessonId,
                contentRevision,
                feedback: [...feedback].sort((left, right) =>
                  right.createdAt.localeCompare(left.createdAt),
                ),
              } satisfies FeedbackLessonGroup;
            });
          return {
            contentRevision,
            feedbackCount: lessons.reduce((total, lesson) => total + lesson.feedback.length, 0),
            lessons,
          } satisfies FeedbackRevisionGroup;
        });
      return {
        courseId,
        title: course?.title ?? courseId,
        feedbackCount: revisions.reduce((total, revision) => total + revision.feedbackCount, 0),
        revisions,
      } satisfies FeedbackCourseGroup;
    });

  return {
    courses,
    unlocated: unlocated.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
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
    | { readonly kind: "ready"; readonly model: FeedbackOverviewModel }
    | { readonly kind: "unavailable" }
  >({ kind: "idle" });

  useEffect(() => {
    if (!studyView) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void source
      .listAll()
      .then((records) => {
        if (!cancelled)
          setState({ kind: "ready", model: buildFeedbackOverview(records, studyView) });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "unavailable" });
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
        <section className="feedback-overview" aria-label="学习者意见">
          <p className="eyebrow">学习者意见</p>
          <h2>先选择一个项目</h2>
          <p>选中项目后，这里会按课程和内容版本把意见排出来。</p>
        </section>
      </>
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <>
        {styles}
        <section className="feedback-overview" aria-label="学习者意见">
          <p className="eyebrow">学习者意见</p>
          <h2>正在读取意见</h2>
          <p>只读 SwimmerBackend 的意见；还没有读到时不会先填一个数字。</p>
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
          aria-label="学习者意见"
        >
          <p className="eyebrow">学习者意见</p>
          <h2>反馈数据还没接好</h2>
          <p>SwimmerBackend 的反馈表或权限还没有就绪。这里不会拿假的意见数填上。</p>
        </section>
      </>
    );
  }

  const { model } = state;
  if (model.courses.length === 0 && model.unlocated.length === 0) {
    return (
      <>
        {styles}
        <section className="feedback-overview" aria-label="学习者意见">
          <p className="eyebrow">学习者意见</p>
          <h2>还没有收到反馈</h2>
          <p>意见会按课程和内容版本确定性分组；有真实记录后，原话会出现在这里。</p>
        </section>
      </>
    );
  }

  return (
    <>
      {styles}
      <section className="feedback-overview" aria-label="学习者意见">
        <header className="feedback-overview__header">
          <div>
            <p className="eyebrow">学习者意见</p>
            <h2>先看大家写下了什么</h2>
            <p>意见按课程和内容版本分组。它是线索，不是自动改课的指令。</p>
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
                  <span>{revision.feedbackCount} 条意见</span>
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
                  这组没有课程版本，所以不虚构课程对照。
                </p>
              </div>
            </details>
          ) : null}
        </div>
      </section>
    </>
  );
}
