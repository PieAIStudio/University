import { formatDate, translate } from "../i18n/index.js";
import { useEffect, useState } from "react";
import {
  GameBadge,
  GameButton,
  GameCallout,
  GameEmptyState,
  GamePanel,
} from "@pieai/swimmer-ui-kit";
import { type LessonRef, type Mistake } from "@pieai/university-core";

import type { ContentPort, MistakeExercise } from "../content/port.js";
import { MarkdownContent } from "../markdown/MarkdownContent.js";

export interface MistakesEntryProps {
  readonly count: number;
  /** Keep the completed book reachable without rendering a noisy zero badge. */
  readonly hasMistakes: boolean;
}

export interface MistakeListProps {
  readonly mistakes: readonly Mistake[];
  readonly content: ContentPort;
  readonly onOpenLesson: (locator: LessonRef) => void;
}

interface ResolvedMistake {
  readonly mistake: Mistake;
  readonly exercise: MistakeExercise | null;
  /** The stored row is for an old question edition and must not be shown. */
  readonly stale: boolean;
}

/** The review page's one way into the mistake book. */
export function MistakesEntry({ count, hasMistakes }: MistakesEntryProps) {
  if (!hasMistakes) return null;
  return (
    <a
      className="mistakes-entry"
      href="/mistakes"
      aria-label={
        count > 0
          ? translate("ui.practice.mistakeList.copy.错题本") +
            count +
            translate("ui.practice.mistakeList.copy.道未订正")
          : translate("ui.practice.mistakeList.copy.错题本-全部已订正")
      }
    >
      <span>
        <span className="mistakes-entry__eyebrow">
          {translate("ui.practice.mistakeList.copy.复习里的另一条路")}
        </span>
        <strong>{translate("ui.practice.mistakeList.copy.错题本-4d8qe0")}</strong>
      </span>
      {count > 0 ? <GameBadge tone="warning">{count}</GameBadge> : null}
      {count === 0 ? (
        <span className="mistakes-entry__done">
          {translate("ui.practice.mistakeList.copy.已订正")}
        </span>
      ) : null}
    </a>
  );
}

export function MistakeList({ mistakes, content, onOpenLesson }: MistakeListProps) {
  const [resolved, setResolved] = useState<readonly ResolvedMistake[] | null>(null);
  const signature = mistakes
    .map((mistake) =>
      [
        mistake.locator.studyId,
        mistake.locator.courseId,
        mistake.locator.unitId,
        mistake.locator.lessonId,
        mistake.exerciseId,
        mistake.contentRevision,
        mistake.wrongAnswer,
        mistake.wrongAt,
        mistake.wrongCount,
        mistake.corrected,
        mistake.correctedAt ?? "",
      ].join("/"),
    )
    .join("|");

  useEffect(() => {
    let alive = true;
    setResolved(null);
    void Promise.all(
      mistakes.map(async (mistake): Promise<ResolvedMistake> => {
        try {
          const exercise = await content.exercise(mistake.locator, mistake.exerciseId);
          return {
            mistake,
            exercise: exercise.contentRevision === mistake.contentRevision ? exercise : null,
            stale: exercise.contentRevision !== mistake.contentRevision,
          };
        } catch {
          // A deleted lesson or an uninstalled delivery package is still a
          // useful record. The honest fallback is the answer, not silence.
          return { mistake, exercise: null, stale: false };
        }
      }),
    ).then((next) => {
      if (alive) setResolved(next);
    });
    return () => {
      alive = false;
    };
  }, [content, signature]);

  if (mistakes.length === 0) {
    return (
      <GameEmptyState
        className="mistake-list mistake-list--empty"
        title={translate("ui.practice.mistakeList.copy.还没有错题")}
        description={translate(
          "ui.practice.mistakeList.copy.答错的题会留在这里-先去上一道练习-错过的地方就有了回头路",
        )}
      />
    );
  }

  if (resolved === null) {
    return (
      <GamePanel
        className="mistake-list mistake-list--loading"
        title={translate("ui.practice.mistakeList.copy.错题本-4d8qe0")}
      >
        <p>{translate("ui.practice.mistakeList.copy.正在找回错题内容")}</p>
      </GamePanel>
    );
  }

  const visible = resolved.filter((item) => !item.stale);
  const allCorrected = mistakes.every((mistake) => mistake.corrected);

  const pending = mistakes.filter((mistake) => !mistake.corrected).length;

  return (
    <section className="mistake-list" aria-labelledby="mistake-list-title">
      {/*
        Named for a person, not only for a screen reader.

        The loading state and the empty state both said 「错题本」 and the state
        a learner actually spends time in said it in an `aria-label` — so the
        page opened straight into a card with no title on it, and the only clue
        to where you were was that the rail had lit 「更多」.
      */}
      <header className="mistake-list__head">
        <h2 id="mistake-list-title">{translate("ui.practice.mistakeList.copy.错题本-4d8qe0")}</h2>
        <p className="mistake-list__count">
          {pending > 0
            ? translate("ui.practice.mistakeList.copy.value0-道还没订正", { value0: pending })
            : translate("ui.practice.mistakeList.copy.value0-道-都订正过了", {
                value0: mistakes.length,
              })}
        </p>
      </header>
      {allCorrected ? (
        <GameCallout
          className="mistake-list__celebration"
          heading={translate("ui.practice.mistakeList.copy.都订正好了")}
          tone="success"
        >
          {translate(
            "ui.practice.mistakeList.copy.这本错题本已经清空-之前绊住你的题都被你修好了-它们还留在下面-随时可以再看",
          )}
        </GameCallout>
      ) : null}
      {visible.length === 0 ? (
        <GameCallout
          heading={translate("ui.practice.mistakeList.copy.这道题已经换版")}
          tone="neutral"
        >
          {translate(
            "ui.practice.mistakeList.copy.旧题已经从当前课程里撤下-这条记录不再指向一道存在的题",
          )}
        </GameCallout>
      ) : (
        <div className="mistake-list__items">
          {visible.map((item) => (
            <MistakeCard key={mistakeKey(item.mistake)} {...item} onOpenLesson={onOpenLesson} />
          ))}
        </div>
      )}
    </section>
  );
}

