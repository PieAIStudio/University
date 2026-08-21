import { useMemo, useState } from "react";
import {
  createLexiconIndex,
  searchLexiconIndex,
  type LexiconEntry,
  type LexiconTrack,
} from "@pieai/university-core";

import { playSound } from "../sound/index.js";
import { CollectionIndex } from "./CollectionIndex.js";
import { ReferencePanel, TermReferenceBody } from "./ReferencePanel.js";

/**
 * The placeholder is the teaching, the way VibeHub's is. These examples come
 * from this product's own lexicon — an English-shaped Chinese name, another,
 * then a description of the thing — so a beginner who does not have the word
 * still has a way in. Do not replace them with frontend-widget queries; that
 * is someone else's dictionary.
 */
export const LEXICON_SEARCH_PLACEHOLDER = "试试「应用」「接口」「点开图标就能用」";

const TRACK_LABELS: Readonly<Record<LexiconTrack, string>> = {
  technical: "技术用语",
  general: "通用英语",
};

type TrackFilter = "all" | LexiconTrack;

const CHIP_ORDER: readonly TrackFilter[] = ["all", "technical", "general"];

function chipLabel(id: TrackFilter): string {
  return id === "all" ? "全部" : TRACK_LABELS[id];
}

/**
 * The term index: search, browse by track, open the existing reference panel.
 *
 * The chips, the search box and the grouped hits live on `CollectionIndex`
 * because the anti-pattern catalogue is the same surface pointed at a
 * different collection. This file keeps the lexicon search and the panel —
 * the things that are actually about 词义.
 */
export function TermIndex({
  entries,
  query,
  onQueryChange,
  onOpenFull,
}: {
  readonly entries: readonly LexiconEntry[];
  /** Controlled query, so a shell can later bind `?q=` without a second box. */
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly onOpenFull?: (entry: LexiconEntry) => void;
}) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState("");
  const [track, setTrack] = useState<TrackFilter>("all");
  const [open, setOpen] = useState<{
    readonly entry: LexiconEntry;
    readonly trigger: HTMLElement;
  } | null>(null);

  const value = query ?? uncontrolledQuery;
  const index = useMemo(() => createLexiconIndex(entries), [entries]);
  const result = useMemo(() => searchLexiconIndex(index, value), [index, value]);

  const counts: Readonly<Record<TrackFilter, number>> = {
    all: result.total,
    technical: result.groups.find((group) => group.track === "technical")?.count ?? 0,
    general: result.groups.find((group) => group.track === "general")?.count ?? 0,
  };

  const groups =
    track === "all" ? result.groups : result.groups.filter((group) => group.track === track);
  const searched = result.query !== "";

  function setQuery(next: string) {
    if (query === undefined) setUncontrolledQuery(next);
    onQueryChange?.(next);
  }

  function openEntry(entry: LexiconEntry, trigger: HTMLElement) {
    setOpen((current) => {
      if (current && current.entry.senseId === entry.senseId && current.trigger === trigger) {
        return null;
      }
      playSound("panel.open");
      return { entry, trigger };
    });
  }

  const byId = useMemo(
    () => new Map(entries.map((entry) => [entry.senseId, entry] as const)),
    [entries],
  );

  return (
    <CollectionIndex
      title="词义索引"
      searchLabel="搜索词义"
      placeholder={LEXICON_SEARCH_PLACEHOLDER}
      query={value}
      onQueryChange={setQuery}
      chips={CHIP_ORDER.map((id) => ({ id, label: chipLabel(id), count: counts[id] }))}
      selectedChipId={track}
      onSelectChip={(id) => setTrack(id as TrackFilter)}
      groups={groups.map((group) => ({
        id: group.track,
        label: TRACK_LABELS[group.track],
        count: group.count,
        items: group.entries.map((item) => ({
          id: item.senseId,
          title: item.headword,
          subtitle: item.gloss,
          titleLang: "en",
        })),
      }))}
      searched={searched}
      emptyMiss={{
        title: `没有找到「${result.query}」相关的词义`,
        description:
          "可以搜英文词、中文释义，或直接描述你想说的那句话。例如「应用」「接口」「点开图标就能用」。词库会按你的说法去找对应的术语，不必先知道它叫什么。",
      }}
      emptyIdle={{ title: "还没有词义", description: "词库载入后会出现在这里。" }}
      onOpenHit={(id, trigger) => {
        const entry = byId.get(id);
        if (entry) openEntry(entry, trigger);
      }}
    >
      <ReferencePanel
        open={open !== null}
        title={open?.entry.headword ?? "词义"}
        kind="term"
        trigger={open?.trigger ?? null}
        onClose={() => setOpen(null)}
        {...(open && onOpenFull
          ? {
              onOpenFull: () => {
                const entry = open.entry;
                setOpen(null);
                onOpenFull(entry);
              },
            }
          : {})}
      >
        <TermReferenceBody entry={open?.entry ?? null} />
      </ReferencePanel>
    </CollectionIndex>
  );
}
