import { useMemo, useState } from "react";
import { GameCallout } from "@pieai/swimmer-ui-kit";
import {
  ANTI_PATTERN_CATEGORY_IDS,
  ANTI_PATTERN_CATEGORY_LABEL,
  ANTI_PATTERN_NOTICE,
  ANTI_PATTERN_NOTICE_HEADING,
  createAntiPatternIndex,
  searchAntiPatternIndex,
  type AntiPatternCategory,
  type AntiPatternEntry,
} from "@pieai/university-core";

import { COLLECTION_LABEL } from "../entry/EntryPage.js";
import { CollectionIndex } from "./CollectionIndex.js";

/**
 * Teaching placeholder, same job as the lexicon one: a name, a layout
 * complaint, a spoken fragment, so you can find an entry before you have
 * its official title.
 */
export const ANTI_PATTERN_SEARCH_PLACEHOLDER = "试试「稳稳接住」「别再说灯塔」";

type CategoryFilter = "all" | AntiPatternCategory;

const CHIP_ORDER: readonly CategoryFilter[] = ["all", ...ANTI_PATTERN_CATEGORY_IDS];

function chipLabel(id: CategoryFilter): string {
  return id === "all" ? "全部" : ANTI_PATTERN_CATEGORY_LABEL[id];
}

/**
 * F1 + F2. The term index pointed at anti-patterns, with the epistemic notice
 * in the header so a reader cannot browse the list as a lie detector.
 *
 * Clicking a hit calls `onOpen` — the shell owns the route, the way TermIndex
 * does not invent `#/terms/:id`. There is no second detail page in here.
 */
export function AntiPatternIndex({
  entries,
  query,
  onQueryChange,
  onOpen,
}: {
  readonly entries: readonly AntiPatternEntry[];
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly onOpen?: (entry: AntiPatternEntry) => void;
}) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const value = query ?? uncontrolledQuery;
  const index = useMemo(() => createAntiPatternIndex(entries), [entries]);
  const result = useMemo(() => searchAntiPatternIndex(index, value), [index, value]);

  const counts: Readonly<Record<CategoryFilter, number>> = {
    all: result.total,
    verbal: result.groups.find((group) => group.category === "verbal")?.count ?? 0,
    template: result.groups.find((group) => group.category === "template")?.count ?? 0,
    interaction: result.groups.find((group) => group.category === "interaction")?.count ?? 0,
  };

  const groups =
    category === "all"
      ? result.groups
      : result.groups.filter((group) => group.category === category);
  const searched = result.query !== "";

  function setQuery(next: string) {
    if (query === undefined) setUncontrolledQuery(next);
    onQueryChange?.(next);
  }

  const byId = useMemo(
    () => new Map(entries.map((entry) => [entry.head.id, entry] as const)),
    [entries],
  );

  return (
    <CollectionIndex
      title={COLLECTION_LABEL["anti-patterns"]}
      header={
        <GameCallout heading={ANTI_PATTERN_NOTICE_HEADING} tone="warning" role="note">
          {ANTI_PATTERN_NOTICE}
        </GameCallout>
      }
      searchLabel="搜索反模式"
      placeholder={ANTI_PATTERN_SEARCH_PLACEHOLDER}
      query={value}
      onQueryChange={setQuery}
      chips={CHIP_ORDER.map((id) => ({ id, label: chipLabel(id), count: counts[id] }))}
      selectedChipId={category}
      onSelectChip={(id) => setCategory(id as CategoryFilter)}
      groups={groups.map((group) => ({
        id: group.category,
        label: ANTI_PATTERN_CATEGORY_LABEL[group.category],
        count: group.count,
        items: group.entries.map((item) => ({
          id: item.head.id,
          title: item.head.name,
          subtitle: item.head.complaint,
        })),
      }))}
      searched={searched}
      emptyMiss={{
        title: `没有找到「${result.query}」相关的条目`,
        description:
          "可以搜条目的名字、那句口语抱怨，或直接描述你看见的不对劲。例如「稳稳接住」「三张一样大」「点了没反应」。不必先知道它在目录里叫什么。",
      }}
      emptyIdle={{ title: "还没有条目", description: "目录载入后会出现在这里。" }}
      onOpenHit={(id) => {
        const entry = byId.get(id);
        if (entry) onOpen?.(entry);
      }}
    />
  );
}
