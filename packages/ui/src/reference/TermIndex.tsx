import { useMemo, useState } from "react";
import { GameBadge, GameEmptyState, GameField, GameInput, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  createLexiconIndex,
  searchLexiconIndex,
  type LexiconEntry,
  type LexiconTrack,
} from "@pieai/university-core";

import { playSound } from "../sound/index.js";
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

function chipCount(id: TrackFilter, counts: Readonly<Record<TrackFilter, number>>): number {
  return counts[id];
}

/**
 * The term index: search, browse by track, open the existing reference panel.
 *
 * This is the surface a beginner needs before they have the word. The search
 * box, the category chips, the grouped hits and the empty-state manual are
 * one module because they answer one question: "how do I find a sense I
 * cannot name?" A second panel for the hit itself is forbidden — the lesson
 * reader already opens `ReferencePanel` for `[[term:]]`, and two drawers for
 * the same sense would be two implementations.
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
  const visibleTotal = track === "all" ? result.total : (counts[track] ?? 0);
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

  let body;
  if (visibleTotal === 0 && searched) {
    body = (
      <GameEmptyState
        title={`没有找到「${result.query}」相关的词义`}
        description="可以搜英文词、中文释义，或直接描述你想说的那句话。例如「应用」「接口」「点开图标就能用」。词库会按你的说法去找对应的术语，不必先知道它叫什么。"
      />
    );
  } else if (visibleTotal === 0) {
    body = <GameEmptyState title="还没有词义" description="词库载入后会出现在这里。" />;
  } else {
    body = (
      <div className="term-index__results">
        {groups.map((group) => (
          <section
            key={group.track}
            className="term-index__group"
            aria-label={TRACK_LABELS[group.track]}
          >
            <h3 className="term-index__group-title">
              {TRACK_LABELS[group.track]}
              <GameBadge>{group.count}</GameBadge>
            </h3>
            <ul className="term-index__list">
              {group.entries.map((item) => (
                <li key={item.senseId}>
                  <button
                    type="button"
                    className="term-index__hit"
                    onClick={(event) => openEntry(item, event.currentTarget)}
                  >
                    <span lang="en" className="term-index__headword">
                      {item.headword}
                    </span>
                    <span className="term-index__gloss">{item.gloss}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <GamePanel className="term-index" title="词义索引">
      <div className="term-index__search" role="search">
        <GameField label="搜索词义">
          <GameInput
            type="search"
            value={value}
            placeholder={LEXICON_SEARCH_PLACEHOLDER}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
        </GameField>
      </div>
      <div className="term-index__chips" role="radiogroup" aria-label="按类别筛选">
        {CHIP_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="term-index__chip"
            role="radio"
            aria-checked={track === id}
            onClick={() => setTrack(id)}
          >
            <span>{chipLabel(id)}</span>
            <GameBadge>{chipCount(id, counts)}</GameBadge>
          </button>
        ))}
      </div>
      {body}
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
    </GamePanel>
  );
}
