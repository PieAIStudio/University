import type { RefObject } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "../i18n/index.js";

/** A scene projection positions this one action. No dialog, scrim or focus trap. */
export function MapEntryAction({
  title,
  onEnter,
  actionRef,
}: {
  readonly title: string;
  readonly onEnter: () => void;
  readonly actionRef: RefObject<HTMLElement | null>;
}) {
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
