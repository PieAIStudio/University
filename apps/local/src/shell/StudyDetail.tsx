import { useEffect, useState } from "react";
import { GamePanel } from "@pieai/swimmer-ui-kit";

import { readJson } from "@pieai/university-ui/api/client.js";
import { isCurrentLessonCompleted } from "@pieai/university-ui/view/lesson-view.js";
import type {
  CourseView,
  LearningFocus,
  LessonRef,
  StudySummary,
  StudyView,
} from "@pieai/university-ui/view/lesson-view.js";
import { CourseSection } from "./CourseSection.js";
import { LayerCoverage } from "./LayerCoverage.js";

export function StudyEvidenceStatus({
  snapshotCount,
  readyUaAnalysisCount,
}: {
  readonly snapshotCount: number;
  readonly readyUaAnalysisCount: number;
}) {
  /*
    Two numbers and a footnote, which is what this always was.

    It used to be three boxes in a row, the third of them holding no number and
    twice as wide as the others, because a policy sentence had been given the
    shape of a metric. The boundary it draws is real and worth keeping — this
    project is strict that a project map is evidence a course cites, never a
    course — but a rule about what these numbers mean belongs under them, not
    beside them as a third one.

    "READY" also came out of the label. It is the analysis status this counter
    filters on, so it explains why the number is what it is — to whoever wrote
    the counter. To a reader it is a word from inside the machine.
  */
  return (
    <section className="study-evidence-status" aria-label="课程使用的项目资料">
      <div className="study-evidence-status__metrics">
        <div className="study-evidence-status__metric">
          <strong>{snapshotCount}</strong>
          <span>个源码版本</span>
        </div>
        <div className="study-evidence-status__metric">
          <strong>{readyUaAnalysisCount}</strong>
          <span>份项目分析</span>
        </div>
      </div>
      <p className="study-evidence-status__boundary">
        这些资料只说明课程引用了哪些源码，不代表课程学习进度。
      </p>
    </section>
  );
}

interface AirlockView {
  readonly airlock: boolean;
  readonly verdict?: string;
  readonly problems?: readonly string[];
  readonly promotedCommit?: string;
  readonly upstream?: { readonly headCommit: string; readonly commitsAhead: number | null } | null;
  readonly course?: { readonly matchesAirlock: boolean | null } | null;
}

/**
 * The three clocks, for a study that is being taught out of an airlock.
 *
 * Being behind is the normal, correct state — the campus teaches the last
 * commit that was promoted, not whatever is in the editor right now — so this
 * reads as a fact rather than a warning. What does deserve attention is a seal
 * that no longer matches its checkout, and that is the only thing coloured as a
 * problem.
 */
