// @vitest-environment jsdom

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { WorldMapCanvas } from "./WorldMapCanvas.js";

vi.mock("./Stage.js", () => ({
  Stage: ({ children }: { readonly children?: ReactNode }) => <div data-stage>{children}</div>,
}));

vi.mock("./camera/controls.js", () => ({
  Controls: () => null,
  Flight: () => null,
  LabelProbe: () => null,
  WORLD_POLAR: Math.PI / 3,
}));

vi.mock("./Maps.js", () => ({
  placeWorld: () => null,
  WorldScene: () => null,
}));

describe("WorldMapCanvas rewrite marker", () => {
  it("keeps the status in a readable, structural DOM label", () => {
    const markup = renderToStaticMarkup(
      <WorldMapCanvas
        world={null}
        cameraFrom={[0, 0, 1]}
        lookAt={[0, 0, 0]}
        learnerAt={null}
        avatarRecipe={null}
        avatarSignedIn={false}
        skyStudyId={null}
        markers={[
          {
            id: "course",
            position: new THREE.Vector3(0, 0, 0),
            text: "课程名",
            sub: "learner-visible-status",
            kind: "course",
            activate: () => undefined,
          },
        ]}
        onPick={() => undefined}
        onHover={() => undefined}
      />,
    );
    const host = document.createElement("div");
    host.innerHTML = markup;
    const marker = host.querySelector<HTMLElement>("[data-course-rewrite-marker]");

    expect(marker).toBeInstanceOf(HTMLButtonElement);
    expect(marker?.getAttribute("aria-label")).toBeNull();
    expect(marker?.textContent?.trim()).toBe("课程名learner-visible-status");
    expect(marker?.querySelector("small.label__course-status")).not.toBeNull();
  });
});