function MistakeCard({
  mistake,
  exercise,
  onOpenLesson,
}: ResolvedMistake & { readonly onOpenLesson: (locator: LessonRef) => void }) {
  const answer = mistake.wrongAnswer || translate("ui.practice.mistakeList.copy.空答案");
  return (
    <GamePanel
      className="mistake-card"
      title={exercise?.title ?? translate("ui.practice.mistakeList.copy.这道练习题")}
    >
      <header className="mistake-card__header">
        <div>
          <p className="mistake-card__lesson">
            {exercise?.lessonTitle ?? translate("ui.practice.mistakeList.copy.课程内容暂时不可用")}
          </p>
          <p className="mistake-card__status">
            <GameBadge tone={mistake.corrected ? "success" : "danger"}>
              {mistake.corrected
                ? translate("ui.practice.mistakeList.copy.已订正")
                : translate("ui.practice.mistakeList.copy.待订正")}
            </GameBadge>
          </p>
        </div>
      </header>

      {exercise ? (
        <div className="mistake-card__content">
          <section>
            <h3>{translate("ui.practice.mistakeList.copy.题目")}</h3>
            <MarkdownContent>{exercise.prompt}</MarkdownContent>
          </section>
          <div className="mistake-card__answers">
            <section>
              <h3>{translate("ui.practice.mistakeList.copy.你当时答")}</h3>
              <p>{answer}</p>
            </section>
            {/*
              A build that cannot fetch the answer says so, and says why it is
              still worth being here: the question and your own answer are the
              two halves you need to have another go. Printing 「暂时不可用」 in
              the answer's place would read as a fault; this is a boundary.
            */}
            <section>
              <h3>{translate("ui.practice.mistakeList.copy.正确答案")}</h3>
              {exercise.correctAnswer === null ? (
                <p className="mistake-card__withheld">
                  {translate(
                    "ui.practice.mistakeList.copy.这个版本不随课程包下发参考答案-题目和你当时的答案都在上面-先自己再想一遍",
                  )}
                </p>
              ) : (
                <MarkdownContent>{exercise.correctAnswer}</MarkdownContent>
              )}
            </section>
          </div>
        </div>
      ) : (
        <p className="mistake-card__fallback">
          {translate("ui.practice.mistakeList.copy.你答过")}
          {answer}
        </p>
      )}

      <footer className="mistake-card__footer">
        <p>
          {translate("ui.practice.mistakeList.copy.答错于")}{" "}
          <time dateTime={mistake.wrongAt}>{formatMistakeDate(mistake.wrongAt)}</time>{" "}
          {translate("ui.practice.mistakeList.copy.共错")} {mistake.wrongCount}{" "}
          {translate("ui.practice.mistakeList.copy.次")}
          {mistake.correctedAt ? (
            <>
              {" "}
              {translate("ui.practice.mistakeList.copy.已于")}{" "}
              <time dateTime={mistake.correctedAt}>{formatMistakeDate(mistake.correctedAt)}</time>{" "}
              {translate("ui.practice.mistakeList.copy.订正")}
            </>
          ) : null}
        </p>
        <GameButton variant="ghost" type="button" onClick={() => onOpenLesson(mistake.locator)}>
          {translate("ui.practice.mistakeList.copy.回到这课")}
        </GameButton>
      </footer>
    </GamePanel>
  );
}

function mistakeKey(mistake: Mistake): string {
  return [
    mistake.locator.studyId,
    mistake.locator.courseId,
    mistake.locator.unitId,
    mistake.locator.lessonId,
    mistake.exerciseId,
    mistake.contentRevision,
  ].join("/");
}

function formatMistakeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDate(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
