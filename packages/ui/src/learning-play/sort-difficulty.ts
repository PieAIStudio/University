import type { ActivityDifficulty, ActivityFamily, SortActivity } from "@pieai/university-core";

import { translate as t } from "../i18n/index.js";
import { getSortElsewhereBucket, getSortElsewhereItem } from "./sort-examples.js";

/**
 * Three tiers for a `sort` board, and what actually differs between them.
 *
 * Not a multiplier on anything. `sort` has no number to scale, and the engine
 * never reads `difficulty` — so a tier has to be a genuinely different task or
 * it is the same board wearing a label. What changes here is how many lines the
 * reader has to hold at once:
 *
 *   intro     two buckets, and only the items that separate them. The first
 *             boundary — 「加一样东西」 versus 「改它长什么样」 — on its own.
 *   practice  all three buckets and every item, which is the real question.
 *   challenge a fourth bucket for the changes none of the three files own,
 *             plus the item that belongs in it. This is the tier that stops
 *             「一定是这三个之一」 from being the lesson somebody takes away.
 *
 * The challenge bucket arrives with its item deliberately: the engine refuses a
 * bucket nothing ever lands in, because an always-empty option is one the
 * reader can eliminate without understanding a thing.
 */
export function getSortFamily(activity: SortActivity): ActivityFamily {
  const goal = (level: ActivityDifficulty) => t(`play.difficulty.sort.${level}`);
  const tag = (task: SortActivity, difficulty: ActivityDifficulty): SortActivity => ({
    ...task,
    id: `${activity.id}:${difficulty}:v1`,
    difficulty,
  });

  const twoBuckets = activity.buckets.filter((bucket) => bucket.id !== "js");
  const keptIds = new Set(twoBuckets.map((bucket) => bucket.id));
  const introItems = activity.items
    .filter((item) => keptIds.has(item.bucketId))
    .filter((item) => !item.tempting || keptIds.has(item.tempting.bucketId));

  const elsewhere = getSortElsewhereBucket();
  const elsewhereItem = getSortElsewhereItem();

  return {
    id: activity.id,
    kind: "sort",
    levels: {
      intro: tag(
        { ...activity, goal: goal("intro"), buckets: twoBuckets, items: introItems },
        "intro",
      ),
      practice: tag({ ...activity, goal: goal("practice") }, "practice"),
      challenge: tag(
        {
          ...activity,
          goal: goal("challenge"),
          buckets: [...activity.buckets, elsewhere],
          items: [...activity.items, elsewhereItem],
        },
        "challenge",
      ),
    },
  };
}
