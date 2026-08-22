import { listGroupedByTrack } from "@pieai/university-core";
import { FavouriteStar, FavouritesEmpty } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";
import type { View } from "../url-state";
import { useFavourites } from "./favourites";

/** The learner's shortlist, grouped the same way the index groups. */
export function FavouritesHost({ onOpen }: { onOpen: (view: View) => void }) {
  const { state, toggle } = useFavourites();
  const groups = listGroupedByTrack(state, LEXICON);
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <>
      <h1>收藏</h1>
      {total === 0 ? (
        <FavouritesEmpty onBrowse={() => onOpen({ kind: "library", tab: "terms" })} />
      ) : (
        groups.map((group) => (
          <section key={group.track}>
            <h2>
              {group.track} <span className="term-index__count">{group.entries.length}</span>
            </h2>
            <ul className="term-index__list">
              {group.entries.map((entry) => (
                <li key={entry.senseId}>
                  <button
                    className="term-index__hit"
                    onClick={() => onOpen({ kind: "term", senseId: entry.senseId })}
                  >
                    <span lang="en">{entry.headword}</span>
                    <span>{entry.gloss}</span>
                  </button>
                  <FavouriteStar
                    senseId={entry.senseId}
                    headword={entry.headword}
                    pressed
                    onToggle={toggle}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
