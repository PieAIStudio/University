import type { ShellNavItem } from "./AppShell.js";
import { itemAccessibleName } from "./accessibility.js";

/**
 * Mobile bottom bar. Displayed only below 768px (CSS, not a JS branch) so the
 * tree stays one tree; `display: none` drops it from the accessibility tree
 * rather than leaving an invisible tab stop.
 */

export function TabBar({
  items,
  activeId,
}: {
  readonly items: readonly ShellNavItem[];
  readonly activeId: string;
}) {
  return (
    <nav className="tab-bar" aria-label="Tabs">
      <ul className="tab-bar__list">
        {items.map((item) => (
          <li key={item.id} className="tab-bar__slot">
            <a
              className="tab-bar__link"
              href={item.href}
              aria-current={item.id === activeId ? "page" : undefined}
              aria-label={item.badge != null ? itemAccessibleName(item) : undefined}
            >
              <span className="tab-bar__icon">{item.icon}</span>
              <span className="tab-bar__label">{item.label}</span>
              {item.badge != null ? (
                <span
                  className={
                    item.badge === "dot" ? "tab-bar__badge tab-bar__badge--dot" : "tab-bar__badge"
                  }
                  aria-hidden="true"
                >
                  {item.badge === "dot" ? null : item.badge}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
