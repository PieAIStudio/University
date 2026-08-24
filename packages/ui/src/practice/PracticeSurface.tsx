import { useMemo, type ReactNode } from "react";
import {
  CONCEPT_ENTRIES,
  assemblePracticeQuestion,
  conceptHeadToMarkdown,
  type LexiconEntry,
  type PracticeQuestion,
} from "@pieai/university-core";

import { EntryPage } from "../entry/EntryPage.js";
import { PracticeStream } from "./PracticeStream.js";
import type { PracticeRecentStore } from "./storage.js";

type ConceptHead = (typeof CONCEPT_ENTRIES)[number]["head"];
type ConceptPracticeQuestion = PracticeQuestion<ConceptHead>;

/** One concept practice stream, with shell-owned navigation around it. */
export function PracticeSurface({
  store,
  lexicon,
  onOpenWorld,
  onBrowse,
  renderReward,
}: {
  readonly store: PracticeRecentStore;
  readonly lexicon: readonly LexiconEntry[];
  readonly onOpenWorld?: () => void;
  readonly onBrowse?: () => void;
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

  const reward =
    renderReward ??
    ((question: ConceptPracticeQuestion) => (
      <EntryPage
        breadcrumb={[{ label: "概念图解" }, { label: question.entry.head.zh }]}
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
        <button type="button" className="practice-stream__leave" onClick={onOpenWorld}>
          ← 关卡地图
        </button>
      ) : null}
      <PracticeStream
        questions={questions}
        store={store}
        onBrowse={onBrowse}
        renderReward={reward}
      />
    </div>
  );
}
