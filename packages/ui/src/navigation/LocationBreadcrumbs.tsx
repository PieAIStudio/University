import { useEffect, useRef, type MouseEvent } from "react";
import { translate } from "../i18n/index.js";

export interface LocationCrumb {
  readonly id: string;
  readonly title: string;
  readonly href?: string;
  readonly onNavigate?: () => void;
  readonly accessibleLabel?: string;
}

/** One path treatment for maps and reading. Ancestors are addresses, not history. */
export function LocationBreadcrumbs({
  items,
  className = "",
}: {
  readonly items: readonly LocationCrumb[];
  readonly className?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const currentId = items.at(-1)?.id;
  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [currentId]);
  const link = (item: LocationCrumb) => (
    <a
      href={item.href}
      title={item.title}
      aria-label={item.accessibleLabel}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        if (item.onNavigate) {
          event.preventDefault();
          item.onNavigate();
        }
        if (details.current) details.current.open = false;
      }}
    >
      {item.title}
    </a>
  );
  return (
    <nav
      className={`location-breadcrumb ${className}`}
      aria-label={translate("ui.lesson.lessonBreadcrumbs.copy.当前位置")}
    >
      <ol className="location-breadcrumb__list">
        {items.length > 1 ? (
          <li className="location-breadcrumb__overflow">
            <details
              ref={details}
              onKeyDown={(event) => {
                if (event.key === "Escape" && details.current?.open) {
                  event.preventDefault();
                  event.stopPropagation();
                  details.current.open = false;
                  details.current.querySelector("summary")?.focus();
                }
              }}
            >
              <summary aria-label={translate("map.fullPath")}>…</summary>
              <ul>
                {items.slice(0, -1).map((item) => (
                  <li key={item.id}>{link(item)}</li>
                ))}
                <li>
                  <strong>{items.at(-1)?.title}</strong>
                </li>
              </ul>
            </details>
          </li>
        ) : null}
        {items.map((item, index) => (
          <li
            key={item.id}
            className={index < items.length - 2 ? "location-breadcrumb__ancestor" : undefined}
          >
            {index === items.length - 1 ? (
              <span aria-current="page" title={item.title}>
                {item.title}
              </span>
            ) : (
              link(item)
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
