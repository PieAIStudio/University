import type { RefObject } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "../i18n/index.js";

/** Where a locked lesson sends the learner instead of in (V5 §12 decision C′). */
export interface MapEntryLock {
  /** Title of the first lesson not yet finished or proven. */
  readonly current: string;
  readonly onGoToCurrent: () => void;
  /** Opens the checkpoint gate's test for the current stretch, when there is one. */
  readonly onTest?: () => void;
}

/** A scene projection positions this one action. No dialog, scrim or focus trap. */
export function MapEntryAction({
  title,
  onEnter,
  actionRef,
  locked,
}: {
  readonly title: string;
  readonly onEnter: () => void;
  readonly actionRef: RefObject<HTMLElement | null>;
  /** The lesson is still locked: say why and offer the two ways on, never "Enter". */
  readonly locked?: MapEntryLock;
}) {
  if (locked)
    return (
      <section
        ref={actionRef}
        className="map-entry-action map-entry-action--locked"
        data-map-entry="locked"
        aria-label={translate("map.locked.label", { title })}
      >
        <p className="map-entry-action__why">
          {translate("map.locked.why", { current: locked.current })}
        </p>
        <GameButton type="button" variant="primary" onClick={locked.onGoToCurrent}>
          {translate("map.locked.goCurrent")}
        </GameButton>
        {locked.onTest ? (
          <GameButton type="button" variant="secondary" onClick={locked.onTest}>
            {translate("map.locked.test")}
          </GameButton>
        ) : null}
      </section>
    );
  return (
    <section
      ref={actionRef}
      className="map-entry-action"
      data-map-entry="true"
      aria-label={translate("map.currentSelection")}
    >
      <GameButton
        type="button"
        variant="primary"
        surface="liquid"
        liquidFinish="glossy"
        aria-label={translate("map.enterNamed", { title })}
        onClick={onEnter}
      >
        {translate("map.enter")}
      </GameButton>
    </section>
  );
}
