import { useRef, type ReactNode } from "react";
import type { LessonRef } from "@pieai/university-core";

export interface CatalogLesson {
  readonly id: string;
  readonly title: string;
  readonly variant: string | null;
  readonly state: "done" | "live" | "idle";
}

export interface CatalogUnit {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly CatalogLesson[];
}

export interface CatalogCourse {
  readonly id: string;
  readonly title: string;
  readonly depth: number;
  readonly prerequisiteCourseIds: readonly string[];
  readonly prerequisiteTitles: readonly string[];
  readonly state: "done" | "live" | "open" | "idle";
  readonly done: number;
  readonly total: number;
  readonly units: readonly CatalogUnit[];
}

export interface CatalogStudy {
  readonly id: string;
  readonly title: string;
  readonly flat: boolean;
  readonly courses: readonly CatalogCourse[];
}

export interface CatalogListing {
  readonly studies: readonly CatalogStudy[];
  readonly totals: {
    readonly studies: number;
    readonly courses: number;
    readonly units: number;
    readonly lessons: number;
  };
  readonly nextLesson: LessonRef | null;
}

/** The shared keyboard-complete course directory used by both shells. */
export function CatalogSurface({
  listing,
  onBack,
  onOpenLesson,
  lessonHref,
}: {
  readonly listing: CatalogListing;
  readonly onBack: () => void;
  readonly onOpenLesson: (lesson: LessonRef) => void;
  readonly lessonHref: (lesson: LessonRef) => string;
}) {
  const here = listing.nextLesson;
  return (
    <div className="catalog" aria-label="课程目录">
      <div className="catalog__inner">
        <button type="button" className="linkish" onClick={onBack}>
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
            onOpenLesson={onOpenLesson}
            lessonHref={lessonHref}
          />
        ))}
      </div>
    </div>
  );
}

function StudyBlock({
  study,
  defaultOpen,
  currentCourseId,
  currentUnitId,
  currentLessonId,
  onOpenLesson,
  lessonHref,
}: {
  readonly study: CatalogStudy;
  readonly defaultOpen: boolean;
  readonly currentCourseId: string | null;
  readonly currentUnitId: string | null;
  readonly currentLessonId: string | null;
  readonly onOpenLesson: (lesson: LessonRef) => void;
  readonly lessonHref: (lesson: LessonRef) => string;
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
          onOpenLesson={onOpenLesson}
          lessonHref={lessonHref}
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
  onOpenLesson,
  lessonHref,
}: {
  readonly studyId: string;
  readonly course: CatalogCourse;
  readonly defaultOpen: boolean;
  readonly currentUnitId: string | null;
  readonly currentLessonId: string | null;
  readonly onOpenLesson: (lesson: LessonRef) => void;
  readonly lessonHref: (lesson: LessonRef) => string;
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
          onOpenLesson={onOpenLesson}
          lessonHref={lessonHref}
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
  onOpenLesson,
  lessonHref,
}: {
  readonly studyId: string;
  readonly courseId: string;
  readonly unit: CatalogUnit;
  readonly defaultOpen: boolean;
  readonly currentLessonId: string | null;
  readonly onOpenLesson: (lesson: LessonRef) => void;
  readonly lessonHref: (lesson: LessonRef) => string;
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
              onOpenLesson={onOpenLesson}
              lessonHref={lessonHref}
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
  readonly className: string;
  readonly startOpen: boolean;
  readonly children: ReactNode;
}) {
  const primed = useRef(false);
  return (
    <details
      className={className}
      ref={(element) => {
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
  onOpenLesson,
  lessonHref,
}: {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lesson: CatalogLesson;
  readonly current: boolean;
  readonly onOpenLesson: (lesson: LessonRef) => void;
  readonly lessonHref: (lesson: LessonRef) => string;
}) {
  const ref = { studyId, courseId, unitId, lessonId: lesson.id };
  return (
    <a
      className="catalog__lesson"
      href={lessonHref(ref)}
      aria-current={current ? "location" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onOpenLesson(ref);
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
