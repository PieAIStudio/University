import { interfaceTranslator, useI18n } from "../../i18n/index.js";
import { GameBadge, GameCallout, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import {
  questComplete,
  questProgress,
  questsForToday,
  scoredQuests,
  type ProgressDocument,
  type Quest,
} from "@pieai/university-core";

/**
 * 任务 — today's three, read off the progress document.
 *
 * Nothing on this screen is stored. Every number is a question asked of the
 * same document the learning screens write, which is why it can never say
 * "0/1" next to a lesson the learner just finished. See `progress/goals.ts`.
 */
export const QUESTS_TITLE = interfaceTranslator.t("ui.navigation.screens.questsScreen.copy.今天");

function questCopy(quest: Quest, t: ReturnType<typeof useI18n>) {
  if (quest.id === "lesson")
    return {
      title: t.t("doors.goal.count", { count: quest.goal }),
      detail: t.t("doors.quest.lessonDetail"),
    };
  if (quest.id === "review")
    return {
      title: t.t(quest.informational ? "doors.quest.noReview" : "doors.quest.review"),
      detail: t.t(quest.informational ? "doors.quest.noReviewDetail" : "doors.quest.reviewDetail"),
    };
  if (quest.id === "streak")
    return { title: t.t("doors.quest.streak"), detail: t.t("doors.quest.streakDetail") };
  return quest;
}

function QuestRow({
  quest,
  learnHref,
  reviewHref,
}: {
  quest: Quest;
  learnHref: string;
  reviewHref: string;
}) {
  const interfaceTranslator = useI18n();
  const done = questComplete(quest);
  const copy = questCopy(quest, interfaceTranslator);
  return (
    <li
      className={`quest${done ? " quest--done" : ""}${quest.informational ? " quest--info" : ""}`}
    >
      <div className="quest__head">
        <span className="quest__title">{copy.title}</span>
        <GameBadge tone={quest.informational ? "neutral" : done ? "success" : "neutral"}>
          {quest.informational
            ? interfaceTranslator.t("ui.navigation.screens.questsScreen.copy.不计分")
            : done
              ? interfaceTranslator.t("ui.navigation.screens.questsScreen.copy.完成")
              : `${quest.done}/${quest.goal}`}
        </GameBadge>
      </div>
      {quest.goal > 1 && !quest.informational ? (
        <GameProgress
          label={copy.title}
          value={questProgress(quest)}
          max={1}
          valueLabel={`${quest.done} / ${quest.goal}`}
        />
      ) : null}
      {!done && !quest.informational ? (
        <a
          className="linkish quest__action"
          data-quest-action={quest.id}
          href={quest.id === "review" ? reviewHref : learnHref}
        >
          {interfaceTranslator.t(
            quest.id === "review"
              ? "product.quest.review"
              : quest.id === "streak"
                ? "product.quest.streak"
                : "product.quest.learn",
          )}
        </a>
      ) : null}
    </li>
  );
}

export function QuestsScreen({
  document: progress,
  now = Date.now(),
  learnHref = "/",
  reviewHref = "/review",
}: {
  readonly document: ProgressDocument;
  readonly now?: number;
  readonly learnHref?: string;
  readonly reviewHref?: string;
}) {
  const interfaceTranslator = useI18n();
  const quests = questsForToday(progress, now);
  // Scored, not all: a review quest with nothing due is satisfied before the
  // learner has done anything, and counting it hands out a free third of the
  // day. It still appears in the list — it is telling them something true.
  const scored = scoredQuests(quests);
  const finished = scored.filter(questComplete).length;

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{QUESTS_TITLE}</h1>
        <p className="shell-screen__lede">{interfaceTranslator.t("product.quest.intro")}</p>
      </header>

      <GamePanel tone="strong">
        <GameProgress
          label={interfaceTranslator.t("ui.navigation.screens.questsScreen.copy.今天的进度")}
          value={finished}
          max={scored.length}
          valueLabel={`${finished} / ${scored.length}`}
        />
      </GamePanel>

      <ul className="quest-list">
        {quests.map((quest) => (
          <QuestRow key={quest.id} quest={quest} learnHref={learnHref} reviewHref={reviewHref} />
        ))}
      </ul>
      <details className="product-details">
        <summary>{interfaceTranslator.t("product.quest.details")}</summary>
        {quests.map((quest) => (
          <p key={quest.id}>
            <strong>{questCopy(quest, interfaceTranslator).title}</strong> ·{" "}
            {questCopy(quest, interfaceTranslator).detail}
          </p>
        ))}
      </details>

      {finished === scored.length ? (
        <GameCallout
          tone="success"
          heading={interfaceTranslator.t(
            "ui.navigation.screens.questsScreen.copy.今天到这儿就够了",
          )}
        >
          {interfaceTranslator.t("product.quest.doneBrief")}
        </GameCallout>
      ) : null}
    </section>
  );
}
