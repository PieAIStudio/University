import { GameEmptyState } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../../cta/LiquidCtaButton.js";

export const QUESTS_EMPTY_TITLE = "任务还没开张";
export const QUESTS_EMPTY_DESCRIPTION =
  "日、周、月三层任务会长在这里。今天该做的那一件事，在学习页上等着。";
export const QUESTS_EMPTY_ACTION = "回到学习";

export function QuestsEmpty({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <GameEmptyState
      className="shell-empty"
      title={QUESTS_EMPTY_TITLE}
      description={QUESTS_EMPTY_DESCRIPTION}
      action={
        onNavigate ? (
          <LiquidCtaButton type="button" onClick={onNavigate}>
            {QUESTS_EMPTY_ACTION}
          </LiquidCtaButton>
        ) : undefined
      }
    />
  );
}
