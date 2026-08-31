import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The idle sentence under the map. A React node, not a string, so each
 * clause can carry a monochrome glyph. Both shells render
 * `{hovered ? hovered : MAP_CONTROLS_HINT}` — a node is a valid child, so
 * they do not have to change, and a hovered island name stays plain text.
 *
 * The hint has to describe the controls that exist. It said 「右键旋转」
 * for as long as rotation had been disabled — telling a learner to
 * right-drag taught them the app was broken. The same lie, on a phone,
 * is 「滚轮缩放」: there is no wheel. Zoom is a pinch there, a wheel on
 * a mouse. Name the pointer that is actually in the learner's hand.
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
      ? hintItem("zoom", "双指缩放", "hint__item--zoom-touch")
      : hintItem("zoom", "滚轮缩放", "hint__item--zoom-mouse");
  return (
    <span className="hint__row">
      {hintItem("pan", "拖动平移")}
      {hintSep()}
      {zoom}
      {hintSep()}
      {hintItem("enter", "点岛进入")}
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

export const MAP_CONTROLS_HINT: ReactNode = <MapControlsHint />;
