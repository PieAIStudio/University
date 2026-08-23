import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { ShellNavItem } from "./AppShell.js";

/**
 * Left rail, including the flyout. Items with `children` are a menu, not a
 * dialog: no scrim and no focus trap, because the rest of the page stays
 * usable and Escape is enough to put the keyboard back on the button.
 */

function itemAccessibleName(item: ShellNavItem): string {
  if (item.badgeLabel) return item.badgeLabel;
  if (typeof item.badge === "number") return `${item.label} ${item.badge}`;
  return item.label;
}

function descendantIsActive(item: ShellNavItem, activeId: string): boolean {
  return Boolean(item.children?.some((child) => child.id === activeId));
}

function NavBadge({ item }: { readonly item: ShellNavItem }) {
  if (item.badge == null) return null;
  return (
    <span
      className={item.badge === "dot" ? "nav-rail__badge nav-rail__badge--dot" : "nav-rail__badge"}
      aria-hidden="true"
    >
      {item.badge === "dot" ? null : item.badge}
    </span>
  );
}

function NavLink({ item, activeId }: { readonly item: ShellNavItem; readonly activeId: string }) {
  return (
    <a
      className="nav-rail__link"
      href={item.href}
      aria-current={item.id === activeId ? "page" : undefined}
      aria-label={item.badge != null ? itemAccessibleName(item) : undefined}
    >
      <span className="nav-rail__icon">{item.icon}</span>
      <span className="nav-rail__label">{item.label}</span>
      <NavBadge item={item} />
    </a>
  );
}

function NavFlyout({ item, activeId }: { readonly item: ShellNavItem; readonly activeId: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const children = item.children ?? [];

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange(next, _event, reason) {
      setOpen(next);
      if (!next && reason === "escape-key") {
        const trigger = refs.domReference.current;
        if (trigger instanceof HTMLElement) trigger.focus();
      }
    },
    placement: "right-start",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  useLayoutEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
  }, [open]);

  const childActive = descendantIsActive(item, activeId);
  const triggerCurrent = !open && (item.id === activeId || childActive);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="nav-rail__flyout"
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            id={menuId}
            role="menu"
          >
            {children.map((child, index) => (
              <a
                key={child.id}
                ref={
                  index === 0
                    ? (node) => {
                        firstItemRef.current = node;
                        node?.focus();
                      }
                    : undefined
                }
                className="nav-rail__flyout-item"
                role="menuitem"
                href={child.href}
                aria-current={child.id === activeId ? "page" : undefined}
                aria-label={child.badge != null ? itemAccessibleName(child) : undefined}
                onClick={() => setOpen(false)}
              >
                <span className="nav-rail__icon">{child.icon}</span>
                <span className="nav-rail__label">{child.label}</span>
                <NavBadge item={child} />
              </a>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="nav-rail__flyout-trigger"
        ref={refs.setReference}
        {...getReferenceProps()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-current={triggerCurrent ? "page" : undefined}
      >
        <span className="nav-rail__icon">{item.icon}</span>
        <span className="nav-rail__label">{item.label}</span>
        <NavBadge item={item} />
      </button>
      {menu}
    </>
  );
}

export function NavRail({
  items,
  activeId,
  brand,
  collapse,
  identity,
}: {
  readonly items: readonly ShellNavItem[];
  readonly activeId: string;
  readonly brand?: ReactNode;
  /**
   * Lives in the brand row, not beside the rail. A sibling pill next to an
   * opaque card is a second piece of furniture; collapsing has to feel like
   * the card folding, not like a remote being left on the table.
   */
  readonly collapse?: ReactNode;
  /**
   * Who you are, at the foot of the rail.
   *
   * Not in the counter capsule, which was the first attempt: that row is a
   * strip of 38–44px slots, and a 3D avatar rendered into one is a coloured
   * circle — the species, the ears and the shy glance are all below the
   * resolution the slot can carry, so the thing we built in 3D arrived looking
   * like a 2D dot. The rail has room, it is on every screen, and it is where
   * the eye already goes for "me".
   */
  readonly identity?: ReactNode;
}) {
  return (
    <nav className="nav-rail" id="app-shell-rail" aria-label="Primary">
      {brand != null || collapse != null ? (
        <div className="nav-rail__brand">
          {brand}
          {collapse}
        </div>
      ) : null}
      <ul className="nav-rail__list">
        {items.map((item) => (
          <li key={item.id} className="nav-rail__slot">
            {item.children ? (
              <NavFlyout item={item} activeId={activeId} />
            ) : (
              <NavLink item={item} activeId={activeId} />
            )}
          </li>
        ))}
      </ul>
      {/*
        Empty on purpose. The review note mounts next to `App`, not in this
        tree, so it can still exist on routes that drop the shell. It portals
        into this host when the host is there. Putting the note in the list
        would make it a tab — it opens a panel, it does not go anywhere.
      */}
      <div className="nav-rail__foot">
        {identity != null ? <div className="nav-rail__identity">{identity}</div> : null}
        <div className="nav-rail__footer" id="app-shell-rail-footer" />
      </div>
    </nav>
  );
}
