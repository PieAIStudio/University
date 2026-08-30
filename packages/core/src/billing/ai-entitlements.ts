import type { AiEntitlementConfig } from "./plans.js";

/**
 * The resolved AI switches shared by server handlers and learner controls.
 *
 * A disabled tutoring switch always resolves to zero turns. A numeric limit of
 * zero is disabled too; `null` means the enabled feature is metered by the
 * wallet rather than capped by a daily turn count.
 */
export interface AiEntitlementPolicy {
  readonly structuredGrading: boolean;
  readonly openTutoring: boolean;
  readonly openTutoringTurnsPerDay: number | null;
}

export function aiEntitlementPolicyOf(ai: AiEntitlementConfig): AiEntitlementPolicy {
  const turns = ai.openTutoring ? ai.openTutoringTurnsPerDay : 0;
  const tutoringEnabled =
    ai.openTutoring && (turns === null || (Number.isInteger(turns) && turns > 0));

  return {
    structuredGrading: ai.structuredGrading,
    openTutoring: tutoringEnabled,
    openTutoringTurnsPerDay: tutoringEnabled ? turns : 0,
  };
}
