import { interfaceTranslator, useI18n } from "../i18n/index.js";
import { useCallback, useMemo, useState } from "react";
import {
  CONCEPT_CATEGORY_IDS,
  CONCEPT_CATEGORY_LABEL,
  createConceptIndex,
  searchConceptIndex,
  type ConceptCategory,
  type ConceptEntry,
  type KnowledgeAlbum,
} from "@pieai/university-core";
import { GameButton, useGameCardOrientation } from "@pieai/swimmer-ui-kit";

import { COLLECTION_LABEL } from "../entry/EntryPage.js";
import { CollectionIndex } from "./CollectionIndex.js";
import { KnowledgeCardTile } from "./KnowledgeCard.js";

/**
 * Teaching placeholder, the same job the other two indexes give theirs: show
 * that you may arrive with a symptom rather than a name.
 *
 * Two examples, not three, and that is a measurement rather than taste — see
 * `SEARCH_PLACEHOLDER_MAX_CHARS`. A third example clipped mid-character taught
 * nothing and made the field look broken.
 */
export const CONCEPT_SEARCH_PLACEHOLDER = interfaceTranslator.t(
  "ui.reference.conceptIndex.copy.试试-点了没反应-怎么退回上一版",
);

type CategoryFilter = "all" | ConceptCategory;

const CHIP_ORDER: readonly CategoryFilter[] = ["all", ...CONCEPT_CATEGORY_IDS];

