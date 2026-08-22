import type { ReactNode } from "react";

import { AppShell, type ShellCounter, type ShellNavItem } from "../shell/AppShell.js";
import { railItemsWithExtra, TAB_ITEMS } from "./slots.js";

export type { ShellCounter, ShellNavItem };

/**
 * University chrome. Both apps mount this, never `AppShell` directly.
 *
 * Slot labels and routes live in `slots.tsx`. The frozen shell stays product-
 * neutral; extra local-only flyout entries arrive as `extraMoreItems`.
 */
export function UniversityShell({
  activeId,
  counters,
  aside,
  asideLabel = "上下文",
  extraMoreItems,
  brand,
  children,
}: {
  readonly activeId: string;
  readonly counters?: readonly ShellCounter[];
  readonly aside?: ReactNode;
  readonly asideLabel?: string;
  readonly extraMoreItems?: readonly ShellNavItem[];
  readonly brand?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <AppShell
      nav={railItemsWithExtra(extraMoreItems)}
      tabs={TAB_ITEMS}
      activeId={activeId}
      counters={counters}
      brand={brand ?? <span className="university-shell__brand">University</span>}
      aside={aside}
      asideLabel={asideLabel}
    >
      {children}
    </AppShell>
  );
}
