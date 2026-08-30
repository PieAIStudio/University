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

function QuestRow({ quest }: { quest: Quest }) {
  const done = questComplete(quest);
  return (
    <li className={`quest${done ? " quest--done" : ""}`}>
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
      <GameProgress
        label={quest.title}
        value={questProgress(quest)}
        max={1}
        tone={done ? "success" : "accent"}
        valueLabel={`${quest.done} / ${quest.goal}`}
      />
      <p className="quest__detail">{quest.detail}</p>
    </li>
  );
}

export function QuestsScreen({
  document: progress,
  now = Date.now(),
}: {
  readonly document: ProgressDocument;
  readonly now?: number;
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
        <p className="shell-screen__lede">
          {translate(
            "ui.navigation.screens.questsScreen.copy.每天都是同样几件-换着花样出任务是让人来开-App-的手段-天天一样才养得成习惯-而间隔重复要的就是习惯",
          )}
        </p>
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
          <QuestRow key={quest.id} quest={quest} />
        ))}
      </ul>

      {finished === scored.length ? (
        <GameCallout
          tone="success"
          heading={translate("ui.navigation.screens.questsScreen.copy.今天到这儿就够了")}
        >
          {translate(
            "ui.navigation.screens.questsScreen.copy.再学下去当然可以-但今天该记住的东西已经安排好了-真正决定你记不记得住的是明天来不来-不是今天学了多少",
          )}
        </GameCallout>
      ) : null}
    </section>
  );
}
