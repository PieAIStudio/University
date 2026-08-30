import { GameEmptyState } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../../cta/LiquidCtaButton.js";

export const LEAGUE_EMPTY_TITLE = "排行榜还没开";
export const LEAGUE_EMPTY_DESCRIPTION = "你的进度已经在记录；等有了可比较的同学，排行榜就会开。";
export const LEAGUE_EMPTY_ACTION = "继续学习";

export function LeagueEmpty({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <GameEmptyState
      className="shell-empty"
      title={LEAGUE_EMPTY_TITLE}
      description={LEAGUE_EMPTY_DESCRIPTION}
      action={
        onNavigate ? (
          <LiquidCtaButton type="button" onClick={onNavigate}>
            {LEAGUE_EMPTY_ACTION}
          </LiquidCtaButton>
        ) : undefined
      }
    />
  );
}
