import { PlayCatalog } from "@pieai/university-ui/play-catalog/PlayCatalog.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { lazy, Suspense } from "react";
import type { Shelf } from "@pieai/university-ui/content/port.js";

const ThreePlayer = lazy(() =>
  import("./ThreePlayer.js").then((m) => ({ default: m.ThreePlayer })),
);
export default function PlayCatalogRoute({
  learner = false,
  shelf,
}: {
  readonly learner?: boolean;
  readonly shelf: Shelf | null;
}) {
  const { t } = useI18n();
  return (
    <PlayCatalog
      studies={shelf?.studies ?? []}
      learner={learner}
      renderThree={(mode) => (
        <Suspense fallback={<p>{t("arcade3d.loading")}</p>}>
          <ThreePlayer mode={mode} />
        </Suspense>
      )}
    />
  );
}
