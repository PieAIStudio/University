import { useCallback, useEffect, useState } from "react";
import {
  hasFavourite,
  listGroupedByTrack,
  toggleFavourite,
  type LexiconEntry,
} from "@pieai/university-core";

import { FavouriteStar } from "./FavouriteStar.js";
import { FavouritesEmpty } from "./FavouritesEmpty.js";
import type { FavouritesStore } from "./storage.js";

/** The richer shortlist screen shared by the delivery and authoring shells. */
export function FavouritesScreen({
  entries,
  store,
  onOpen,
  onBrowse,
}: {
  readonly entries: readonly LexiconEntry[];
  readonly store: FavouritesStore;
  readonly onOpen?: (senseId: string) => void;
  readonly onBrowse?: () => void;
}) {
  const [state, setState] = useState(() => store.read());
  useEffect(() => store.subscribe?.(() => setState(store.read())), [store]);
  const toggle = useCallback(
    (senseId: string) => {
      setState((current) => {
        const next = toggleFavourite(
          current,
          senseId,
          new Set(entries.map((entry) => entry.senseId)),
          new Date().toISOString(),
        );
        store.write(next);
        return next;
      });
    },
    [entries, store],
  );
  const groups = listGroupedByTrack(state, entries);
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  if (total === 0) return <FavouritesEmpty onBrowse={onBrowse} />;
  return (
    <div>
      <h1>收藏</h1>
      {groups.map((group) => (
        <section key={group.track}>
          <h2>
            {group.track} <span className="term-index__count">{group.entries.length}</span>
          </h2>
          <ul className="term-index__list">
            {group.entries.map((entry) => (
              <li key={entry.senseId}>
                {onOpen ? (
                  <button className="term-index__hit" onClick={() => onOpen(entry.senseId)}>
                    <span lang="en">{entry.headword}</span>
                    <span>{entry.gloss}</span>
                  </button>
                ) : (
                  <div className="term-index__hit">
                    <span lang="en">{entry.headword}</span>
                    <span>{entry.gloss}</span>
                  </div>
                )}
                <FavouriteStar
                  senseId={entry.senseId}
                  headword={entry.headword}
                  pressed={hasFavourite(state, entry.senseId)}
                  onToggle={toggle}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
