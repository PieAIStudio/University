import type { ReactNode } from "react";

import { CounterRow } from "./CounterRow.js";
import { NavRail } from "./NavRail.js";
import { TabBar } from "./TabBar.js";

/**
 * Product-neutral chrome. Labels, routes and icons all arrive as props so this
 * can graduate to SwimmerUIKit later; a University-named prop would fail that
 * test. One component tree at every breakpoint — the counter row is a single
 * grid item whose `grid-area` moves, because a second copy is how the two
 * layouts would start to drift.
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
}

export interface AppShellProps {
  readonly nav: readonly ShellNavItem[];
  readonly tabs: readonly ShellNavItem[];
  readonly activeId: string;
  readonly counters?: readonly ShellCounter[];
  readonly brand?: ReactNode;
  readonly aside?: ReactNode;
  readonly asideLabel?: string;
  readonly children: ReactNode;
}

export function AppShell({
  nav,
  tabs,
  activeId,
  counters,
  brand,
  aside,
  asideLabel,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <NavRail items={nav} activeId={activeId} brand={brand} />
      <main className="app-shell__main">{children}</main>
      <CounterRow counters={counters ?? []} />
      {aside != null ? (
        <aside className="app-shell__aside" aria-label={asideLabel}>
          {aside}
        </aside>
      ) : null}
      <TabBar items={tabs} activeId={activeId} />
    </div>
  );
}