export function AirlockClocks({ studyId }: { readonly studyId: string }) {
  const [view, setView] = useState<AirlockView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await readJson<AirlockView>(await fetch(`/api/studies/${studyId}/airlock`));
        if (!cancelled) setView(body);
      } catch {
        if (!cancelled) setView({ airlock: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  if (!view?.airlock) return null;
  const ahead = view.upstream?.commitsAhead ?? null;
  return (
    <section className="airlock-clocks">
      <p className="eyebrow">教材版本</p>
      <dl>
        <div>
          <dt>课程使用版本</dt>
          <dd>
            <code>{view.promotedCommit?.slice(0, 8)}</code>
          </dd>
        </div>
        <div>
          <dt>项目最新版本</dt>
          <dd>
            <code>{view.upstream?.headCommit.slice(0, 8) ?? "读不到"}</code>
          </dd>
        </div>
        <div>
          <dt>相差</dt>
          <dd>{ahead === null ? "算不出（上游历史被改写过）" : `${ahead} 个提交`}</dd>
        </div>
        <div>
          <dt>课程快照</dt>
          <dd>{view.course?.matchesAirlock === false ? "资料版本较旧" : "与课程资料一致"}</dd>
        </div>
      </dl>
      {view.verdict === "blocked" ? (
        <ul className="airlock-clocks__problems">
          {(view.problems ?? []).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : (
        <p className="airlock-clocks__note">
          落后是正常的：这里教的永远是上一次提升的那个提交，不是你编辑器里那份。
        </p>
      )}
    </section>
  );
}

export function StudyAnalysisPanel({
  studyId,
  summary,
}: {
  readonly studyId: string;
  readonly summary: StudySummary | null;
}) {
  return (
    <details className="study-analysis-panel">
      <summary className="study-analysis-panel__summary">
        <span className="study-analysis-panel__summary-copy">
          <span className="eyebrow">项目分析</span>
          <strong>课程引用了项目的哪些文件？</strong>
          <span>
            这里的数字只统计课程引用过的源码，不是“你学了多少”。点开后可以按分层查看，逐层打开文件名。
          </span>
        </span>
        <span className="study-analysis-panel__summary-action">打开分析</span>
      </summary>
      <div className="study-analysis-panel__body">
        {summary ? (
          <StudyEvidenceStatus
            snapshotCount={summary.snapshotCount}
            readyUaAnalysisCount={summary.readyUaAnalysisCount}
          />
        ) : null}
        <AirlockClocks studyId={studyId} />
        <LayerCoverage studyId={studyId} />
      </div>
    </details>
  );
}

/**
 * The pinned route first, then everything else.
 *
 * A study that publishes 31 courses in one flat run gives a reader no way to
 * tell the nine they chose to walk from the twenty-two they have not decided
 * about — and the choice already exists: `focus.courseIds` is a route the
 * learner set with `university focus`, and the front page already calls it
 * 主攻路线 9 门. The study page was the one place that threw it away.
 *
 * Route order is the focus's own order, not the manifest's, because the whole
 * point of pinning a run is that it has an order. Anything the focus does not
 * name keeps the study's order behind it.
 *
 * Returns `null` when there is nothing to split on — no focus, a focus
 * belonging to another study, or one where the split would leave a side
 * empty — and the caller falls back to the flat list. A grouping that puts
 * everything in one group is a heading pretending to be information.
 */
export function splitByFocus(
  courses: readonly CourseView[],
  focus: LearningFocus | null,
  studyId: string,
): { readonly route: readonly CourseView[]; readonly rest: readonly CourseView[] } | null {
  if (!focus || focus.studyId !== studyId) return null;
  const byId = new Map(courses.map((course) => [course.id, course]));
  const route = focus.courseIds.flatMap((id) => {
    const course = byId.get(id);
    return course ? [course] : [];
  });
  const pinned = new Set(route.map((course) => course.id));
  const rest = courses.filter((course) => !pinned.has(course.id));
  if (route.length === 0 || rest.length === 0) return null;
  return { route, rest };
}

export function StudyDetail({
  view,
  summary: _summary,
  focus = null,
  onOpenLesson,
  showCourseEntry = true,
}: {
  readonly view: StudyView;
  /** Null only while the shelf is still loading; the study reads fine without it. */
  readonly summary: StudySummary | null;
  /** The learner's pinned run, from `/api/bootstrap`; null when none is set. */
  readonly focus?: LearningFocus | null;
  readonly onOpenLesson: (locator: LessonRef) => void;
  /**
   * False on the world landing: the rail (and the island you pick) own the
   * one next step. Thirty-one identical 「开始第 1 节」 buttons were the
   * other thirty answers to a question that already had one.
   */
  readonly showCourseEntry?: boolean;
}) {
  /*
    Above this many courses, no course unrolls itself. The number is not a
    threshold on aesthetics — it is where one open course stops being a sample
    of the shelf and starts being a wall in front of it. Six blocks plus one
    unrolled list still fits inside a couple of screens; thirty-one does not.
  */
  const seedOpen = view.courses.length <= 6;
  /*
    Whether any course has been started, which decides whether the first one
    opens itself. Computed here rather than inside a course because no course
    can see its siblings, and "open me only if nobody else is underway" is a
    statement about the shelf.
  */
  const anyCourseInProgress = view.courses.some((course) => {
    const lessons = course.units.flatMap((unit) => unit.lessons);
    const done = lessons.filter((lesson) =>
      isCurrentLessonCompleted(lesson.progress, lesson.contentRevision),
    ).length;
    return done > 0 && done < lessons.length;
  });
  const grouped = splitByFocus(view.courses, focus, view.study.id);
  const renderCourse = (course: CourseView, index: number) => (
    <CourseSection
      key={course.id}
      studyId={view.study.id}
      course={course}
      onOpenLesson={onOpenLesson}
      openWhenNothingInProgress={index === 0 && !anyCourseInProgress}
      seedOpen={seedOpen}
      showEntry={showCourseEntry}
    />
  );
  return (
    <section className="study-detail">
      <header className="study-detail__header">
        <div>
          <p className="eyebrow">项目 · {view.study.id}</p>
          <h2>{view.study.title}</h2>
          <p>{view.study.description}</p>
        </div>
      </header>
      {view.courses.length === 0 ? null : grouped ? (
        <>
          <p className="course-group__eyebrow">主攻路线 · {grouped.route.length} 门</p>
          {grouped.route.map(renderCourse)}
          {/*
            Closed. Pinning a run is a decision to walk these nine and leave the
            other twenty-two for later; unrolling them anyway under the route
            would put 6,000 pixels of "later" between the reader and the bottom
            of the page. The count is on the summary, so nothing is hidden —
            it is filed.
          */}
          <details className="course-group">
            <summary>
              <span>其他课程 · {grouped.rest.length} 门</span>
            </summary>
            {grouped.rest.map((course) => renderCourse(course, -1))}
          </details>
        </>
      ) : (
        view.courses.map(renderCourse)
      )}
      {view.courses.length > 0 ? null : (
        <GamePanel className="formal-course-empty" tone="strong">
          <h2>正式课程尚未发布</h2>
          <p>源码、UA 地图与课堂笔记可以先存在，但它们不会冒充经过编排的正式课程。</p>
        </GamePanel>
      )}
    </section>
  );
}
