import { type CardProgress, type CourseProgress } from "@pieai/university-core";
import {
  createReviewCardPort,
  createVocabularyReviewPort,
} from "@pieai/university-ui/review/scheduler-ports.js";
import type { TodaySectionData } from "@pieai/university-ui/today/TodaySection.js";
import type { TodayCard } from "@pieai/university-ui/view/lesson-view.js";
import { useEffect, useMemo, useState } from "react";

import { withProductAnalyticsReview } from "../analytics/productAnalytics";
import { LEXICON } from "../lesson/language";
import { contentPort } from "../ports/index";
import { progressPort } from "../progress/store";
import { nextLessonOf, todayCardLocatorOf } from "./today-data";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";

interface TodaySectionDataOptions {
  readonly due: readonly CardProgress[];
  readonly focusedNextUpProgress: CourseProgress | null;
  readonly studies: readonly ShelfStudy[];
}

export function useTodaySectionData({
  due,
  focusedNextUpProgress,
  studies,
}: TodaySectionDataOptions) {
  /*
    The card the panel offers, with its front.

    The scheduler names a card; the shelf says which unit it is in; the text
    itself is content and comes through the port — which is a fetch in the
    authoring build and a memory read in the delivery one. Held as state rather
    than derived, because a fetch cannot be a `useMemo`.
  */
  const dueLocator = useMemo(
    () => (due[0] ? todayCardLocatorOf(studies, due[0]) : null),
    [studies, due[0]?.cardKey, due[0]?.contentRevision, due[0]?.kind],
  );
  const owner = progressPort.syncState().userId;
  const requestKey = due[0]
    ? `${owner ?? "guest"}:${due[0].cardKey}:${due[0].contentRevision}:${due[0].dueAt}`
    : null;
  const [resolved, setResolved] = useState<{
    key: string | null;
    card: TodayCard | null;
    state: "loading" | "ready" | "failed";
  }>({ key: null, card: null, state: "ready" });
  const todayCard = resolved.key === requestKey ? resolved.card : null;
  const cardState = resolved.key === requestKey ? resolved.state : "loading";
  useEffect(() => {
    const card = due[0];
    if (!dueLocator || !card) {
      setResolved({ key: requestKey, card: null, state: card ? "failed" : "ready" });
      return;
    }
    let alive = true;
    setResolved({ key: requestKey, card: null, state: "loading" });
    const timer = window.setTimeout(() => {
      if (!alive || progressPort.syncState().userId !== owner) return;
      alive = false;
      setResolved({ key: requestKey, card: null, state: "failed" });
    }, 30_000);
    void contentPort
      .card(dueLocator)
      .then((body) => {
        if (!alive || progressPort.syncState().userId !== owner) return;
        window.clearTimeout(timer);
        setResolved({
          key: requestKey,
          state: "ready",
          card: {
            ...dueLocator,
            front: body.front,
            contentRevision: body.contentRevision,
            dueAt: new Date(card.dueAt).toISOString(),
          },
        });
      })
      .catch(() => {
        // A card whose body cannot be read is not a card to offer. The panel
        // falls back to the next lesson, which is the honest thing on screen.
        window.clearTimeout(timer);
        if (alive && progressPort.syncState().userId === owner)
          setResolved({ key: requestKey, card: null, state: "failed" });
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [dueLocator, requestKey, owner]);

  const todayData = useMemo<TodaySectionData>(
    () => ({
      card: todayCard,
      cardState,
      // Today follows the learner's transient navigation context through
      // `focusedNextUpProgress`. The persisted authoring preference stays in
      // the local server/workbench boundary and is not smuggled into either
      // learner shell.
      nextLesson: nextLessonOf(studies, focusedNextUpProgress?.next ?? null, progressPort),
      dueCount: due.length,
      issues: [],
    }),
    [studies, todayCard, cardState, due, focusedNextUpProgress],
  );
  const todayReview = useMemo(
    () =>
      withProductAnalyticsReview(
        createReviewCardPort(contentPort, progressPort),
        () => progressPort.dueCards().length,
      ),
    [],
  );
  const todayVocabularyReview = useMemo(
    () => createVocabularyReviewPort(progressPort, LEXICON),
    [],
  );

  return { todayCard, todayData, todayReview, todayVocabularyReview };
}
