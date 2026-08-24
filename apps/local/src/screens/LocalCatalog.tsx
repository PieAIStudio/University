import { useEffect, useMemo, useRef, useState } from "react";
import { lessonKey, type LessonRef } from "@pieai/university-core";
import { CatalogSurface, type CatalogListing } from "@pieai/university-ui";
import type { BootstrapData, StudyView } from "@pieai/university-ui/view/lesson-view.js";

import { readJson } from "@pieai/university-ui/api/client.js";
import { formatAddress } from "../url-state.js";
import { progressPort } from "../progress/store.js";

function completed(
  lesson: StudyView["courses"][number]["units"][number]["lessons"][number],
  state: ReturnType<typeof progressPort.lessonState>,
): boolean {
  return Boolean(
    lesson.progress?.status === "completed" ||
    (state.progress >= 1 && (state.readConfirmed === true || state.readConfirmed === undefined)),
  );
}

/** Local content loading is the adapter; the directory itself is shared. */
export function LocalCatalog({
  data,
  catalog,
  onBack,
  onOpenLesson,
}: {
  readonly data: BootstrapData;
  readonly catalog: ReadonlyMap<string, StudyView>;
  readonly onBack: () => void;
  readonly onOpenLesson: (lesson: LessonRef) => void;
}) {
  const [views, setViews] = useState<ReadonlyMap<string, StudyView>>(() => new Map(catalog));
  const requested = useRef(new Set<string>(catalog.keys()));
  const [, setProgressVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = progressPort.subscribe(() => setProgressVersion((value) => value + 1));
    return unsubscribe;
  }, []);

  useEffect(() => {
    setViews((current) => {
      const next = new Map(current);
      let changed = false;
      for (const [id, view] of catalog) {
        if (next.get(id) === view) continue;
        next.set(id, view);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [catalog]);

  useEffect(() => {
    const missing = data.studies.filter((study) => {
      if (views.has(study.id) || requested.current.has(study.id)) return false;
      requested.current.add(study.id);
      return true;
    });
    if (missing.length === 0) return;
    let alive = true;
    void Promise.all(
      missing.map(async (study) => {
        const response = await fetch(`/api/studies/${encodeURIComponent(study.id)}`);
        return readJson<StudyView>(response);
      }),
    )
      .then((loaded) => {
        if (!alive) return;
        setViews((current) => {
          const next = new Map(current);
          loaded.forEach((view) => next.set(view.study.id, view));
          return next;
        });
      })
      .catch(() => {
        if (alive) setViews((current) => current);
      });
    return () => {
      alive = false;
    };
  }, [data, views]);

  const listing = useMemo<CatalogListing | null>(() => {
    if (data.studies.some((study) => !views.has(study.id))) return null;
    const baseStudies = data.studies.map((study) => {
      const view = views.get(study.id);
      const courses = (view?.courses ?? []).map((course) => {
        const lessons = course.units.flatMap((unit) =>
          unit.lessons.map((lesson) => {
            const state = progressPort.lessonState(lessonKey(study.id, course.id, lesson.id));
            return {
              id: lesson.id,
              title: lesson.title,
              variant: null,
              state: completed(lesson, state) ? ("done" as const) : ("idle" as const),
            };
          }),
        );
        const done = lessons.filter((lesson) => lesson.state === "done").length;
        return {
          id: course.id,
          title: course.title,
          depth: 0,
          prerequisiteCourseIds: [],
          prerequisiteTitles: [],
          state:
            done === lessons.length && lessons.length > 0 ? ("done" as const) : ("open" as const),
          done,
          total: lessons.length,
          units: course.units.map((unit) => ({
            id: unit.id,
            title: unit.title,
            lessons: lessons.filter((lesson) =>
              unit.lessons.some((candidate) => candidate.id === lesson.id),
            ),
          })),
        };
      });
      return {
        id: study.id,
        title: study.title,
        flat: true,
        courses,
      };
    });
    const firstOpen = baseStudies.flatMap((study) =>
      study.courses.flatMap((course) =>
        course.units.flatMap((unit) =>
          unit.lessons
            .filter((lesson) => lesson.state !== "done")
            .map((lesson) => ({ study, course, unit, lesson })),
        ),
      ),
    )[0];
    const nextLesson: LessonRef | null = firstOpen
      ? {
          studyId: firstOpen.study.id,
          courseId: firstOpen.course.id,
          unitId: firstOpen.unit.id,
          lessonId: firstOpen.lesson.id,
        }
      : null;
    const studies = baseStudies.map((study) => ({
      ...study,
      courses: study.courses.map((course) => ({
        ...course,
        state:
          course.id === nextLesson?.courseId && study.id === nextLesson.studyId
            ? ("live" as const)
            : course.state,
        units: course.units.map((unit) => ({
          ...unit,
          lessons: unit.lessons.map((lesson) =>
            lesson.id === nextLesson?.lessonId &&
            unit.id === nextLesson.unitId &&
            course.id === nextLesson.courseId &&
            study.id === nextLesson.studyId
              ? { ...lesson, state: "live" as const }
              : lesson,
          ),
        })),
      })),
    }));
    return {
      studies,
      totals: {
        studies: studies.length,
        courses: studies.reduce((sum, study) => sum + study.courses.length, 0),
        units: studies.reduce(
          (sum, study) =>
            sum + study.courses.reduce((courseSum, course) => courseSum + course.units.length, 0),
          0,
        ),
        lessons: studies.reduce(
          (sum, study) =>
            sum +
            study.courses.reduce(
              (courseSum, course) =>
                courseSum +
                course.units.reduce((unitSum, unit) => unitSum + unit.lessons.length, 0),
              0,
            ),
          0,
        ),
      },
      nextLesson,
    };
  }, [data.studies, views]);

  if (!listing) {
    return (
      <div className="catalog" aria-busy="true">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>正在读入本地课程目录。</p>
        </div>
      </div>
    );
  }

  return (
    <CatalogSurface
      listing={listing}
      onBack={onBack}
      onOpenLesson={onOpenLesson}
      lessonHref={(lesson) =>
        formatAddress({ section: "studies", studyId: lesson.studyId, lesson })
      }
    />
  );
}
