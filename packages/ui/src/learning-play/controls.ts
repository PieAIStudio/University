import type { LearningActivitySpec } from "@pieai/university-core";

/** A mode reports observed evidence; only the shared host emits completion. */
export interface ActivityControls<T extends LearningActivitySpec> {
  readonly activity: T;
  readonly disabled: boolean;
  /** Guidance changes presentation only; free exploration preserves all game state. */
  readonly guided?: boolean;
  readonly onAttempt: (
    passed: boolean,
    evidence: Readonly<Record<string, unknown>>,
    message: string,
  ) => void;
}
