/**
 * XP 曲线公式：`totalXpForLevel(n) = Math.round(35 * (n - 1) ** 2.2)`。
 * 选择理由：第一节课的读课文与首次答对练习合计应带来第一次升级。
 * 选择理由：全库首读与首次答对应落在较高等级，后续空间留给间隔复习。
 */

export interface Level {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly fraction: number;
  readonly totalXp: number;
}

export function totalXpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError("level must be a positive integer");
  }
  return Math.round(35 * (level - 1) ** 2.2);
}

function normalizedTotalXp(totalXp: number): number {
  if (!Number.isFinite(totalXp)) return 0;
  return Math.max(0, Math.floor(totalXp));
}

export function levelOf(totalXp: number): Level {
  const normalizedXp = normalizedTotalXp(totalXp);
  let lowerLevel = 1;
  let upperLevel = 2;

  while (totalXpForLevel(upperLevel) <= normalizedXp) {
    lowerLevel = upperLevel;
    upperLevel *= 2;
  }

  while (upperLevel - lowerLevel > 1) {
    const middleLevel = Math.floor((lowerLevel + upperLevel) / 2);
    if (totalXpForLevel(middleLevel) <= normalizedXp) {
      lowerLevel = middleLevel;
    } else {
      upperLevel = middleLevel;
    }
  }

  const currentLevelXp = totalXpForLevel(lowerLevel);
  const nextLevelXp = totalXpForLevel(lowerLevel + 1);
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const xpIntoLevel = normalizedXp - currentLevelXp;

  return {
    level: lowerLevel,
    xpIntoLevel,
    xpForNextLevel,
    fraction: Math.min(1, Math.max(0, xpIntoLevel / xpForNextLevel)),
    totalXp: normalizedXp,
  };
}
