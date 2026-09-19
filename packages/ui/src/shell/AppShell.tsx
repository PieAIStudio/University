import { useEffect, useRef, useState, type ReactNode } from "react";

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
  /** A command opens in place; it is rendered as a button, not a fake link. */
  readonly onActivate?: () => void;
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

export interface ShellCollapseLabels {
  readonly collapse: string;
  readonly expandRail: string;
  readonly expandAside: string;
  readonly railName?: string;
  readonly asideName?: string;
}

export interface AppShellProps {
  readonly mapMode?: boolean;
  readonly asideTitle?: string;
  /** Who you are — rendered at the foot of the nav rail. See NavRail. */
  readonly identity?: ReactNode;
  readonly nav: readonly ShellNavItem[];
  readonly tabs: readonly ShellNavItem[];
  readonly activeId: string;
  readonly counters?: readonly ShellCounter[];
  readonly collapseLabels: ShellCollapseLabels;
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
  mapMode = false,
  asideTitle,
  nav,
  tabs,
  activeId,
  counters,
  collapseLabels,
  brand,
  aside,
  asideLabel,
  showAsideOnPhone = false,
  children,
  identity,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const shell = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const [mobilePanel, setMobilePanel] = useState<"rail" | "aside" | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setNarrow(media.matches);
      if (!media.matches) setMobilePanel(null);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setMobilePanel(null);
  }, [mapMode]);
  useEffect(() => {
    if (!mapMode || !mobilePanel) return;
    const side = mobilePanel;
    const panel = shell.current?.querySelector<HTMLElement>(
      side === "rail" ? ".app-shell__west" : ".app-shell__east",
    );
    const close = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !panel) return;
      // A nested brand dialog/menu owns its own keyboard cycle and Escape.
      if (
        [...document.querySelectorAll('dialog[open],[aria-modal="true"],.nav-rail__flyout')].some(
          (element) => element !== panel,
        )
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobilePanel(null);
        shell.current?.querySelector<HTMLButtonElement>(`.app-shell__collapse--${side}`)?.focus();
      } else if (event.key === "Tab") {
        const controls = [
          ...panel.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex="0"]',
          ),
        ].filter(
          (element) =>
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) return;
        if (
          event.shiftKey &&
          (document.activeElement === first || !panel.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !panel.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mapMode, mobilePanel]);
  const railOpen = mapMode && narrow ? mobilePanel === "rail" : !collapsed.rail;
  const asideOpen = mapMode && narrow ? mobilePanel === "aside" : !collapsed.aside;
  const persist = (next: { rail: boolean; aside: boolean }) => {
    setCollapsed(next);
    writeCollapsed(next);
  };
  const hasAside = aside != null;
  const toggle = (side: "rail" | "aside") => {
    if (mapMode && narrow) {
      setMobilePanel((current) => (current === side ? null : side));
      return;
    }
    persist({ ...collapsed, [side]: !collapsed[side] });
  };
  const asideCollapse = hasAside ? (
    <button
      type="button"
      className="app-shell__collapse app-shell__collapse--aside"
      aria-expanded={asideOpen}
      aria-controls="app-shell-aside"
      title={!asideOpen && mapMode ? asideTitle : undefined}
      onClick={() => toggle("aside")}
    >
      <span className="app-shell__collapse-icon" aria-hidden="true">
        {asideOpen ? "▶" : "◀"}
      </span>
      <span className="app-shell__collapse-label">
        {asideOpen ? collapseLabels.collapse : collapseLabels.expandAside}
        {mapMode && !asideOpen && asideTitle ? `: ${asideTitle}` : null}
      </span>
      {mapMode ? (
        <span className="map-shell__compact-label map-shell__compact-title" aria-hidden="true">
          {asideTitle || collapseLabels.asideName}
        </span>
      ) : null}
    </button>
  ) : null;

  return (
    <div
      className="app-shell"
      ref={shell}
      data-map-shell={mapMode ? "true" : undefined}
      data-map-rail-open={mapMode ? String(railOpen) : undefined}
      data-map-aside-open={mapMode ? String(asideOpen) : undefined}
      data-mobile-panel={mobilePanel ?? undefined}
      onClickCapture={(event) => {
        if (
          mapMode &&
          event.target instanceof Element &&
          event.target.closest("[data-shell-command]")
        )
          setMobilePanel(null);
      }}
      data-aside-phone={showAsideOnPhone ? "true" : "false"}
      data-rail-collapsed={collapsed.rail ? "true" : "false"}
      data-aside-collapsed={collapsed.aside ? "true" : "false"}
    >
      <div
        className="app-shell__west"
        role={mapMode && narrow && mobilePanel === "rail" ? "dialog" : undefined}
        aria-modal={mapMode && narrow && mobilePanel === "rail" ? true : undefined}
        aria-label={
          mapMode && narrow && mobilePanel === "rail"
            ? (collapseLabels.railName ?? collapseLabels.expandRail)
            : undefined
        }
        inert={mapMode && narrow && mobilePanel === "aside"}
      >
        <NavRail
          items={nav}
          activeId={activeId}
          identity={
            mapMode ? (
              <>
                {identity}
                <CounterRow counters={counters ?? []} />
              </>
            ) : (
              identity
            )
          }
          brand={brand}
          collapse={
            <button
              type="button"
              className="app-shell__collapse app-shell__collapse--rail"
              aria-expanded={railOpen}
              aria-controls="app-shell-rail"
              onClick={() => toggle("rail")}
            >
              <span className="app-shell__collapse-icon" aria-hidden="true">
                {railOpen ? "◀" : "▶"}
              </span>
              <span className="app-shell__collapse-label">
                {railOpen ? collapseLabels.collapse : collapseLabels.expandRail}
              </span>
            </button>
          }
        />
      </div>
      <main className="app-shell__main" inert={mapMode && narrow && mobilePanel !== null}>
        <div className="app-shell__content">{children}</div>
      </main>
      <header
        className="app-shell__east"
        role={mapMode && narrow && mobilePanel === "aside" ? "dialog" : undefined}
        aria-modal={mapMode && narrow && mobilePanel === "aside" ? true : undefined}
        aria-label={
          mapMode && narrow && mobilePanel === "aside"
            ? (collapseLabels.asideName ?? asideLabel)
            : undefined
        }
        inert={mapMode && narrow && mobilePanel === "rail"}
      >
        <div className="app-shell__east-stack">
          {mapMode ? (
            <div className="map-shell__heading">
              {asideCollapse}
              <h2 title={asideTitle}>{asideTitle}</h2>
            </div>
          ) : (
            <CounterRow counters={counters ?? []} collapse={asideCollapse} />
          )}
          {hasAside ? (
            <aside className="app-shell__aside" id="app-shell-aside" aria-label={asideLabel}>
              {aside}
            </aside>
          ) : null}
        </div>
      </header>
      {mapMode && narrow && mobilePanel ? (
        <div
          className="map-shell__drawer-shield"
          aria-hidden="true"
          onClick={() => {
            const side = mobilePanel;
            setMobilePanel(null);
            shell.current
              ?.querySelector<HTMLButtonElement>(`.app-shell__collapse--${side}`)
              ?.focus();
          }}
        />
      ) : null}
      <TabBar items={tabs} activeId={activeId} />
    </div>
  );
}
