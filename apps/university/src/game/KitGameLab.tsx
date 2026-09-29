import { linkRoundsFromLesson, type GameLesson } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useEffect, useState, type ReactNode } from "react";

import { contentPort } from "../ports/index";
import { LinksGame } from "./LinksGame.js";

/**
 * A kit game in the play lab, for review (ADR-0011). Each game's content is
 * scarce in a different place, so the lab walks the shelf in order and plays
 * the first course that gives it enough rounds — read through the same content
 * port as the map, and without looking at progress, which it says.
 */
const ENOUGH_ROUNDS = 3;

interface KitLab<R> {
  readonly project: (lesson: GameLesson) => readonly R[];
  readonly play: (rounds: readonly R[]) => ReactNode;
}

const LABS = {
  links: {
    project: linkRoundsFromLesson,
    play: (rounds) => <LinksGame rounds={rounds} />,
  } satisfies KitLab<ReturnType<typeof linkRoundsFromLesson>[number]>,
} as const;

export type KitLabGame = keyof typeof LABS;

async function firstCourseWithRounds<R>(
  project: (lesson: GameLesson) => readonly R[],
  signal: AbortSignal,
): Promise<{ course: string; rounds: readonly R[] }> {
  const shelf = await contentPort.shelf();
  let best: { course: string; rounds: readonly R[] } = { course: "", rounds: [] };
  for (const study of shelf.studies) {
    for (const course of study.courses) {
      const refs = course.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({
          studyId: study.id,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
        })),
      );
      const views = await Promise.all(
        refs.map((ref) => contentPort.lesson(ref, { signal }).catch(() => null)),
      );
      if (signal.aborted) return best;
      const rounds = views.flatMap((view) =>
        view
          ? project({
              id: view.lesson.id,
              title: view.lesson.title,
              activities: view.lesson.activities ?? [],
            })
          : [],
      );
      if (rounds.length > best.rounds.length) best = { course: course.title, rounds };
      if (rounds.length >= ENOUGH_ROUNDS) return best;
    }
  }
  return best;
}

export function KitGameLab({ game }: { game: KitLabGame }) {
  const { t } = useI18n();
  const lab = LABS[game] as KitLab<unknown>;
  const [found, setFound] = useState<{ course: string; rounds: readonly unknown[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    firstCourseWithRounds(lab.project, request.signal)
      .then((result) => {
        if (!request.signal.aborted) setFound(result);
      })
      .catch(() => {
        if (!request.signal.aborted) setFailed(true);
      });
    return () => request.abort();
  }, [lab]);
  if (failed) return <p role="alert">{t("mapNodes.loadFailed")}</p>;
  if (!found) return <p role="status">{t("mapNodes.loading")}</p>;
  if (!found.rounds.length) return <p role="status">{t("gameKit.labEmpty")}</p>;
  return (
    <>
      <p>
        {t(`${game}.labNote`)} {t("gameKit.labCourse", { course: found.course })}
      </p>
      {lab.play(found.rounds)}
    </>
  );
}
