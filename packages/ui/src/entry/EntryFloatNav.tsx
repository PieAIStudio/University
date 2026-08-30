import { translate } from "../i18n/index.js";
/**
 * C23. Previous / next floating navigation on an entry page.
 *
 * Collection-generic on purpose: it takes neighbours as props, so a term page
 * and an anti-pattern page pass the same shape and neither grows a private
 * copy. The name is revealed on hover (and on focus, so a keyboard user is
 * not the only one who has to click to find out where they are going).
 */

export interface EntryNeighbour {
  readonly label: string;
  readonly href?: string;
  readonly onOpen?: () => void;
}

export interface EntryNeighbourPair {
  readonly previous?: EntryNeighbour | null;
  readonly next?: EntryNeighbour | null;
}

function isReachable(neighbour: EntryNeighbour | null | undefined): neighbour is EntryNeighbour {
  if (!neighbour) return false;
  if (neighbour.label.trim().length === 0) return false;
  return typeof neighbour.href === "string" || typeof neighbour.onOpen === "function";
}

function NeighbourControl({
  neighbour,
  direction,
}: {
  readonly neighbour: EntryNeighbour;
  readonly direction: "previous" | "next";
}) {
  const kind = direction === "previous" ? "prev" : "next";
  const arrow = direction === "previous" ? "‹" : "›";
  const ariaLabel =
    direction === "previous"
      ? translate("ui.entry.entryFloatNav.copy.上一个-value0", { value0: neighbour.label })
      : translate("ui.entry.entryFloatNav.copy.下一个-value0", { value0: neighbour.label });
  const className = `entry-page__float-nav entry-page__float-nav--${kind}`;

  const content = (
    <>
      <span className="entry-page__float-nav-arrow" aria-hidden="true">
        {arrow}
      </span>
      <span className="entry-page__float-nav-name">{neighbour.label}</span>
    </>
  );

  if (neighbour.href) {
    return (
      <a
        className={className}
        href={neighbour.href}
        title={neighbour.label}
        aria-label={ariaLabel}
        data-neighbour={direction}
        onClick={(event) => {
          if (!neighbour.onOpen) return;
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          neighbour.onOpen();
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={neighbour.label}
      aria-label={ariaLabel}
      data-neighbour={direction}
      onClick={neighbour.onOpen}
    >
      {content}
    </button>
  );
}

export function EntryFloatNav({ neighbours }: { readonly neighbours: EntryNeighbourPair }) {
  const previous = isReachable(neighbours.previous) ? neighbours.previous : null;
  const next = isReachable(neighbours.next) ? neighbours.next : null;
  if (!previous && !next) return null;

  return (
    <nav
      className="entry-page__float-navs"
      aria-label={translate("ui.entry.entryFloatNav.copy.相邻条目")}
    >
      {previous ? <NeighbourControl neighbour={previous} direction="previous" /> : null}
      {next ? <NeighbourControl neighbour={next} direction="next" /> : null}
    </nav>
  );
}
