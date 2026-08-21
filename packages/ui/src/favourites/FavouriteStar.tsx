import { playSound } from "../sound/index.js";
import { favouriteStarLabel, shouldPlayFavouriteSound } from "./favourite-star.js";

/**
 * The star on a term card and on a term page. One control, because B4 and C2
 * are the same fact about the same sense — two buttons that disagreed would
 * be two lists.
 *
 * A real `<button>` so it is in the tab order, presses with Space/Enter, and
 * carries `aria-pressed` rather than a CSS class pretending to be state.
 */
export function FavouriteStar({
  senseId,
  pressed,
  headword,
  onToggle,
  className,
}: {
  readonly senseId: string;
  readonly pressed: boolean;
  readonly headword?: string;
  readonly onToggle: (senseId: string) => void;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `favourite-star ${className}` : "favourite-star"}
      aria-pressed={pressed}
      aria-label={favouriteStarLabel(pressed, headword)}
      onClick={() => {
        if (shouldPlayFavouriteSound(!pressed)) playSound("word.staged");
        onToggle(senseId);
      }}
    >
      <span aria-hidden="true">★</span>
    </button>
  );
}
