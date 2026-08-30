import { GameEmptyState } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../cta/LiquidCtaButton.js";

/**
 * VibeHub's empty title, kept because it is already the whole sentence.
 * The description and the action are this product's: we collect 词义, not
 * a generic 术语, and the way in is the index that already exists.
 */
export const FAVOURITES_EMPTY_TITLE = "还没有收藏术语";

export const FAVOURITES_EMPTY_DESCRIPTION =
  "在词义上点一下星标，把你会反复翻到的留下来。收藏是你自己的一张小词表，跟课程进度不是一回事。";

export const FAVOURITES_EMPTY_ACTION = "浏览词义";

/**
 * The favourites view when the list is still empty.
 *
 * The shell wires `onBrowse` to the term index. This component does not know
 * the route, because the two shells will not share one, and inventing a
 * default would be a third copy of how you get to the words.
 */
export function FavouritesEmpty({
  onBrowse,
  className,
}: {
  readonly onBrowse?: () => void;
  readonly className?: string;
}) {
  return (
    <GameEmptyState
      className={className}
      title={FAVOURITES_EMPTY_TITLE}
      description={FAVOURITES_EMPTY_DESCRIPTION}
      action={
        onBrowse ? (
          <LiquidCtaButton type="button" onClick={onBrowse}>
            {FAVOURITES_EMPTY_ACTION}
          </LiquidCtaButton>
        ) : undefined
      }
    />
  );
}
