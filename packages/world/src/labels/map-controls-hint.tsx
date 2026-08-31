import { translate } from "@pieai/university-ui/i18n.js";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The map captions are three different promises, not one sentence.
 *
 * Controls are a self-teaching cue: after a learner drags, the map has shown
 * them what pan means and that cue may retire. The entry action is different:
 * a learner can drag a map forever without discovering that an island opens a
 * course, so that cue stays alive until the first island pick. Hover is a
 * transient name and gets its own slot in the renderer too.
 *
 * Glyphs are CSS masks with `currentColor`, not emoji. SwimmerUIKit's clay
 * icons are PNG and cannot tint; Lucide's `move` / `mouse` /
 * `mouse-pointer-click` / `zoom-in` (ISC) are the silhouettes the
 * stylesheet masks.
 */
export type MapPointer = "mouse" | "touch";

function hintItem(kind: "pan" | "zoom" | "enter", text: string, extraClass?: string): ReactNode {
  return (
    <span className={`hint__item hint__item--${kind}${extraClass ? ` ${extraClass}` : ""}`}>
      <span className="hint__icon" aria-hidden="true" />
      {text}
    </span>
  );
}

function hintSep(): ReactNode {
  return (
    <span className="hint__sep" aria-hidden="true">
      ·
    </span>
  );
}

export function mapControlsHint(pointer: MapPointer): ReactNode {
  const zoom =
    pointer === "touch"
      ? hintItem(
          "zoom",
          translate("ui.world.mapControlsHint.copy.双指缩放"),
          "hint__item--zoom-touch",
        )
      : hintItem(
          "zoom",
          translate("ui.world.mapControlsHint.copy.滚轮缩放"),
          "hint__item--zoom-mouse",
        );
  return (
    <span className="hint__row">
      {hintItem("pan", translate("ui.world.mapControlsHint.copy.拖动平移"))}
      {hintSep()}
      {zoom}
    </span>
  );
}

export function mapEntryHint(): ReactNode {
  return (
    <span className="hint__row">
      {hintItem("enter", translate("ui.world.mapControlsHint.copy.点岛进入"))}
    </span>
  );
}

function subscribeCoarsePointer(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(pointer: coarse)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function coarsePointerMatches(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

export function MapControlsHint(): ReactNode {
  const touch = useSyncExternalStore(subscribeCoarsePointer, coarsePointerMatches, () => false);
  return mapControlsHint(touch ? "touch" : "mouse");
}

export function MapEntryHint(): ReactNode {
  return mapEntryHint();
}
