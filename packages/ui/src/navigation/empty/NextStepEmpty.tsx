import { GameEmptyState } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../../cta/LiquidCtaButton.js";

/**
 * Shared next-step empty for slots one shell has and the other does not yet.
 * The shell owns the route; this component only emits the action it is given.
 */
export function NextStepEmpty({
  title,
  description,
  action = "回到学习",
  onNavigate,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: string;
  readonly onNavigate?: () => void;
}) {
  return (
    <GameEmptyState
      className="shell-empty"
      title={title}
      description={description}
      action={
        onNavigate ? (
          <LiquidCtaButton type="button" onClick={onNavigate}>
            {action}
          </LiquidCtaButton>
        ) : undefined
      }
    />
  );
}
