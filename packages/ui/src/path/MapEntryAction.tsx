import type { RefObject } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "../i18n/index.js";

/** Where a locked stop sends the learner instead of in (V5 §12 decision C′). */
export interface MapEntryLock {
  /** Title of the first lesson not yet finished or proven. */
  readonly current: string;
  readonly onGoToCurrent: () => void;
  /** Opens the checkpoint gate's test for the current stretch, when there is one. */
  readonly onTest?: () => void;
}

/**
 * The one card every place the avatar can stand opens (V5 R59): a lesson stone,
 * the gate, the pennant, the board. One line says what kind of stop it is, one
 * line what it is, and one button goes in — or, while it is locked, why not and
 * the two ways on. A scene projection positions it: no dialog, scrim or focus
 * trap.
 */
export function MapEntryAction({
  eyebrow,
  title,
  onEnter,
  actionRef,
  locked,
}: {
  /** What kind of stop this is: 「第 3 节」, 「小节关卡 · 第 1–3 节」. */
  readonly eyebrow?: string;
  readonly title: string;
  readonly onEnter: () => void;
  readonly actionRef: RefObject<HTMLElement | null>;
  /** The stop is still locked: say why and offer the two ways on, never "Enter". */
  readonly locked?: MapEntryLock;
}) {
  const heading = (
    <>
      {eyebrow ? <p className="map-entry-action__eyebrow">{eyebrow}</p> : null}
      {eyebrow ? <p className="map-entry-action__title">{title}</p> : null}
    </>
  );
  if (locked)
    return (
      <section
        ref={actionRef}
        className="map-entry-action map-entry-action--card map-entry-action--locked"
        data-map-entry="locked"
        aria-label={translate("map.locked.label", { title })}
      >
        {heading}
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
      className={eyebrow ? "map-entry-action map-entry-action--card" : "map-entry-action"}
      data-map-entry="true"
      aria-label={translate("map.currentSelection")}
    >
      {heading}
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
