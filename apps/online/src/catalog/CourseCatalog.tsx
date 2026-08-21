/**
 * The 2D course directory.
 *
 * Responsible: one honest list of every study, course, unit and lesson this
 * product sells, keyboard-complete, matching the world map's tree and gates.
 *
 * Not responsible: searching (the library already does that), animating, or
 * drawing islands. Entering a lesson from here skips the 3D course map on
 * purpose — this page exists so a learner who cannot use the canvas still
 * reaches every lesson.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { library, loadCourse, type Course } from "../content/library";
import { progressSource } from "../progress/source";
import { subscribe, snapshot } from "../progress/store";
import { toHash, WORLD, type View } from "../url-state";
import {
  assembleCatalogListing,
  type CatalogCourse,
  type CatalogLesson,
  type CatalogStudy,
  type CatalogUnit,
} from "./listing";

export function CourseCatalog({ onOpen }: { onOpen: (view: View) => void }) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const [packaged, setPackaged] = useState<ReadonlyMap<string, Course> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = new Map<string, Course>();
        await Promise.all(
          library.studies.flatMap((study) =>
            study.courses.map(async (summary) => {
              const course = await loadCourse(study.studyId, summary.courseId);
              next.set(`${study.studyId}/${summary.courseId}`, course);
            }),
          ),
        );
        if (alive) setPackaged(next);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const listing = useMemo(
    () => (packaged ? assembleCatalogListing(packaged, progressSource()) : null),
    [packaged, progress],
  );

  if (failed) {
    return (
      <main className="catalog">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>课程目录读不出来。刷新这一页再试。</p>
          <button type="button" className="linkish" onClick={() => onOpen(WORLD)}>
            在地图上看
          </button>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="catalog" aria-busy="true">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>正在读入课程目录。</p>
        </div>
      </main>
    );
  }

  const here = listing.nextLesson;

  return (
    <main className="catalog" aria-label="课程目录">
      <div className="catalog__inner">
        <button type="button" className="linkish" onClick={() => onOpen(WORLD)}>
          在地图上看
        </button>
        <h1>目录</h1>
        <p className="catalog__lede">
          {listing.totals.studies} 个世界里的课，按先修关系排。没有先后的就平铺。
        </p>
        <p className="catalog__totals">
          {listing.totals.studies} 个世界 · {listing.totals.courses} 门课 · {listing.totals.units}{" "}
          单元 · {listing.totals.lessons} 节
        </p>
        {listing.studies.map((study) => (
          <StudyBlock
            key={study.id}
            study={study}
            defaultOpen={here?.studyId === study.id}
            currentCourseId={here?.studyId === study.id ? here.courseId : null}
            currentUnitId={here?.studyId === study.id ? here.unitId : null}
            currentLessonId={here?.studyId === study.id ? here.lessonId : null}
            onOpen={onOpen}
          />
        ))}
      </div>
    </main>
  );
}

function StudyBlock({
  study,
  defaultOpen,
  currentCourseId,
  currentUnitId,
  currentLessonId,
  onOpen,
}: {
  study: CatalogStudy;
  defaultOpen: boolean;
  currentCourseId: string | null;
  currentUnitId: string | null;
  currentLessonId: string | null;
  onOpen: (view: View) => void;
}) {
  return (
    <CatalogDetails className="catalog__study" startOpen={defaultOpen}>
      <summary>
        <h2>
          {study.title} <span className="catalog__count">{study.courses.length} 门课</span>
        </h2>
      </summary>
      {study.flat ? <p className="catalog__flat">这几门课没有先后，所以平铺列出。</p> : null}
      {study.courses.map((course) => (
        <CourseBlock
          key={course.id}
          studyId={study.id}
          course={course}
          defaultOpen={course.id === currentCourseId}
          currentUnitId={course.id === currentCourseId ? currentUnitId : null}
          currentLessonId={course.id === currentCourseId ? currentLessonId : null}
          onOpen={onOpen}
        />
      ))}
    </CatalogDetails>
  );
}

function CourseBlock({
  studyId,
  course,
  defaultOpen,
  currentUnitId,
  currentLessonId,
  onOpen,
}: {
  studyId: string;
  course: CatalogCourse;
  defaultOpen: boolean;
  currentUnitId: string | null;
  currentLessonId: string | null;
  onOpen: (view: View) => void;
}) {
  return (
    <CatalogDetails className="catalog__course" startOpen={defaultOpen}>
      <summary>
        <span className="catalog__course-head">
          <span className="catalog__title-row">
            <span className="catalog__depth" aria-label={`第 ${course.depth + 1} 层`}>
              L{course.depth + 1}
            </span>
            <h3>{course.title}</h3>
            <span className={`catalog__gate catalog__gate--${course.state}`}>
              {gateLabel(course.state)}
            </span>
          </span>
          <span className="catalog__progress">
            {course.done}/{course.total} 节
          </span>
          {course.prerequisiteTitles.length > 0 ? (
            <span className="catalog__prereq">先修：{course.prerequisiteTitles.join("、")}</span>
          ) : null}
        </span>
      </summary>
      {course.units.map((unit) => (
        <UnitBlock
          key={unit.id}
          studyId={studyId}
          courseId={course.id}
          unit={unit}
          defaultOpen={unit.id === currentUnitId}
          currentLessonId={unit.id === currentUnitId ? currentLessonId : null}
          onOpen={onOpen}
        />
      ))}
    </CatalogDetails>
  );
}

function UnitBlock({
  studyId,
  courseId,
  unit,
  defaultOpen,
  currentLessonId,
  onOpen,
}: {
  studyId: string;
  courseId: string;
  unit: CatalogUnit;
  defaultOpen: boolean;
  currentLessonId: string | null;
  onOpen: (view: View) => void;
}) {
  return (
    <CatalogDetails className="catalog__unit" startOpen={defaultOpen}>
      <summary>
        <h4>
          {unit.title} <span className="catalog__count">{unit.lessons.length} 节</span>
        </h4>
      </summary>
      <ul className="catalog__lessons">
        {unit.lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonLink
              studyId={studyId}
              courseId={courseId}
              unitId={unit.id}
              lesson={lesson}
              current={lesson.id === currentLessonId}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </CatalogDetails>
  );
}

function CatalogDetails({
  className,
  startOpen,
  children,
}: {
  className: string;
  startOpen: boolean;
  children: ReactNode;
}) {
  const primed = useRef(false);
  return (
    <details
      className={className}
      ref={(element) => {
        // React's types omit defaultOpen on <details>. Set the native flag
        // once per mount so the current path starts open and the learner can
        // still fold it; a controlled `open` prop fights the browser toggle.
        if (!element) {
          primed.current = false;
          return;
        }
        if (primed.current) return;
        element.open = startOpen;
        primed.current = true;
      }}
    >
      {children}
    </details>
  );
}

function LessonLink({
  studyId,
  courseId,
  unitId,
  lesson,
  current,
  onOpen,
}: {
  studyId: string;
  courseId: string;
  unitId: string;
  lesson: CatalogLesson;
  current: boolean;
  onOpen: (view: View) => void;
}) {
  const view: View = { kind: "lesson", studyId, courseId, unitId, lessonId: lesson.id };
  return (
    <a
      className="catalog__lesson"
      href={toHash(view)}
      aria-current={current ? "location" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onOpen(view);
      }}
    >
      <span className="catalog__lesson-title">{lesson.title}</span>
      {lesson.variant ? <span className="catalog__variant">{lesson.variant}</span> : null}
      {lesson.state === "done" ? (
        <span className="catalog__gate catalog__gate--done">已完成</span>
      ) : null}
      {lesson.state === "live" ? (
        <span className="catalog__gate catalog__gate--live">正在学</span>
      ) : null}
    </a>
  );
}

function gateLabel(state: CatalogCourse["state"]): string {
  switch (state) {
    case "done":
      return "已完成";
    case "live":
      return "正在学";
    case "open":
      return "可以学";
    case "idle":
      return "未解锁";
  }
}