function chipLabel(id: CategoryFilter): string {
  return id === "all"
    ? interfaceTranslator.t("ui.reference.conceptIndex.copy.全部")
    : interfaceTranslator.t(`album.category.${id}`);
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
  album,
  domain,
  onReview,
  sound = false,
}: {
  readonly entries: readonly ConceptEntry[];
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly onOpen?: (entry: ConceptEntry) => void;
  readonly album?: KnowledgeAlbum;
  readonly domain?: { readonly id: string; readonly label: string };
  readonly onReview?: () => void;
  readonly sound?: boolean;
}) {
  const interfaceTranslator = useI18n();
  const [uncontrolledQuery, setUncontrolledQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  // One explicitly enabled input owner; only the selected memoized face gets
  // samples. A card never creates its own sensor or permission request.
  const orientation = useGameCardOrientation();
  const scoped = Boolean(album && domain && !expanded);
  const cardsById = useMemo(
    () => new Map(album?.cards.map((card) => [card.head.id, card]) ?? []),
    [album],
  );
  const ownEntries = useMemo(
    () =>
      scoped
        ? entries.filter(
            (entry) =>
              cardsById.get(entry.head.id)?.starter ||
              cardsById.get(entry.head.id)?.domainIds.includes(domain!.id),
          )
        : entries,
    [scoped, domain?.id, entries, cardsById],
  );

  const value = query ?? uncontrolledQuery;
  const index = useMemo(() => createConceptIndex(ownEntries), [ownEntries]);
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
  const openCard = useCallback(
    (id: string) => {
      const entry = byId.get(id);
      if (entry) onOpen?.(entry);
    },
    [byId, onOpen],
  );

  const groups = result.groups.map((group) => ({
    id: group.id,
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
  }));
  const visible = new Map(
    groups.flatMap((group) => group.items.map((item) => [item.id, item] as const)),
  );
  const assigned = new Set<string>();
  const sets = scoped
    ? (album?.sets ?? [])
        .filter((set) => set.domainId === domain?.id)
        .flatMap((set) => {
          const items = set.conceptIds
            .flatMap((id) => {
              const item = visible.get(id);
              if (!item || assigned.has(id)) return [];
              assigned.add(id);
              return [item];
            })
            .sort(
              (a, b) =>
                Number(Boolean(cardsById.get(b.id)?.collected)) -
                Number(Boolean(cardsById.get(a.id)?.collected)),
            );
          if (!items.length) return [];
          return [
            {
              id: set.id,
              label: interfaceTranslator.t("album.segment", {
                title: set.courseTitle,
                number: set.ordinal,
              }),
              detail: `${interfaceTranslator.t("album.setProgress", { collected: set.collected, total: set.conceptIds.length, shining: set.shining })}${set.complete ? ` · ${interfaceTranslator.t("album.setComplete")}` : ""}`,
              count: items.length,
              items,
            },
          ];
        })
    : [];
  const collected =
    album && !sets.length
      ? [...visible.values()].filter((item) => cardsById.get(item.id)?.collected)
      : [];
  for (const item of collected) assigned.add(item.id);
  const grouped =
    sets.length || collected.length
      ? [
          ...sets,
          ...(collected.length
            ? [
                {
                  id: "collected",
                  label: interfaceTranslator.t("album.collected"),
                  count: collected.length,
                  items: collected,
                },
              ]
            : []),
          ...groups.flatMap((group) => {
            const items = group.items.filter((item) => !assigned.has(item.id));
            return items.length ? [{ ...group, items, count: items.length }] : [];
          }),
        ]
      : groups;
  const activeCard =
    selectedCard && visible.has(selectedCard) && cardsById.get(selectedCard)?.collected
      ? selectedCard
      : grouped.flatMap((group) => group.items).find((item) => cardsById.get(item.id)?.collected)
          ?.id;

  return (
    <CollectionIndex
      title={COLLECTION_LABEL.concepts}
      header={
        album ? (
          <div
            className="knowledge-album__header"
            data-album-scope={scoped ? domain!.id : "all"}
            data-album-total={ownEntries.length}
          >
            <div className="knowledge-album__scope">
              <p>
                <strong>{scoped ? domain!.label : interfaceTranslator.t("album.all")}</strong>
                <span data-album-count>
                  {interfaceTranslator.t("album.count", {
                    collected: ownEntries.filter((entry) => cardsById.get(entry.head.id)?.collected)
                      .length,
                    total: ownEntries.length,
                  })}
                </span>
              </p>
              {domain ? (
                <GameButton
                  variant="secondary"
                  static
                  data-album-expand
                  onClick={() => {
                    setExpanded(!expanded);
                    setCategory("all");
                  }}
                >
                  {interfaceTranslator.t(expanded ? "album.scope" : "album.all")}
                </GameButton>
              ) : null}
            </div>
            <details className="knowledge-album__rules">
              <summary>{interfaceTranslator.t("album.rulesTitle")}</summary>
              <p>{interfaceTranslator.t("album.rules")}</p>
              {orientation.status !== "unavailable" ? (
                <div className="knowledge-album__motion">
                  <GameButton
                    variant="ghost"
                    static
                    data-album-tilt
                    disabled={orientation.reducedMotion || orientation.status === "requesting"}
                    onClick={() =>
                      orientation.status === "enabled"
                        ? orientation.disable()
                        : void orientation.enable()
                    }
                  >
                    {interfaceTranslator.t(
                      orientation.status === "enabled" ? "album.tiltOff" : "album.tiltOn",
                    )}
                  </GameButton>
                  <p role="status" data-album-tilt-state={orientation.status}>
                    {interfaceTranslator.t(
                      orientation.reducedMotion
                        ? "album.tiltReduced"
                        : orientation.status === "denied"
                          ? "album.tiltDenied"
                          : orientation.status === "enabled"
                            ? orientation.tilt
                              ? "album.tiltActive"
                              : "album.tiltWaiting"
                            : "album.tiltBoundary",
                    )}
                  </p>
                </div>
              ) : null}
            </details>
            {interfaceTranslator.locale === "en" ? (
              <p className="knowledge-album__language">
                {interfaceTranslator.t("album.originalLanguage")}
              </p>
            ) : null}
          </div>
        ) : undefined
      }
      searchLabel={interfaceTranslator.t("ui.reference.conceptIndex.copy.搜索概念")}
      placeholder={CONCEPT_SEARCH_PLACEHOLDER}
      query={value}
      onQueryChange={setQuery}
      chips={CHIP_ORDER.filter(
        (id) => !scoped || id === "all" || id === category || counts[id] > 0,
      ).map((id) => ({ id, label: chipLabel(id), count: counts[id] }))}
      selectedChipId={category}
      onSelectChip={(id) => setCategory(id as CategoryFilter)}
      groups={grouped}
      {...(album
        ? {
            renderHit: (id: string) => {
              const card = cardsById.get(id);
              const entry = byId.get(id);
              return card && entry ? (
                <KnowledgeCardTile
                  card={card}
                  onOpen={openCard}
                  onActivate={setSelectedCard}
                  tilt={id === activeCard ? orientation.tilt : null}
                  {...(onReview ? { onReview } : {})}
                  sound={sound}
                />
              ) : null;
            },
          }
        : {})}
      searched={searched}
      emptyMiss={{
        title: interfaceTranslator.t("ui.reference.conceptIndex.copy.没有找到-value0-相关的条目", {
          value0: result.query,
        }),
        description: interfaceTranslator.t(
          "ui.reference.conceptIndex.copy.可以搜中文名-英文名-或者直接把你看见的现象写出来-例如-点了没反应-刷新就没了-怎么退回上一版-不必先知道它叫",
        ),
      }}
      emptyIdle={{
        title: interfaceTranslator.t("ui.reference.conceptIndex.copy.还没有条目"),
        description: interfaceTranslator.t("ui.reference.conceptIndex.copy.目录载入后会出现在这里"),
      }}
      onOpenHit={(id) => {
        const entry = byId.get(id);
        if (entry) onOpen?.(entry);
      }}
    />
  );
}
