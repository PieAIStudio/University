/**
 * What every run shares, whatever the mechanic: hearts and a shield, score
 * and combo, the upgrades between rounds, and the log the review sheet is
 * made from. Pure functions on plain data (ADR-0011, rules layer).
 */
export const START_HEARTS = 3;
export const MAX_HEARTS = 5;

export type UpgradeId = "heart" | "slow" | "shield" | "bonus";

export interface RunState {
  hearts: number;
  shield: boolean;
  score: number;
  combo: number;
  best: number;
  /** Multiplies the next round's movers' speed; reset after that round. */
  slowNext: number;
  /** Multiplies the next round's first-try points; reset after that round. */
  bonusNext: number;
}

export function createRun(): RunState {
  return {
    hearts: START_HEARTS,
    shield: false,
    score: 0,
    combo: 0,
    best: 0,
    slowNext: 1,
    bonusNext: 1,
  };
}

/** Points for a first-try right answer: 100, up to double on a streak of five. */
export function rightPoints(run: RunState, bonus = 1): number {
  return Math.round(100 * (1 + Math.min(run.combo, 5) * 0.2) * bonus);
}
/** Put right after a mistake: the reason was shown, so it is worth less. */
export const CORRECTED_POINTS = 30;

export function scoreRight(run: RunState, bonus = 1): number {
  const points = rightPoints(run, bonus);
  run.score += points;
  run.combo += 1;
  run.best = Math.max(run.best, run.combo);
  return points;
}

export function scoreCorrected(run: RunState): number {
  run.score += CORRECTED_POINTS;
  return CORRECTED_POINTS;
}

/** A mistake or a miss. Returns whether the shield took it instead of a heart. */
export function loseHeart(run: RunState): "shield" | "heart" {
  run.combo = 0;
  if (run.shield) {
    run.shield = false;
    return "shield";
  }
  run.hearts = Math.max(0, run.hearts - 1);
  return "heart";
}

/**
 * Upgrades change the hands, never the judgment (ADR-0011 rule 3): nothing
 * here marks, reveals or removes an answer.
 */
export const UPGRADES: readonly UpgradeId[] = ["heart", "slow", "shield", "bonus"];

export function availableUpgrades(run: RunState): UpgradeId[] {
  return UPGRADES.filter(
    (id) => (id !== "heart" || run.hearts < MAX_HEARTS) && (id !== "shield" || !run.shield),
  );
}

export function applyUpgrade(run: RunState, id: UpgradeId): void {
  if (id === "heart") run.hearts = Math.min(MAX_HEARTS, run.hearts + 1);
  if (id === "slow") run.slowNext = 0.75;
  if (id === "shield") run.shield = true;
  if (id === "bonus") run.bonusNext = 1.5;
}

/** Called when a round finishes: one-round upgrades are spent. */
export function endRound(run: RunState): void {
  run.slowNext = 1;
  run.bonusNext = 1;
}

export type ItemOutcome = "first" | "corrected" | "missed";

export interface LogEntry {
  readonly itemId: string;
  readonly roundId: string;
  outcome: ItemOutcome;
}

/**
 * Record an item's result. Within its round the first encounter decides, and a
 * later success only lifts "missed" to "corrected" — never to "first". A review
 * round's result replaces the earlier one: it is the latest evidence.
 */
export function logOutcome(
  log: LogEntry[],
  roundId: string,
  itemId: string,
  outcome: ItemOutcome,
  replace = false,
): void {
  const entry = log.find((e) => e.itemId === itemId && e.roundId === roundId);
  if (!entry) {
    log.push({ itemId, roundId, outcome });
    return;
  }
  if (replace) entry.outcome = outcome;
  else if (entry.outcome === "missed" && outcome !== "missed") entry.outcome = "corrected";
}
