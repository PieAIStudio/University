import { lazy } from "react";

import { LoadingTrivia } from "@pieai/university-ui/loading/LoadingTrivia.js";

/**
 * Route-level code splitting. The landing page is the 3D map, so three / drei
 * / the scene stay in the first chunk. Everything below is a different room
 * and is not paid for until someone opens it.
 */
export function RouteFallback() {
  return (
    <div className="learn-stage">
      <LoadingTrivia />
    </div>
  );
}

export const LessonReaderHost = lazy(() =>
  import("./LessonReaderHost.js").then((mod) => ({ default: mod.LessonReaderHost })),
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
