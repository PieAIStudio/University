import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CatalogSurface } from "@pieai/university-ui";

import { library, loadCourse, type Course } from "../content/library";
import { progressSource } from "../progress/source";
import { snapshot, subscribe } from "../progress/store";
import { toHash, WORLD, type View } from "@pieai/university-core";
import { assembleCatalogListing } from "./listing";

/** The online adapter supplies published content and the shared catalog surface supplies the UI. */
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
      <div className="catalog">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>课程目录读不出来。刷新这一页再试。</p>
          <button type="button" className="linkish" onClick={() => onOpen(WORLD)}>
            在地图上看
          </button>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="catalog" aria-busy="true">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>正在读入课程目录。</p>
        </div>
      </div>
    );
  }

  return (
    <CatalogSurface
      listing={listing}
      onBack={() => onOpen(WORLD)}
      onOpenLesson={(lesson) => onOpen({ kind: "lesson", ...lesson })}
      lessonHref={(lesson) => toHash({ kind: "lesson", ...lesson })}
    />
  );
}
