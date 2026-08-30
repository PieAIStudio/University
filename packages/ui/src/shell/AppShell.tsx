import { useState, type ReactNode } from "react";

import { CounterRow } from "./CounterRow.js";
import { NavRail } from "./NavRail.js";
import { TabBar } from "./TabBar.js";

/**
 * Product-neutral chrome. Labels, routes and icons all arrive as props so this
 * can graduate to SwimmerUIKit later; a University-named prop would fail that
 * test. One component tree at every breakpoint — the counter row is a single
 * node; CSS moves it. Below 768px it is a strip above main. At ≥768 the canvas
 * is full-bleed and the rail / aside float on top of it as opaque cards.
 *
 * Collapse controls live *inside* those cards (brand row, counter row), not
 * as sibling pills in the gutter. A remote next to a card is a second object;
 * a chevron on the card is the card folding. The rail, when collapsed, shrinks
 * to that same chevron rather than `display: none` — hiding the button with
 * the panel would leave no way to expand it. The aside hides; the counter row
 * stays, because the study switcher is not the thing being folded, and it is
 * where the aside's chevron already lives.
 */

export interface ShellNavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly href: string;
  readonly badge?: number | "dot";
  /**
   * Accessible form of `badge`. A bare "3" next to an icon is not a name; pass
   * the whole phrase here and the visual digit stays decorative.
   */
  readonly badgeLabel?: string;
  /** Present = this item opens a flyout instead of navigating. */
  readonly children?: readonly ShellNavItem[];
}

export interface ShellCounter {
  readonly id: string;
  readonly icon: ReactNode;
  /** Absent renders icon only — the language-flag slot in W1 has no number. */
  readonly value?: string;
  readonly label: string;
  readonly href?: string;
  /** Duolingo greys a zero streak rather than hiding it. */
  readonly muted?: boolean;
  /**
   * Replaces the default icon+value control. The study switcher uses this so
   * the island slot can open a menu without a second counter row.
   */
  readonly control?: ReactNode;
}

export interface AppShellProps {
  /** Who you are — rendered at the foot of the nav rail. See NavRail. */
  readonly identity?: ReactNode;
  readonly nav: readonly ShellNavItem[];
  readonly tabs: readonly ShellNavItem[];
  readonly activeId: string;
  readonly counters?: readonly ShellCounter[];
  readonly brand?: ReactNode;
  readonly aside?: ReactNode;
  readonly asideLabel?: string;
  /**
   * Phone layout hides the aside. Pass true when that aside *is* the way
   * forward — the planet picker — so CSS can give it a real row instead of
   * `display: none`.
   */
  readonly showAsideOnPhone?: boolean;
  readonly children: ReactNode;
}

export const SHELL_COLLAPSED_KEY = "app-shell.collapsed";

function readCollapsed(): { rail: boolean; aside: boolean } {
  if (typeof localStorage === "undefined") return { rail: false, aside: false };
  try {
    const raw = localStorage.getItem(SHELL_COLLAPSED_KEY);
    if (!raw) return { rail: false, aside: false };
    const parsed = JSON.parse(raw) as { rail?: unknown; aside?: unknown };
    return { rail: parsed.rail === true, aside: parsed.aside === true };
  } catch {
    return { rail: false, aside: false };
  }
}

function writeCollapsed(next: { rail: boolean; aside: boolean }) {
  try {
    localStorage.setItem(SHELL_COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
}

export function AppShell({
  nav,
  tabs,
  activeId,
  counters,
  brand,
  aside,
  asideLabel,
  showAsideOnPhone = false,
  children,
  identity,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const persist = (next: { rail: boolean; aside: boolean }) => {
    setCollapsed(next);
    writeCollapsed(next);
  };
  const hasAside = aside != null;

  return (
    <div
      className="app-shell"
      data-aside-phone={showAsideOnPhone ? "true" : "false"}
      data-rail-collapsed={collapsed.rail ? "true" : "false"}
      data-aside-collapsed={collapsed.aside ? "true" : "false"}
    >
      <div className="app-shell__west">
        <NavRail
          items={nav}
          activeId={activeId}
          identity={identity}
          brand={brand}
          collapse={
            <button
              type="button"
              className="app-shell__collapse app-shell__collapse--rail"
              aria-expanded={!collapsed.rail}
              aria-controls="app-shell-rail"
              onClick={() => persist({ ...collapsed, rail: !collapsed.rail })}
            >
              <span className="app-shell__collapse-icon" aria-hidden="true">
                {collapsed.rail ? "▶" : "◀"}
              </span>
              <span className="app-shell__collapse-label">
                {collapsed.rail ? "展开导航" : "收起"}
              </span>
            </button>
          }
        />
      </div>
      <main className="app-shell__main">
        <div className="app-shell__content">{children}</div>
      </main>
      <div className="app-shell__east">
        <div className="app-shell__east-stack">
          <CounterRow
            counters={counters ?? []}
            collapse={
              hasAside ? (
                <button
                  type="button"
                  className="app-shell__collapse app-shell__collapse--aside"
                  aria-expanded={!collapsed.aside}
                  aria-controls="app-shell-aside"
                  onClick={() => persist({ ...collapsed, aside: !collapsed.aside })}
                >
                  <span className="app-shell__collapse-icon" aria-hidden="true">
                    {collapsed.aside ? "◀" : "▶"}
                  </span>
                  <span className="app-shell__collapse-label">
                    {collapsed.aside ? "展开上下文" : "收起"}
                  </span>
                </button>
              ) : null
            }
          />
          {hasAside ? (
            <aside className="app-shell__aside" id="app-shell-aside" aria-label={asideLabel}>
              {aside}
            </aside>
          ) : null}
        </div>
      </div>
      <TabBar items={tabs} activeId={activeId} />
    </div>
  );
}
