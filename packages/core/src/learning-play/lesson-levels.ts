import {
  ACTIVITY_DIFFICULTIES,
  type ActivityDifficulty,
  type LearningActivitySpec,
} from "./types.js";

/**
 * One activity at the difficulties a lesson actually authored.
 *
 * `ActivityFamily` next door requires all three and is right to: the play lab
 * ships its own examples and can guarantee them. A lesson cannot. Twenty-seven
 * of them already exist with one level each, and refusing to render those would
 * make the feature unavailable on the only content that uses it. So this is a
 * partial map, and the host shows a picker only when there is somewhere to go.
 */
export interface ActivityLevels {
  /** Shared `family` id, or the activity's own id when it stands alone. */
  readonly id: string;
  readonly levels: Readonly<Partial<Record<ActivityDifficulty, LearningActivitySpec>>>;
}

/**
 * Which level a learner starts on.
 *
 * V5 §「难度」: 「默认先提供入门」. Starting at the hardest level a lesson
 * happens to author would make the default depend on what the author wrote
 * rather than on what the learner needs.
 */
export function defaultActivityLevel(levels: ActivityLevels): ActivityDifficulty {
  for (const difficulty of ACTIVITY_DIFFICULTIES) {
    if (levels.levels[difficulty]) return difficulty;
  }
  return "practice";
}

/** The levels available, in intro → practice → challenge order. */
export function availableLevels(levels: ActivityLevels): readonly ActivityDifficulty[] {
  return ACTIVITY_DIFFICULTIES.filter((difficulty) => Boolean(levels.levels[difficulty]));
}

/**
 * Group a lesson's activities into level sets, keyed by every member's id.
 *
 * Keyed by member id rather than by family id because the prose points at one
 * `::play{#id}`, and which of the three ids an author happened to write there
 * must not decide whether the learner gets a picker.
 *
 * A family whose members disagree about `kind` is not grouped. One engine has
 * to carry all three levels — that is what makes them the same activity — and
 * silently rendering a sort board as the "harder" version of a connect board
 * would be a worse answer than treating them as separate activities and
 * letting the content gate say so.
 */
export function groupActivityLevels(
  activities: readonly LearningActivitySpec[],
): ReadonlyMap<string, ActivityLevels> {
  const byFamily = new Map<string, LearningActivitySpec[]>();
  for (const activity of activities) {
    if (!activity.family) continue;
    const members = byFamily.get(activity.family) ?? [];
    members.push(activity);
    byFamily.set(activity.family, members);
  }

  const result = new Map<string, ActivityLevels>();
  for (const activity of activities) {
    result.set(activity.id, {
      id: activity.id,
      levels: { [activity.difficulty ?? "practice"]: activity },
    });
  }

  for (const [family, members] of byFamily) {
    if (members.length < 2) continue;
    const kind = members[0]!.kind;
    if (members.some((member) => member.kind !== kind)) continue;
    const levels: Partial<Record<ActivityDifficulty, LearningActivitySpec>> = {};
    for (const member of members) {
      const difficulty = member.difficulty ?? "practice";
      // First writer wins, so a duplicated level is stable rather than
      // depending on array order. The content gate is what reports it.
      levels[difficulty] ??= member;
    }
    const set: ActivityLevels = { id: family, levels };
    for (const member of members) result.set(member.id, set);
  }
  return result;
}
