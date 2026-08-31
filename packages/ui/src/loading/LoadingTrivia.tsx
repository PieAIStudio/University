import { translate } from "../i18n/index.js";
import { useState } from "react";
import { GamePanel } from "@pieai/swimmer-ui-kit";
import type { ConceptHead } from "@pieai/university-core";

import { pickLoadingConcept } from "./pick-loading-concept.js";

export { pickLoadingConcept } from "./pick-loading-concept.js";
export {
  useMapCover,
  useMapCoverState,
  MAP_COVER_GIVE_UP_MS,
  MAP_COVER_REOPEN_MS,
  type MapCoverState,
} from "./use-map-cover.js";

/**
 * Screen 09: a real concept while the canvas is still empty.
 *
 * Readable text is DOM, never geometry. This overlay sits over the canvas,
 * not inside it; the kit models streaming in are what take the time, and a
 * skeleton of grey bars would spend that time saying nothing. One of the 281
 * taglines is already a sentence a person can read.
 *
 * Callers mount this only while it should be visible, and unmount it when
 * the scene is ready. Hiding with opacity leaves it in the hit-test tree.
 */
export function LoadingTrivia({
  concept,
}: {
  readonly concept?: ConceptHead | null;
} = {}) {
  const [head] = useState(() => (concept === undefined ? pickLoadingConcept() : concept));

  return (
    <div className="loading-trivia" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-trivia__card">
        <p className="loading-trivia__kicker">
          {translate("ui.loading.loadingTrivia.copy.地图铺开时-看一条概念")}
        </p>
        {head ? (
          <GamePanel title={head.zh}>
            <p className="loading-trivia__tagline">{head.tagline}</p>
            {head.en ? <p className="loading-trivia__en">{head.en}</p> : null}
          </GamePanel>
        ) : (
          <GamePanel title={translate("ui.loading.loadingTrivia.copy.地图正在打开")}>
            <p className="loading-trivia__tagline">
              {translate("ui.loading.loadingTrivia.copy.岛屿马上就到")}
            </p>
          </GamePanel>
        )}
      </div>
    </div>
  );
}
