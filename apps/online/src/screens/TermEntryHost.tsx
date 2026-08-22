import { assembleTermEntry, hasFavourite, termHeadToMarkdown } from "@pieai/university-core";
import { EntryPage, FavouriteStar } from "@pieai/university-ui";

import { LEXICON } from "../lesson/language";
import type { View } from "../url-state";
import { useFavourites } from "./favourites";
import { LEXICON_BY_SENSE } from "./lexicon-by-sense";

/**
 * One term's full entry.
 *
 * No term carries sections yet, so today this renders the head and nothing
 * else — which is the case SPEC-0004 insisted stay valid, because it is what
 * lets all 267 existing entries keep working on the day the registry lands.
 * A term that gains sections starts showing them here with no change to this
 * file.
 */
export function TermEntryHost({
  senseId,
  onOpen,
}: {
  senseId: string;
  onOpen: (view: View) => void;
}) {
  const { state: favouriteState, toggle: toggleFavouriteFor } = useFavourites();
  const entry = LEXICON.find((item) => item.senseId === senseId);
  if (!entry) {
    return (
      <main className="terms">
        <button className="linkish" onClick={() => onOpen({ kind: "terms" })}>
          ← 词义索引
        </button>
        <p className="reference-panel__note">词库里没有这个词义。</p>
      </main>
    );
  }
  const assembled = assembleTermEntry(entry, []);
  return (
    <main className="terms">
      <EntryPage
        breadcrumb={[{ label: "词义索引", href: "#/terms" }, { label: entry.headword }]}
        head={
          <>
            <h1 lang="en">
              {entry.headword}
              <FavouriteStar
                senseId={entry.senseId}
                headword={entry.headword}
                pressed={hasFavourite(favouriteState, entry.senseId)}
                onToggle={toggleFavouriteFor}
              />
            </h1>
            <p className="reference-panel__meta">
              <span className="reference-panel__phonetic">{entry.phonetic}</span>
              <span className="reference-panel__pos">{entry.partOfSpeech}</span>
            </p>
            <p className="reference-panel__gloss">{entry.gloss}</p>
            <p className="reference-panel__usage">{entry.usage}</p>
          </>
        }
        sections={assembled.entry.sections}
        headMarkdown={termHeadToMarkdown(entry)}
        lexicon={LEXICON_BY_SENSE}
        onOpenSense={(id) => onOpen({ kind: "term", senseId: id })}
      />
    </main>
  );
}
