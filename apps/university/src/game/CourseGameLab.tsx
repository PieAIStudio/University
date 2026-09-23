import { gameRoundsForSegment, learningSegments, type GameRound } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useEffect, useState } from "react";

import { contentPort } from "../ports/index";
import { InterceptGame } from "./InterceptGame.js";

/**
 * 庭院拦截 in the play lab, for review (ADR-0011): the first course's first
 * challenge segment, read through the same content port as the map. The lab
 * does not look at progress — it previews what the node plays once those
 * lessons are done — and it says so.
 */
const STUDY = "ai-literacy";
const COURSE = "understanding-ai";

export function CourseGameLab() {
  const { t } = useI18n();
  const [rounds, setRounds] = useState<GameRound[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    void (async () => {
      const shelf = await contentPort.shelf();
      const course = shelf.studies
        .find((study) => study.id === STUDY)
        ?.courses.find((candidate) => candidate.id === COURSE);
      if (!course) throw new Error("course-missing");
      // The first segment the map gives a challenge node (even ordinals).
      const segment = learningSegments(course).find((candidate) => candidate.ordinal % 2 === 0);
      if (!segment) throw new Error("segment-missing");
      const outline = course.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({ unitId: unit.id, lessonId: lesson.id })),
      );
      const lessons = await Promise.all(
        outline
          .slice(0, segment.lastIndex + 1)
          .map(({ unitId, lessonId }) =>
            contentPort.lesson(
              { studyId: STUDY, courseId: COURSE, unitId, lessonId },
              { signal: request.signal },
            ),
          ),
      );
      if (request.signal.aborted) return;
      setRounds([
        ...gameRoundsForSegment(
          lessons.map((view) => ({
            id: view.lesson.id,
            title: view.lesson.title,
            activities: view.lesson.activities ?? [],
          })),
          segment.lessonIds,
        ),
      ]);
    })().catch(() => {
      if (!request.signal.aborted) setFailed(true);
    });
    return () => request.abort();
  }, []);
  if (failed) return <p role="alert">{t("mapNodes.loadFailed")}</p>;
  if (!rounds) return <p role="status">{t("mapNodes.loading")}</p>;
  return (
    <>
      <p>{t("intercept.labNote")}</p>
      <InterceptGame rounds={rounds} />
    </>
  );
}
