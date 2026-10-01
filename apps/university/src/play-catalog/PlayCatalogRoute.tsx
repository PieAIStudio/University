import { PlayCatalog } from "@pieai/university-ui/play-catalog/PlayCatalog.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { lazy, Suspense } from "react";

const ThreePlayer = lazy(() =>
  import("./ThreePlayer.js").then((m) => ({ default: m.ThreePlayer })),
);
export default function PlayCatalogRoute({ learner = false }: { readonly learner?: boolean }) {
  const { t } = useI18n();
  return (
    <PlayCatalog
      learner={learner}
      renderThree={(mode) => (
        <Suspense fallback={<p>{t("arcade3d.loading")}</p>}>
          <ThreePlayer mode={mode} />
        </Suspense>
      )}
    />
  );
}
