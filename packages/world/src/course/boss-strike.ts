import { useCallback, useEffect, useRef, useState } from "react";

import type { MonsterReactionPhase } from "./MonsterField.js";
import type { ThrowEvent } from "./StarThrow.js";

/**
 * One answer in the weekly boss's fight, as the island plays it (PLAN-V7-07
 * §2a): a right answer throws a star and the boss ducks; a wrong one and it
 * shakes its head at you; the last heart takes three stars, and it runs.
 */
export interface BossStrike {
  /** New for every answer, so two hits in a row are two throws. */
  readonly id: number;
  readonly kind: "hit" | "miss" | "final";
  /** After the final strike, once the boss has run out of sight. */
  readonly onGone?: () => void;
}

/** What the course scene is told about this week's boss (Maps.tsx `weeklyBoss`). */
export interface WeeklyBossScene {
  /** Its Monday; `dev` for the `?v7weekly` preview. */
  readonly week: string;
  /** The fight is open: the camera closes in on the learner and the boss. */
  readonly fighting?: boolean;
  readonly strike?: BossStrike | null;
  /** It has run: its chest stands where it stood. */
  readonly fled?: boolean;
}

/** Seconds the boss ducks after a star, and shakes its head after a miss, before idling again. */
const HIT_HOLD = 0.7;
const MISS_HOLD = 1.1;
/** After the last of the final three stars lands, before it turns and runs. */
const FLEE_AFTER = 0.5;

/**
 * Sequences the boss's reaction to each strike; the course scene renders the
 * star and the monster. The chest's own star throw lives in chest-sequence.ts:
 * that one chases a guard off a stone, this one wears a boss down heart by heart.
 */
export function useBossStrike(strike: BossStrike | null) {
  const [phase, setPhase] = useState<MonsterReactionPhase | null>(null);
  const timers = useRef<number[]>([]);
  const kind = useRef(strike?.kind ?? null);
  kind.current = strike?.kind ?? null;
  const later = (seconds: number, next: MonsterReactionPhase | null) => {
    timers.current.push(window.setTimeout(() => setPhase(next), seconds * 1000));
  };
  useEffect(() => {
    setPhase(strike?.kind === "miss" ? "brace" : null);
    if (strike?.kind === "miss") later(MISS_HOLD, null);
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    };
  }, [strike?.id]);

  const onThrow = useCallback((event: ThrowEvent) => {
    if (event.kind !== "impact" || !event.last) return;
    setPhase("hit");
    if (kind.current === "final") later(FLEE_AFTER, "flee");
    else later(HIT_HOLD, null);
  }, []);

  return {
    /** The star to throw now, or null on a miss: stars for the last heart, one for any other. */
    throwing:
      strike && strike.kind !== "miss"
        ? { key: strike.id, stars: strike.kind === "final" ? 3 : 1 }
        : null,
    phase,
    onThrow,
  };
}
