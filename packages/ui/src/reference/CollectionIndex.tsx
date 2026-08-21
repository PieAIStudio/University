import type { ReactNode } from "react";
import { GameBadge, GameEmptyState, GameField, GameInput, GamePanel } from "@pieai/swimmer-ui-kit";

/**
 * One hit in the collection index. Terms put the English headword in `title`
 * and the gloss in `subtitle`; anti-patterns put the Chinese name and the
 * spoken complaint. The chrome does not know which collection it is showing.
 */
interface CollectionIndexHit {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly titleLang?: string;
}

interface CollectionIndexGroup {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly items: readonly CollectionIndexHit[];
}

interface CollectionIndexChip {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/**
 * The index chrome F1 reuses: search, category chips, grouped hits.
 *
 * TermIndex and the anti-pattern catalogue are adapters over this, not a
 * second page. A second list with its own chips would be SPEC-0004 failing.
 * Class names stay `term-index__*` because both shells already load that
 * stylesheet; renaming it would invent a second look for the same surface.
 */
export function CollectionIndex({
  title,
  header,
  searchLabel,
  placeholder,
  query,
  onQueryChange,
  chips,
  selectedChipId,
  onSelectChip,
  groups,
  searched,
  emptyMiss,
  emptyIdle,
  onOpenHit,
  children,
}: {
  readonly title: string;
  readonly header?: ReactNode;
  readonly searchLabel: string;
  readonly placeholder: string;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly chips: readonly CollectionIndexChip[];
  readonly selectedChipId: string;
  readonly onSelectChip: (id: string) => void;
  readonly groups: readonly CollectionIndexGroup[];
  readonly searched: boolean;
  readonly emptyMiss: { readonly title: string; readonly description: string };
  readonly emptyIdle: { readonly title: string; readonly description: string };
  readonly onOpenHit: (id: string, trigger: HTMLElement) => void;
  readonly children?: ReactNode;
}) {
  const visibleTotal = groups.reduce((sum, group) => sum + group.count, 0);

  let body;
  if (visibleTotal === 0 && searched) {
    body = <GameEmptyState title={emptyMiss.title} description={emptyMiss.description} />;
  } else if (visibleTotal === 0) {
    body = <GameEmptyState title={emptyIdle.title} description={emptyIdle.description} />;
  } else {
    body = (
      <div className="term-index__results">
        {groups.map((group) => (
          <section key={group.id} className="term-index__group" aria-label={group.label}>
            <h3 className="term-index__group-title">
              {group.label}
              <GameBadge>{group.count}</GameBadge>
            </h3>
            <ul className="term-index__list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="term-index__hit"
                    onClick={(event) => onOpenHit(item.id, event.currentTarget)}
                  >
                    <span
                      className="term-index__headword"
                      {...(item.titleLang ? { lang: item.titleLang } : {})}
                    >
                      {item.title}
                    </span>
                    <span className="term-index__gloss">{item.subtitle}</span>
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
    <GamePanel className="term-index" title={title}>
      {header ? <div className="term-index__notice">{header}</div> : null}
      <div className="term-index__search" role="search">
        <GameField label={searchLabel}>
          <GameInput
            type="search"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </GameField>
      </div>
      <div className="term-index__chips" role="radiogroup" aria-label="按类别筛选">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="term-index__chip"
            role="radio"
            aria-checked={selectedChipId === chip.id}
            onClick={() => onSelectChip(chip.id)}
          >
            <span>{chip.label}</span>
            <GameBadge>{chip.count}</GameBadge>
          </button>
        ))}
      </div>
      {body}
      {children}
    </GamePanel>
  );
}
