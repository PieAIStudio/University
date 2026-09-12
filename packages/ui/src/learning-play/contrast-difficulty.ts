import type { ActivityDifficulty, ActivityFamily, ContrastActivity } from "@pieai/university-core";

import { translate as t } from "../i18n/index.js";
import { getContrastCases } from "./contrast-examples.js";

/**
 * Three tiers for a `contrast` board.
 *
 * Nothing is multiplied — `contrast` has no number to scale, and the engine
 * never reads `difficulty`. What changes is which cases are on the table, and
 * each tier adds a case that breaks the rule the previous tier would let you
 * leave with:
 *
 *   intro     one case where they agree, one where they split. The minimum
 *             that can teach anything, and the minimum the engine accepts.
 *   practice  adds the typo and the order number. The order number is the
 *             first case where the cleverer method is the one that loses, so
 *             「meaning-matching is better」 stops working here.
 *   challenge adds the homograph, where both land in the same place and it is
 *             the wrong place. 「They agree, so it is right」 is the last easy
 *             rule left standing, and this is where it falls over.
 *
 * The intro tier keeps the two cases the engine's own floor requires: a board
 * that only agrees, or only splits, is refused, because a reader answering the
 * same way every time would finish it.
 */
export function getContrastFamily(activity: ContrastActivity): ActivityFamily {
  const goal = (level: ActivityDifficulty) => t(`play.difficulty.contrast.${level}`);
  const tag = (task: ContrastActivity, difficulty: ActivityDifficulty): ContrastActivity => ({
    ...task,
    id: `${activity.id}:${difficulty}:v1`,
    difficulty,
  });

  const all = getContrastCases();
  const byId = new Map(activity.cases.map((kase) => [kase.id, kase]));
  const pick = (id: string) => byId.get(id) ?? all[id]!;

  return {
    id: activity.id,
    kind: "contrast",
    levels: {
      intro: tag(
        { ...activity, goal: goal("intro"), cases: [pick("exact"), pick("synonym")] },
        "intro",
      ),
      practice: tag({ ...activity, goal: goal("practice") }, "practice"),
      challenge: tag(
        {
          ...activity,
          goal: goal("challenge"),
          cases: [...activity.cases, all.homograph!],
        },
        "challenge",
      ),
    },
  };
}
