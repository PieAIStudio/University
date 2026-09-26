import type { LabelBox } from "./labels.js";
import type { ViewportRect } from "./overlay-reservations.js";

export function stageRelativeBox(stage: HTMLElement, element: HTMLElement): LabelBox | null {
  return stageRelativeRect(stage, element.getBoundingClientRect());
}

function stageRelativeRect(stage: HTMLElement, rect: ViewportRect): LabelBox | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const stageRect = stage.getBoundingClientRect();
  return {
    left: rect.x - stageRect.left,
    top: rect.y - stageRect.top,
    right: rect.x + rect.width - stageRect.left,
    bottom: rect.y + rect.height - stageRect.top,
  };
}

/**
 * Follow cards outrank transient hints, but names and node icons do not.
 * `reserved` is space a floating layer outside the shell reported for itself
 * (overlay-reservations.ts): 涟's answer panel, which portals to the body.
 */
export function mapOverlayObstacles(
  stage: HTMLElement,
  shell: HTMLElement,
  reserved: readonly ViewportRect[] = [],
): {
  readonly chrome: readonly LabelBox[];
  readonly labels: readonly LabelBox[];
  readonly elements: readonly HTMLElement[];
} {
  const chromeElements = [
    ...shell.querySelectorAll<HTMLElement>(
      ".nav-rail, .counter-row, .app-shell__aside, [data-map-shell] .app-shell__east-stack, .nextup, .tab-bar, .map-breadcrumbs",
    ),
  ];
  const labelElements = [
    ...shell.querySelectorAll<HTMLElement>(
      ".picked--left, .hint:not(.hint--dismissed), .map-framing-tools, .map-guide__seat",
    ),
  ];
  const boxes = (elements: readonly HTMLElement[]) =>
    elements
      .map((element) => stageRelativeBox(stage, element))
      .filter((box): box is LabelBox => box !== null);
  const chrome = boxes(chromeElements);
  const claimed = reserved
    .map((rect) => stageRelativeRect(stage, rect))
    .filter((box): box is LabelBox => box !== null);
  return {
    chrome,
    labels: [...chrome, ...boxes(labelElements), ...claimed],
    elements: [...chromeElements, ...labelElements],
  };
}
