import { translate } from "../i18n/index.js";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  CONCEPT_CATEGORY_IDS,
  CONCEPT_CATEGORY_LABEL,
  CONCEPT_ENTRIES,
  assemblePracticeQuestion,
  conceptHeadToMarkdown,
  type ProgressPort,
  type LexiconEntry,
  type PracticeQuestion,
} from "@pieai/university-core";

import { EntryPage } from "../entry/EntryPage.js";
import { PracticeOverview, type PracticeOverviewCategory } from "./PracticeOverview.js";
import { PracticeStream } from "./PracticeStream.js";
import type { PracticeRecentStore } from "./storage.js";

type ConceptHead = (typeof CONCEPT_ENTRIES)[number]["head"];
type ConceptPracticeQuestion = PracticeQuestion<ConceptHead>;

/** One concept practice stream, with shell-owned navigation around it. */
export function PracticeSurface({
  store,
  progress,
  lexicon,
  onOpenWorld,
  onBrowse,
  onOpenReview,
  renderReward,
}: {
  readonly store: PracticeRecentStore;
  readonly progress: ProgressPort;
  readonly lexicon: readonly LexiconEntry[];
  readonly onOpenWorld?: () => void;
  readonly onBrowse?: () => void;
  readonly onOpenReview?: () => void;
  readonly renderReward?: (question: ConceptPracticeQuestion) => ReactNode;
}) {
  const questions = useMemo(() => {
    const built: ConceptPracticeQuestion[] = [];
    for (const entry of CONCEPT_ENTRIES) {
      const quiz = entry.sections.find((section) => section.type === "quiz");
      if (quiz?.type !== "quiz") continue;
      const assembled = assemblePracticeQuestion(
        entry,
        {
          prompt: quiz.payload.question,
          options: quiz.payload.options,
          correctOptionId: quiz.payload.correctOptionId,
        },
        { category: entry.head.category, id: entry.head.id },
      );
      if (assembled.ok) built.push(assembled.question);
    }
    return built;
  }, []);

  const progressSnapshot = useSyncExternalStore(
    progress.subscribe,
    progress.snapshot,
    progress.snapshot,
  );
  const overview = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of questions) {
      counts.set(question.subject.category, (counts.get(question.subject.category) ?? 0) + 1);
    }
    const questionIds = new Set(
      questions.map((question) => `${question.subject.category}-${question.subject.id}`),
    );
    const categories: PracticeOverviewCategory[] = CONCEPT_CATEGORY_IDS.map((id) => ({
      id,
      label: CONCEPT_CATEGORY_LABEL[id],
      count: counts.get(id) ?? 0,
    }));

    return {
      categories,
      dueTodayCount: progress.dueCards().length,
      dueTomorrowCount: progress.dueTomorrow(),
      questionCount: questions.length,
      recentCount: progressSnapshot.account.practiceRecent.ids.filter((id) => questionIds.has(id))
        .length,
    };
  }, [progress, progressSnapshot, questions]);

  const reward =
    renderReward ??
    ((question: ConceptPracticeQuestion) => (
      <EntryPage
        breadcrumb={[
          { label: translate("ui.practice.practiceSurface.copy.概念图解") },
          { label: question.entry.head.zh },
        ]}
        head={
          <>
            <h1>{question.entry.head.zh}</h1>
            <p className="reference-panel__gloss">{question.entry.head.tagline}</p>
          </>
        }
        sections={question.entry.sections}
        headMarkdown={conceptHeadToMarkdown(question.entry.head)}
        lexicon={new Map(lexicon.map((entry) => [entry.senseId, entry]))}
      />
    ));

  return (
    <div className="terms">
      {onOpenWorld ? (
        <GameButton
          variant="ghost"
          static
          type="button"
          className="practice-stream__leave"
          onClick={onOpenWorld}
        >
          {translate("ui.practice.practiceSurface.copy.关卡地图")}
        </GameButton>
      ) : null}
      <PracticeOverview {...overview} onOpenReview={onOpenReview} />
      <PracticeStream
        questions={questions}
        store={store}
        onBrowse={onBrowse}
        renderReward={reward}
      />
    </div>
  );
}
