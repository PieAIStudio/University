import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";

export const PLANS_EMPTY_TITLE = "订阅还没上线";

/**
 * This page must not describe what the free product currently includes.
 *
 * It used to say 「现在全部内容都是完整的，不缺任何一节」. True, and the most
 * expensive true sentence on the site: it teaches a visitor that the whole
 * catalogue is already theirs. Whatever the paid tier turns out to be, they
 * will read it against that promise — and a thing you were told you had, then
 * have to pay for, is a loss, which people feel about twice as hard as the
 * equivalent gain. The sentence cost nothing to write and would have been paid
 * for on the day pricing shipped.
 *
 * So it makes no claim about inclusion at all. It says what this page will do
 * when it has something to say, and sends the visitor back to the one thing
 * that is actually ready.
 */
export const PLANS_EMPTY_DESCRIPTION =
  "上线时这里会写清楚每一档是什么、多少钱。在那之前，先学一节。";
export const PLANS_EMPTY_ACTION = "继续学习";

export function PlansEmpty() {
  return (
    <GameEmptyState
      className="shell-empty"
      title={PLANS_EMPTY_TITLE}
      description={PLANS_EMPTY_DESCRIPTION}
      action={
        <GameButton variant="primary" type="button" onClick={() => (window.location.hash = "#/")}>
          {PLANS_EMPTY_ACTION}
        </GameButton>
      }
    />
  );
}
