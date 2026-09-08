// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
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
  it("keeps course progress visible and described without changing its accessible course name", () => {
    const states = ["live", "done", "open", "idle"] as const;
    const markup = renderToStaticMarkup(
      <WorldMapCanvas
        world={null}
        cameraFrom={[0, 0, 1]}
        lookAt={[0, 0, 0]}
        learnerAt={null}
        avatarRecipe={null}
        avatarSignedIn={false}
        skyStudyId={null}
        markers={states.map((state) => ({
          id: state,
          position: new THREE.Vector3(),
          text: `Course ${state}`,
          kind: "course" as const,
          courseState: state,
          activate: () => undefined,
        }))}
        onPick={() => undefined}
        onHover={() => undefined}
      />,
    );
    const host = document.createElement("div");
    host.innerHTML = markup;
    for (const [index, caption] of ["当前", "已完成", "可学", "后续"].entries()) {
      const button = host.querySelector(`[data-course-state="${states[index]}"]`)!;
      expect(button.getAttribute("aria-description")).toBe(caption);
      expect(button.querySelector("small[aria-hidden=true]")?.textContent).toContain(caption);
      expect(button.getAttribute("aria-label")).toBeNull();
    }
    expect(host.querySelector('[data-course-state="done"] small')?.textContent).toContain("✓");
  });

  it("does not retire a hint and move its control during a pointer press", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onInteract = vi.fn();
    const activate = vi.fn();
    try {
      await act(async () =>
        root.render(
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
                position: new THREE.Vector3(),
                text: "Course",
                kind: "course",
                activate,
              },
            ]}
            onPick={() => undefined}
            onHover={() => undefined}
            onInteract={onInteract}
          />,
        ),
      );
      const button = host.querySelector("button")!;
      const event = (type: string, x = 40) =>
        new MouseEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: 40,
          button: 0,
        });
      await act(async () => button.dispatchEvent(event("pointerdown")));
      expect(onInteract).not.toHaveBeenCalled();
      await act(async () => button.dispatchEvent(event("pointerup")));
      expect(onInteract).not.toHaveBeenCalled();
      await act(async () => button.dispatchEvent(event("click")));
      expect(onInteract).toHaveBeenCalledTimes(1);
      expect(activate).toHaveBeenCalledTimes(1);

      onInteract.mockClear();
      activate.mockClear();
      await act(async () => {
        button.dispatchEvent(event("pointerdown"));
        button.dispatchEvent(event("pointermove", 60));
      });
      expect(onInteract).toHaveBeenCalledTimes(1);
      await act(async () => {
        button.dispatchEvent(event("pointerup", 60));
        button.dispatchEvent(event("click", 60));
      });
      expect(activate).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
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
