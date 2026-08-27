import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";

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
          <GameButton variant="primary" type="button" onClick={onNavigate}>
            {action}
          </GameButton>
        ) : undefined
      }
    />
  );
}
