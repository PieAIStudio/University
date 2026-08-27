import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";

/** Shared next-step empty for slots one shell has and the other does not yet. */
export function NextStepEmpty({
  title,
  description,
  action = "回到学习",
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: string;
}) {
  return (
    <GameEmptyState
      className="shell-empty"
      title={title}
      description={description}
      action={
        <GameButton variant="primary" type="button" onClick={() => window.location.assign("/")}>
          {action}
        </GameButton>
      }
    />
  );
}
