import { LocationBreadcrumbs } from "@pieai/university-ui/navigation/LocationBreadcrumbs.js";
import { toPath, type View } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
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
  const interfaceTranslator = useI18n();
  const items: { title: string; destination: View }[] = [
    {
      title: interfaceTranslator.t("ui.world.navigation.planets"),
      destination: { kind: "planet" },
    },
  ];
  if (layer !== "planet") {
    items.push({
      title: studyTitle ?? interfaceTranslator.t("ui.world.navigation.archipelago"),
      destination: { kind: "world" },
    });
  }
  if (layer === "course") {
    items.push({
      title: courseTitle ?? interfaceTranslator.t("ui.world.navigation.island"),
      destination: { kind: "world" },
    });
  }
  return (
    <LocationBreadcrumbs
      className="map-breadcrumbs"
      items={items.map((item, index) => ({
        id: `${layer}:${index}:${item.title}`,
        title: item.title,
        href: toPath(item.destination),
        onNavigate: () => onNavigate(item.destination),
      }))}
    />
  );
}
