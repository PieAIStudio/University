import type { ActivityDifficulty, ActivityFamily, WeighActivity } from "@pieai/university-core";

import { translate as t } from "../i18n/index.js";
import { getWeighOptions, getWeighSituations } from "./weigh-examples.js";

/**
 * Three tiers for a `weigh` board.
 *
 *   intro     two situations, one for each choice. The smallest board on which
 *             an answer can be seen to move.
 *   practice  four situations, still two choices. Now each choice wins twice,
 *             so 「it was alternating」 stops being a strategy.
 *   challenge a third choice — 「ask who owns this」 — which is the answer
 *             practice cannot express, plus the situation where asking is not
 *             available either. A tier that only added a third right answer
 *             would teach that there is always a way out.
 *
 * The engine refuses an option that never wins, so the challenge tier adds the
 * third option and the situation it wins in the same step, exactly as the sort
 * family adds its fourth bucket with the item that lands in it.
 */
export function getWeighFamily(activity: WeighActivity): ActivityFamily {
  const goal = (level: ActivityDifficulty) => t(`play.difficulty.weigh.${level}`);
  const tag = (task: WeighActivity, difficulty: ActivityDifficulty): WeighActivity => ({
    ...task,
    id: `${activity.id}:${difficulty}:v1`,
    difficulty,
  });

  const option = getWeighOptions();
  const situation = getWeighSituations();
  const byId = new Map(activity.situations.map((item) => [item.id, item]));
  const pick = (id: string) => byId.get(id) ?? situation[id]!;

  return {
    id: activity.id,
    kind: "weigh",
    levels: {
      intro: tag(
        { ...activity, goal: goal("intro"), situations: [pick("button"), pick("crash")] },
        "intro",
      ),
      practice: tag({ ...activity, goal: goal("practice") }, "practice"),
      challenge: tag(
        {
          ...activity,
          goal: goal("challenge"),
          options: [...activity.options, option.ask!],
          situations: [...activity.situations, situation.firstDay!, situation.nobody!],
        },
        "challenge",
      ),
    },
  };
}
