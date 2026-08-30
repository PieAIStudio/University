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
  showAsideOnPhone = false,
  extraMoreItems,
  brand,
  identity,
  children,
}: {
  readonly activeId: string;
  readonly counters?: readonly ShellCounter[];
  readonly aside?: ReactNode;
  readonly asideLabel?: string;
  /** See AppShell: the aside stays a phone row instead of disappearing. */
  readonly showAsideOnPhone?: boolean;
  readonly extraMoreItems?: readonly ShellNavItem[];
  readonly brand?: ReactNode;
  /**
   * The learner's avatar, at the foot of the rail. **Required, and `null` is a
   * legal answer** — that combination is the whole point.
   *
   * It used to be optional, and the delivery shell passed one while the
   * authoring shell passed nothing. Nobody forked anything; this is one
   * component and both shells render it. But an optional slot left empty is
   * indistinguishable from an optional slot nobody wanted, so the compiler saw
   * no difference, a reviewer reading either file saw no difference, and the
   * only way to find it was to open the two campuses side by side — which is
   * how it was found.
   *
   * Making it required does not stop a shell deciding it has no identity to
   * show. It stops a shell deciding that by accident: `identity={null}` is a
   * sentence somebody wrote, and omission is not.
   */
  readonly identity: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <AppShell
      nav={railItemsWithExtra(extraMoreItems)}
      tabs={TAB_ITEMS}
      activeId={activeId}
      counters={counters}
      brand={brand ?? <span className="university-shell__brand">University</span>}
      identity={identity}
      aside={aside}
      asideLabel={asideLabel}
      showAsideOnPhone={showAsideOnPhone}
    >
      {children}
    </AppShell>
  );
}
