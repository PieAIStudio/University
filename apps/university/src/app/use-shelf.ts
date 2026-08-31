import { translate } from "@pieai/university-ui/i18n.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { courseNodesOf } from "@pieai/university-world/course.js";
import type { ContentStudy, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import { contentPort } from "../ports/index";

export function useShelf() {
  /*
    Every series and every course's shape, from whichever source this build has.
    One request: the map, the switcher, the planet, the 2D directory and the
    reader's prev/next all read this, and two of them used to read a different
    one.
  */
  const [shelf, setShelf] = useState<Shelf | null>(null);
  /*
    Who is on the shelf, before anything about it has been counted.

    The capsule at the top of every screen names the series you are in, and it
    must not wait for the authoring server to measure 579 lessons to do it.
    Names arrive first; the counts fill in behind them.
  */
  const [studyNames, setStudyNames] = useState<readonly ContentStudy[]>(
    () => contentPort.knownStudies ?? [],
  );
  const [shelfError, setShelfError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    const reportError = (reason: unknown) => {
      if (!alive) return;
      setShelfError(
        reason instanceof Error ? reason.message : translate("app.app.useshelf.copy.读不到课程"),
      );
    };
    void contentPort
      .studies()
      .then((names) => {
        if (alive) setStudyNames(names);
      })
      .catch(reportError);
    void contentPort
      .shelf()
      .then((next) => {
        if (alive) setShelf(next);
      })
      .catch(reportError);
    return () => {
      alive = false;
    };
  }, [reloads]);

  const retryShelf = useCallback(() => {
    setShelf(null);
    setShelfError(null);
    setReloads((current) => current + 1);
  }, []);

  const studies = useMemo(
    () => shelf?.studies ?? studyNames.map((study) => ({ ...study, courses: [] })),
    [shelf, studyNames],
  );
  const nodes = useMemo(() => (shelf ? courseNodesOf(shelf.studies) : null), [shelf]);
  /** One course's shape, by address. Synchronous: the shelf is already here. */
  const courseOf = useCallback(
    (studyId: string, courseId: string): CourseView | null =>
      studies
        .find((study) => study.id === studyId)
        ?.courses.find((entry) => entry.id === courseId) ?? null,
    [studies],
  );

  return {
    shelf,
    studyNames,
    shelfError,
    retryShelf,
    studies,
    nodes,
    courseOf,
  };
}
