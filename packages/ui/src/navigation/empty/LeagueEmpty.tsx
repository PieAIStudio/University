import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";

export const LEAGUE_EMPTY_TITLE = "排行榜还没开";
export const LEAGUE_EMPTY_DESCRIPTION = "等账号上线，你现在学的每一节都会算数。";
export const LEAGUE_EMPTY_ACTION = "继续学习";

export function LeagueEmpty() {
  return (
    <GameEmptyState
      className="shell-empty"
      title={LEAGUE_EMPTY_TITLE}
      description={LEAGUE_EMPTY_DESCRIPTION}
      action={
        <GameButton variant="primary" type="button" onClick={() => (window.location.hash = "#/")}>
          {LEAGUE_EMPTY_ACTION}
        </GameButton>
      }
    />
  );
}
