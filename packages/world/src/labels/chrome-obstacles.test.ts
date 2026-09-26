// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mapOverlayObstacles } from "./chrome-obstacles.js";

describe("map overlay obstacles", () => {
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

  it("reserves the space a floating layer outside the shell reported for itself", () => {
    const shell = document.createElement("main");
    shell.innerHTML = '<div class="stagewrap"></div>';
    const stage = shell.querySelector<HTMLElement>(".stagewrap")!;
    stage.getBoundingClientRect = () => new DOMRect(0, 100, 375, 568);
    const reserved = [{ x: 20, y: 500, width: 300, height: 120 }];
    const obstacles = mapOverlayObstacles(stage, shell, reserved);
    expect(obstacles.chrome).toHaveLength(0);
    expect(obstacles.labels).toEqual([{ left: 20, top: 400, right: 320, bottom: 520 }]);
    // A layer that reports no size claims nothing.
    expect(
      mapOverlayObstacles(stage, shell, [{ x: 0, y: 0, width: 0, height: 0 }]).labels,
    ).toHaveLength(0);
  });
});
