import { translate } from "@pieai/university-ui/i18n.js";
import { lazy } from "react";

/**
 * Route-level code splitting. The landing page is the 3D map, so three / drei
 * / the scene stay in the first chunk. Everything below is a different room
 * and is not paid for until someone opens it.
 *
 * This fallback is a quiet status, not a map-cover catalogue card. Parking
 * that card on a lesson or settlement is a different scene for one frame,
 * which reads as a glitch.
 */
export function RouteFallback({ copy }: { readonly copy?: string } = {}) {
  return (
    <p className="loading-copy" role="status" aria-live="polite" aria-busy="true">
      {copy ?? translate("app.screens.lazy.copy.正在打开")}
    </p>
  );
}

export const LessonScreen = lazy(() =>
  import("./LessonScreen.js").then((mod) => ({ default: mod.LessonScreen })),
);

export const LibraryHost = lazy(() =>
  import("./LibraryHost.js").then((mod) => ({ default: mod.LibraryHost })),
);

export const TermEntryHost = lazy(() =>
  import("./TermEntryHost.js").then((mod) => ({ default: mod.TermEntryHost })),
);

export const ConceptEntryHost = lazy(() =>
  import("./ConceptEntryHost.js").then((mod) => ({ default: mod.ConceptEntryHost })),
);

export const AntiPatternEntryHost = lazy(() =>
  import("./AntiPatternEntryHost.js").then((mod) => ({ default: mod.AntiPatternEntryHost })),
);

export const PracticeHost = lazy(() =>
  import("./PracticeHost.js").then((mod) => ({ default: mod.PracticeHost })),
);

export const SettlementHost = lazy(() =>
  import("./SettlementHost.js").then((mod) => ({ default: mod.SettlementHost })),
);

export const CourseCatalog = lazy(() =>
  import("../catalog/CourseCatalog.js").then((mod) => ({ default: mod.CourseCatalog })),
);
