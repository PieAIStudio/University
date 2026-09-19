// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mapOverlayObstacles } from "./chrome-obstacles.js";

describe("map overlay obstacles", () => {
  it("reserves the actual style switch for framing, follow cards and labels", () => {
    const shell = document.createElement("main");
    shell.innerHTML = '<div class="stagewrap"><div class="map-world-style"></div></div>';
    const stage = shell.querySelector<HTMLElement>(".stagewrap")!;
    stage.getBoundingClientRect = () => new DOMRect(0, 0, 375, 812);
    shell.querySelector<HTMLElement>(".map-world-style")!.getBoundingClientRect = () =>
      new DOMRect(120, 600, 245, 44);
    const result = mapOverlayObstacles(stage, shell);
    expect(result.chrome).toEqual([{ left: 120, top: 600, right: 365, bottom: 644 }]);
    expect(result.labels).toEqual(result.chrome);
  });
  it("reserves course cards and visible hints for labels, but not for floating follow cards", () => {
    const shell = document.createElement("main");
    shell.innerHTML =
      '<div class="nav-rail"></div><div class="stagewrap"><aside class="picked--left"></aside><p class="hint hint--controls"></p><p class="hint hint--entry hint--dismissed"></p></div>';
    const stage = shell.querySelector<HTMLElement>(".stagewrap")!;
    stage.getBoundingClientRect = () => new DOMRect(0, 100, 375, 568);
    for (const node of shell.querySelectorAll<HTMLElement>(".nav-rail,.picked--left,.hint"))
      node.getBoundingClientRect = () => new DOMRect(10, 140, 100, 44);
    const active = mapOverlayObstacles(stage, shell);
    expect(active.chrome).toHaveLength(1);
    expect(active.labels).toHaveLength(3);
    expect(active.labels[0]).toEqual({ left: 10, top: 40, right: 110, bottom: 84 });
    shell.querySelector(".hint--controls")!.classList.add("hint--dismissed");
    expect(mapOverlayObstacles(stage, shell).labels).toHaveLength(2);
  });
});
