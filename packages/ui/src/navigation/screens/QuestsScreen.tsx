import { translate } from "../../i18n/index.js";
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
export const QUESTS_TITLE = translate("ui.navigation.screens.questsScreen.copy.今天");

function QuestRow({
  quest,
  learnHref,
  reviewHref,
}: {
  quest: Quest;
  learnHref: string;
  reviewHref: string;
}) {
  const done = questComplete(quest);
  return (
    <li
      className={`quest${done ? " quest--done" : ""}${quest.informational ? " quest--info" : ""}`}
    >
      <div className="quest__head">
        <span className="quest__title">{quest.title}</span>
        <GameBadge tone={quest.informational ? "neutral" : done ? "success" : "neutral"}>
          {quest.informational
            ? translate("ui.navigation.screens.questsScreen.copy.不计分")
            : done
              ? translate("ui.navigation.screens.questsScreen.copy.完成")
              : `${quest.done}/${quest.goal}`}
        </GameBadge>
      </div>
      {quest.goal > 1 && !quest.informational ? (
        <GameProgress
          label={quest.title}
          value={questProgress(quest)}
          max={1}
          tone={done ? "success" : "accent"}
          valueLabel={`${quest.done} / ${quest.goal}`}
        />
      ) : null}
      {!done && !quest.informational ? (
        <a
          className="linkish quest__action"
          data-quest-action={quest.id}
          href={quest.id === "review" ? reviewHref : learnHref}
        >
          {translate(
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
        <p className="shell-screen__lede">{translate("product.quest.intro")}</p>
      </header>

      <GamePanel tone="strong">
        <GameProgress
          label={translate("ui.navigation.screens.questsScreen.copy.今天的进度")}
          value={finished}
          max={scored.length}
          tone={finished === scored.length ? "success" : "accent"}
          valueLabel={`${finished} / ${scored.length}`}
        />
      </GamePanel>

      <ul className="quest-list">
        {quests.map((quest) => (
          <QuestRow key={quest.id} quest={quest} learnHref={learnHref} reviewHref={reviewHref} />
        ))}
      </ul>
      <details className="product-details">
        <summary>{translate("product.quest.details")}</summary>
        {quests.map((quest) => (
          <p key={quest.id}>
            <strong>{quest.title}</strong> · {quest.detail}
          </p>
        ))}
      </details>

      {finished === scored.length ? (
        <GameCallout
          tone="success"
          heading={translate("ui.navigation.screens.questsScreen.copy.今天到这儿就够了")}
        >
          {translate("product.quest.doneBrief")}
        </GameCallout>
      ) : null}
    </section>
  );
}
