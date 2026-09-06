import type { LabelBox } from "./labels.js";

export function stageRelativeBox(stage: HTMLElement, element: HTMLElement): LabelBox | null {
  const stageRect = stage.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: rect.left - stageRect.left,
    top: rect.top - stageRect.top,
    right: rect.right - stageRect.left,
    bottom: rect.bottom - stageRect.top,
  };
}

/** Follow cards outrank transient hints, but names and node icons do not. */
export function mapOverlayObstacles(
  stage: HTMLElement,
  shell: HTMLElement,
): {
  readonly chrome: readonly LabelBox[];
  readonly labels: readonly LabelBox[];
  readonly elements: readonly HTMLElement[];
} {
  const chromeElements = [
    ...shell.querySelectorAll<HTMLElement>(
      ".nav-rail, .counter-row, .app-shell__aside, .nextup, .tab-bar",
    ),
  ];
  const labelElements = [
    ...shell.querySelectorAll<HTMLElement>(".picked--left, .hint:not(.hint--dismissed)"),
  ];
  const boxes = (elements: readonly HTMLElement[]) =>
    elements
      .map((element) => stageRelativeBox(stage, element))
      .filter((box): box is LabelBox => box !== null);
  const chrome = boxes(chromeElements);
  return {
    chrome,
    labels: [...chrome, ...boxes(labelElements)],
    elements: [...chromeElements, ...labelElements],
  };
}
