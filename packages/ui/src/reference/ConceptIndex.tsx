import { translate } from "../i18n/index.js";
import { useMemo, useState } from "react";
import {
  CONCEPT_CATEGORY_IDS,
  CONCEPT_CATEGORY_LABEL,
  createConceptIndex,
  searchConceptIndex,
  type ConceptCategory,
  type ConceptEntry,
} from "@pieai/university-core";

import { COLLECTION_LABEL } from "../entry/EntryPage.js";
import { CollectionIndex } from "./CollectionIndex.js";

/**
 * Teaching placeholder, the same job the other two indexes give theirs: show
 * that you may arrive with a symptom rather than a name.
 *
 * Two examples, not three, and that is a measurement rather than taste — see
 * `SEARCH_PLACEHOLDER_MAX_CHARS`. A third example clipped mid-character taught
 * nothing and made the field look broken.
 */
export const CONCEPT_SEARCH_PLACEHOLDER = translate(
  "ui.reference.conceptIndex.copy.试试-点了没反应-怎么退回上一版",
);

type CategoryFilter = "all" | ConceptCategory;

const CHIP_ORDER: readonly CategoryFilter[] = ["all", ...CONCEPT_CATEGORY_IDS];

function chipLabel(id: CategoryFilter): string {
  return id === "all"
    ? translate("ui.reference.conceptIndex.copy.全部")
    : CONCEPT_CATEGORY_LABEL[id];
}

/**
 * The 281-entry catalogue: seven category chips, sub-category groups, one
 * shared index shell.
 *
 * The 「全部」 chip is an addition rather than a copy. On the site this came
 * from you must pick a category first, which assumes you can guess whether
 * 「回滚」 lives under 后端 or Git — and someone who could guess that mostly
 * does not need the entry. Searching everything and *then* seeing which chip
 * lit up teaches the category as a side effect of finding the word.
 */
export function ConceptIndex({
  entries,
  query,
  onQueryChange,
  onOpen,
}: {
  readonly entries: readonly ConceptEntry[];
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly onOpen?: (entry: ConceptEntry) => void;
}) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const value = query ?? uncontrolledQuery;
  const index = useMemo(() => createConceptIndex(entries), [entries]);
  const result = useMemo(
    () => searchConceptIndex(index, value, category === "all" ? undefined : category),
    [index, value, category],
  );

  const counts: Readonly<Record<CategoryFilter, number>> = {
    all: CONCEPT_CATEGORY_IDS.reduce((sum, id) => sum + result.counts[id], 0),
    ...result.counts,
  };

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
      title={COLLECTION_LABEL.concepts}
      searchLabel={translate("ui.reference.conceptIndex.copy.搜索概念")}
      placeholder={CONCEPT_SEARCH_PLACEHOLDER}
      query={value}
      onQueryChange={setQuery}
      chips={CHIP_ORDER.map((id) => ({ id, label: chipLabel(id), count: counts[id] }))}
      selectedChipId={category}
      onSelectChip={(id) => setCategory(id as CategoryFilter)}
      groups={result.groups.map((group) => ({
        id: group.id,
        // Under 「全部」 a group heading of 「测试」 alone does not say which
        // world it belongs to, and the whole point of the chip counts is to
        // teach where things live.
        label:
          category === "all"
            ? `${CONCEPT_CATEGORY_LABEL[group.category]} · ${group.label}`
            : group.label,
        count: group.count,
        items: group.entries.map((item) => ({
          id: item.head.id,
          title: item.head.zh,
          subtitle: item.head.tagline,
        })),
      }))}
      searched={searched}
      emptyMiss={{
        title: translate("ui.reference.conceptIndex.copy.没有找到-value0-相关的条目", {
          value0: result.query,
        }),
        description: translate(
          "ui.reference.conceptIndex.copy.可以搜中文名-英文名-或者直接把你看见的现象写出来-例如-点了没反应-刷新就没了-怎么退回上一版-不必先知道它叫",
        ),
      }}
      emptyIdle={{
        title: translate("ui.reference.conceptIndex.copy.还没有条目"),
        description: translate("ui.reference.conceptIndex.copy.目录载入后会出现在这里"),
      }}
      onOpenHit={(id) => {
        const entry = byId.get(id);
        if (entry) onOpen?.(entry);
      }}
    />
  );
}
