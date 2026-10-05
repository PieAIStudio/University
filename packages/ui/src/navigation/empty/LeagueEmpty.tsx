import { interfaceTranslator } from "../../i18n/index.js";
import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";

export const LEAGUE_EMPTY_TITLE = interfaceTranslator.t(
  "ui.navigation.empty.leagueEmpty.copy.排行榜还没开",
);
export const LEAGUE_EMPTY_DESCRIPTION = interfaceTranslator.t(
  "ui.navigation.empty.leagueEmpty.copy.你的进度已经在记录-等有了可比较的同学-排行榜就会开",
);
export const LEAGUE_EMPTY_ACTION = interfaceTranslator.t(
  "ui.navigation.empty.leagueEmpty.copy.继续学习",
);

export function LeagueEmpty({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <GameEmptyState
      className="shell-empty"
      title={LEAGUE_EMPTY_TITLE}
      description={LEAGUE_EMPTY_DESCRIPTION}
      action={
        onNavigate ? (
          <GameButton
            variant="primary"
            className="university-cta"
            type="button"
            onClick={onNavigate}
          >
            {LEAGUE_EMPTY_ACTION}
          </GameButton>
        ) : undefined
      }
    />
  );
}
