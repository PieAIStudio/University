import { GameEmptyState } from "@pieai/swimmer-ui-kit";

export const PLANS_EMPTY_TITLE = "订阅还没上线";
export const PLANS_EMPTY_DESCRIPTION = "现在全部内容都是完整的，不缺任何一节。";

export function PlansEmpty() {
  return (
    <GameEmptyState
      className="shell-empty"
      title={PLANS_EMPTY_TITLE}
      description={PLANS_EMPTY_DESCRIPTION}
    />
  );
}
