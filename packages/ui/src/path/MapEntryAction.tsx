import type { RefObject } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";

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
  guard,
}: {
  /** What kind of stop this is: 「第 3 节」, 「小节关卡 · 第 1–3 节」. */
  readonly eyebrow?: string;
  readonly title: string;
  readonly onEnter: () => void;
  readonly actionRef: RefObject<HTMLElement | null>;
  /** The stop is still locked: say why and offer the two ways on, never "Enter". */
  readonly locked?: MapEntryLock;
  /**
   * The monster standing on this stop (V7), named after the fear it stands for.
   * Its name is text here, never geometry on the island.
   */
  readonly guard?: { readonly name: string; readonly fear: string };
}) {
  const interfaceTranslator = useI18n();
  const heading = (
    <>
      {eyebrow ? <p className="map-entry-action__eyebrow">{eyebrow}</p> : null}
      {eyebrow ? <p className="map-entry-action__title">{title}</p> : null}
      {guard ? (
        <p className="map-entry-action__guard">{interfaceTranslator.t("map.guard", guard)}</p>
      ) : null}
    </>
  );
  if (locked)
    return (
      <section
        ref={actionRef}
        className="map-entry-action map-entry-action--card map-entry-action--locked"
        data-map-entry="locked"
        aria-label={interfaceTranslator.t("map.locked.label", { title })}
      >
        {heading}
        <p className="map-entry-action__why">
          {interfaceTranslator.t("map.locked.why", { current: locked.current })}
        </p>
        <GameButton type="button" variant="primary" onClick={locked.onGoToCurrent}>
          {interfaceTranslator.t("map.locked.goCurrent")}
        </GameButton>
        {locked.onTest ? (
          <GameButton type="button" variant="secondary" onClick={locked.onTest}>
            {interfaceTranslator.t("map.locked.test")}
          </GameButton>
        ) : null}
      </section>
    );
  return (
    <section
      ref={actionRef}
      className={eyebrow ? "map-entry-action map-entry-action--card" : "map-entry-action"}
      data-map-entry="true"
      aria-label={interfaceTranslator.t("map.currentSelection")}
    >
      {heading}
      <GameButton
        type="button"
        variant="primary"
        surface="liquid"
        liquidFinish="glossy"
        aria-label={interfaceTranslator.t("map.enterNamed", { title })}
        onClick={onEnter}
      >
        {interfaceTranslator.t("map.enter")}
      </GameButton>
    </section>
  );
}
