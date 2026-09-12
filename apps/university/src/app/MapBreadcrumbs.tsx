import type { MouseEvent } from "react";
import { toPath, type View } from "@pieai/university-core";
import { translate } from "@pieai/university-ui/i18n.js";
import "./map-breadcrumbs.css";

interface MapBreadcrumbsProps {
  readonly layer: "planet" | "world" | "course";
  readonly studyTitle?: string;
  readonly courseTitle?: string;
  readonly onNavigate: (view: View) => void;
}

/** Product hierarchy, not browser history: every ancestor has a real address. */
export function MapBreadcrumbs({
  layer,
  studyTitle,
  courseTitle,
  onNavigate,
}: MapBreadcrumbsProps) {
  const items: { title: string; destination: View }[] = [
    { title: translate("ui.world.navigation.planets"), destination: { kind: "planet" } },
  ];
  if (layer !== "planet") {
    items.push({
      title: studyTitle ?? translate("ui.world.navigation.archipelago"),
      destination: { kind: "world" },
    });
  }
  if (layer === "course") {
    items.push({
      title: courseTitle ?? translate("ui.world.navigation.island"),
      destination: { kind: "world" },
    });
  }
  const navigate = (event: MouseEvent<HTMLAnchorElement>, destination: View) => {
    // Leave new tabs, downloads and modified clicks to the browser.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onNavigate(destination);
  };
  return (
    <nav
      className="map-breadcrumbs"
      aria-label={translate("ui.lesson.lessonBreadcrumbs.copy.当前位置")}
    >
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {index === items.length - 1 ? (
              <span aria-current="page" title={item.title}>
                {item.title}
              </span>
            ) : (
              <a
                href={toPath(item.destination)}
                title={item.title}
                onClick={(event) => navigate(event, item.destination)}
              >
                {item.title}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
