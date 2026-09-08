import {
  ACTIVITY_DIFFICULTIES,
  type ActivityDifficulty,
  type ActivityFamily,
  type LearningActivitySpec,
} from "./types.js";

/** Select an explicit authored task. No numeric multiplier or level-dependent grading shortcut. */
export function selectActivityLevel(
  family: ActivityFamily,
  difficulty: ActivityDifficulty,
): LearningActivitySpec {
  const ids = new Set<string>();
  for (const level of ACTIVITY_DIFFICULTIES) {
    const task = family.levels[level];
    if (
      !task ||
      task.kind !== family.kind ||
      task.difficulty !== level ||
      !task.id ||
      ids.has(task.id)
    ) {
      throw new Error(`Invalid learning activity family: ${family.id} / ${level}`);
    }
    ids.add(task.id);
  }
  const selected = family.levels[difficulty];
  if (!selected) throw new Error(`Unknown activity difficulty: ${String(difficulty)}`);
  return selected;
}
