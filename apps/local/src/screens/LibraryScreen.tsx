import { useState } from "react";
import {
  ANTI_PATTERN_ENTRIES,
  CONCEPT_ENTRIES,
  antiPatternHeadToMarkdown,
  assembleTermEntry,
  conceptHeadToMarkdown,
  conceptNeighbours,
  getAntiPatternEntry,
  getConceptEntry,
  hasFavourite,
  toggleFavourite,
  termHeadToMarkdown,
  type AntiPatternEntry,
  type ConceptEntry,
  type LexiconEntry,
} from "@pieai/university-core";
import { EntryPage, FavouriteStar, LibrarySurface, type ReferenceTab } from "@pieai/university-ui";
import { createProgressFavouritesStore } from "@pieai/university-ui";

import lexiconFile from "../../data/vocabulary/en.json";
import { progressPort } from "../progress/store.js";

const LEXICON = lexiconFile.entries as readonly LexiconEntry[];
const LEXICON_BY_SENSE = new Map(LEXICON.map((entry) => [entry.senseId, entry]));
const FAVOURITES_STORE = createProgressFavouritesStore(progressPort);

type OpenEntry =
  | { readonly kind: "concept"; readonly id: string }
  | { readonly kind: "term"; readonly senseId: string }
  | { readonly kind: "anti-pattern"; readonly id: string };

function conceptOrTerm(id: string): OpenEntry {
  return getConceptEntry(id) ? { kind: "concept", id } : { kind: "term", senseId: id };
}

function ConceptEntryView({
  entry,
  onBack,
  onOpen,
}: {
  readonly entry: ConceptEntry;
  readonly onBack: () => void;
  readonly onOpen: (entry: OpenEntry) => void;
}) {
  const { previous, next } = conceptNeighbours(entry.head.id);
  return (
    <div className="terms">
      <button className="linkish" type="button" onClick={onBack}>
        ← 概念图解
      </button>
      <EntryPage
        breadcrumb={[{ label: "概念图解" }, { label: entry.head.group }, { label: entry.head.zh }]}
        head={
          <>
            <h1>
              {entry.head.zh}
              {entry.head.en ? (
                <span className="reference-panel__pos" lang="en">
                  {entry.head.en}
                </span>
              ) : null}
            </h1>
            <p className="reference-panel__gloss">{entry.head.tagline}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={conceptHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        resolveSense={(id) => {
          const target = getConceptEntry(id);
          return target ? { title: target.head.zh, subtitle: target.head.tagline } : undefined;
        }}
        onOpenSense={(id) => onOpen(conceptOrTerm(id))}
        neighbours={{
          previous: previous
            ? {
                label: previous.head.zh,
                onOpen: () => onOpen({ kind: "concept", id: previous.head.id }),
              }
            : null,
          next: next
            ? { label: next.head.zh, onOpen: () => onOpen({ kind: "concept", id: next.head.id }) }
            : null,
        }}
      />
    </div>
  );
}

function TermEntryView({
  entry,
  onBack,
  onOpen,
}: {
  readonly entry: LexiconEntry;
  readonly onBack: () => void;
  readonly onOpen: (entry: OpenEntry) => void;
}) {
  const [favourites, setFavourites] = useState(() => FAVOURITES_STORE.read());
  const assembled = assembleTermEntry(entry, []);
  return (
    <div className="terms">
      <button className="linkish" type="button" onClick={onBack}>
        ← 词义索引
      </button>
      <EntryPage
        breadcrumb={[{ label: "词义索引" }, { label: entry.headword }]}
        head={
          <>
            <h1 lang="en">
              {entry.headword}
              <FavouriteStar
                senseId={entry.senseId}
                headword={entry.headword}
                pressed={hasFavourite(favourites, entry.senseId)}
                onToggle={(senseId) => {
                  const next = toggleFavourite(
                    favourites,
                    senseId,
                    new Set(LEXICON.map((candidate) => candidate.senseId)),
                    new Date().toISOString(),
                  );
                  FAVOURITES_STORE.write(next);
                  setFavourites(next);
                }}
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
        onOpenSense={(senseId) => onOpen({ kind: "term", senseId })}
      />
    </div>
  );
}

function AntiPatternEntryView({
  entry,
  onBack,
  onOpen,
}: {
  readonly entry: AntiPatternEntry;
  readonly onBack: () => void;
  readonly onOpen: (entry: OpenEntry) => void;
}) {
  return (
    <div className="terms">
      <button className="linkish" type="button" onClick={onBack}>
        ← 防 AI 味儿
      </button>
      <EntryPage
        breadcrumb={[{ label: "防 AI 味儿" }, { label: entry.head.name }]}
        head={
          <>
            <h1>{entry.head.name}</h1>
            <p className="reference-panel__gloss">{entry.head.complaint}</p>
          </>
        }
        sections={entry.sections}
        headMarkdown={antiPatternHeadToMarkdown(entry.head)}
        lexicon={LEXICON_BY_SENSE}
        onOpenSense={(senseId) => onOpen({ kind: "term", senseId })}
      />
    </div>
  );
}

export function LibraryScreen({
  onBack,
  initialTab = "concepts",
}: {
  readonly onBack: () => void;
  readonly initialTab?: ReferenceTab;
}) {
  const [tab, setTab] = useState<ReferenceTab>(initialTab);
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);

  if (openEntry?.kind === "concept") {
    const entry = getConceptEntry(openEntry.id);
    if (entry) {
      return (
        <ConceptEntryView entry={entry} onBack={() => setOpenEntry(null)} onOpen={setOpenEntry} />
      );
    }
  }
  if (openEntry?.kind === "term") {
    const entry = LEXICON_BY_SENSE.get(openEntry.senseId);
    if (entry) {
      return (
        <TermEntryView entry={entry} onBack={() => setOpenEntry(null)} onOpen={setOpenEntry} />
      );
    }
  }
  if (openEntry?.kind === "anti-pattern") {
    const entry = getAntiPatternEntry(openEntry.id);
    if (entry) {
      return (
        <AntiPatternEntryView
          entry={entry}
          onBack={() => setOpenEntry(null)}
          onOpen={setOpenEntry}
        />
      );
    }
  }

  return (
    <LibrarySurface
      activeTab={tab}
      concepts={CONCEPT_ENTRIES}
      terms={LEXICON}
      antiPatterns={ANTI_PATTERN_ENTRIES}
      favourites={FAVOURITES_STORE}
      onBack={onBack}
      onTabChange={(next) => {
        setOpenEntry(null);
        setTab(next);
      }}
      onOpenConcept={(entry) => setOpenEntry({ kind: "concept", id: entry.head.id })}
      onOpenTerm={(entry) => setOpenEntry({ kind: "term", senseId: entry.senseId })}
      onOpenAntiPattern={(entry) => setOpenEntry({ kind: "anti-pattern", id: entry.head.id })}
    />
  );
}
