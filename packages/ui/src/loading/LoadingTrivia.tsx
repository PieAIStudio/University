import { translate } from "../i18n/index.js";
import { useEffect, useState } from "react";
import { GamePanel } from "@pieai/swimmer-ui-kit";
import type { ConceptHead } from "@pieai/university-core";

import { pickLoadingConcept } from "./pick-loading-concept.js";
import {
  markLoadingIntroSeen,
  readLoadingVisit,
  type LoadingStorage,
  type LoadingVisit,
} from "./loading-visit.js";

export { pickLoadingConcept } from "./pick-loading-concept.js";
export {
  useMapCover,
  useMapCoverState,
  MAP_COVER_GIVE_UP_MS,
  MAP_COVER_REOPEN_MS,
  type MapCoverState,
} from "./use-map-cover.js";

/**
 * Screen 09: something worth reading while the canvas is still empty.
 *
 * This is a loading overlay, not a splash screen. Callers mount it only while
 * the scene is busy and unmount the instant it is ready — there is no minimum
 * display time, and this component does not delay that unmount. Waiting can
 * be part of the product; forcing anyone to watch two extra seconds cannot.
 *
 * First visit: say what this is and where to click. Later visits: one
 * catalogue tagline. Readable text is DOM, never geometry.
 */
export function LoadingTrivia({
  concept,
  visit,
  storage,
}: {
  readonly concept?: ConceptHead | null;
  readonly visit?: LoadingVisit;
  readonly storage?: LoadingStorage | null;
} = {}) {
  const [resolvedVisit] = useState(() => visit ?? readLoadingVisit(storage));
  const showIntro = resolvedVisit === "first" && concept === undefined;
  const [head] = useState(() =>
    showIntro ? null : concept === undefined ? pickLoadingConcept() : concept,
  );

  useEffect(() => {
    if (!showIntro || visit !== undefined) return;
    markLoadingIntroSeen(storage);
  }, [showIntro, visit, storage]);

  return (
    <div className="loading-trivia" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-trivia__card">
        {showIntro ? (
          <>
            <p className="loading-trivia__kicker">
              {translate("ui.loading.loadingTrivia.copy.地图马上铺开")}
            </p>
            <GamePanel title={translate("ui.loading.loadingTrivia.copy.点一座岛-开始学")}>
              <p className="loading-trivia__tagline">
                {translate("ui.loading.loadingTrivia.copy.每座岛是一门课-读完再练")}
              </p>
            </GamePanel>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
