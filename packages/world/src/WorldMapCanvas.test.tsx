// @vitest-environment jsdom

import { act, createRef, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { WorldMapCanvas, type MapViewportCommands } from "./WorldMapCanvas.js";

vi.mock("./Stage.js", () => ({
  Stage: ({ children }: { readonly children?: ReactNode }) => <div data-stage>{children}</div>,
}));

vi.mock("./camera/controls.js", () => ({
  Controls: () => null,
  Flight: ({ to, look }: { to: readonly number[]; look: readonly number[] }) => (
    <div data-flight={JSON.stringify({ to, look })} />
  ),
  LabelProbe: () => null,
  WORLD_POLAR: Math.PI / 3,
}));

vi.mock("./Maps.js", () => ({
  placeWorld: () => null,
  WorldScene: () => null,
}));

describe("WorldMapCanvas rewrite marker", () => {
  it("keeps one full canvas viewport without an empty toolbar lane as hints retire", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement("div");
    const root = createRoot(host);
    const props = {
      commandsRef: createRef<MapViewportCommands>(),
      world: null,
      cameraFrom: [0, 0, 1] as const,
      lookAt: [0, 0, 0] as const,
      learnerAt: null,
      avatarRecipe: null,
      avatarSignedIn: false,
      skyStudyId: null,
      markers: [],
      onPick: () => undefined,
      onHover: () => undefined,
    };
    try {
      await act(async () =>
        root.render(
          <WorldMapCanvas {...props} courseViewKey="course" controlsHint="拖动平移 · 双指缩放" />,
        ),
      );
      const stage = host.querySelector("[data-stage]");
      const button = host.querySelector(".map-framing-tools button");
      expect(host.querySelector(".map-viewport")?.contains(stage)).toBe(true);
      expect(host.querySelector(".map-viewport")?.contains(button)).toBe(false);
      // Owner moved overview into the on-demand command palette. The canvas
      // still owns its real framing command, not a permanent HUD button.
      expect(button).toBeNull();
      expect(host.querySelector(".map-tools button")).toBeNull();
      expect(props.commandsRef.current?.overview).toBeTypeOf("function");
      await act(async () => props.commandsRef.current?.focus([3, 2, -1]));
      expect(JSON.parse(host.querySelector("[data-flight]")!.getAttribute("data-flight")!)).toEqual(
        { to: [3, 2, 0], look: [3, 2, -1] },
      );
      await act(async () => props.commandsRef.current?.focus([NaN, 2, -1]));
      expect(
        JSON.parse(host.querySelector("[data-flight]")!.getAttribute("data-flight")!).look,
      ).toEqual([3, 2, -1]);
      await act(async () => props.commandsRef.current?.learningView());
      expect(
        JSON.parse(host.querySelector("[data-flight]")!.getAttribute("data-flight")!).look,
      ).toEqual([0, 0, 0]);
      expect(
        host.querySelector(".map-tools")?.contains(host.querySelector(".hint--controls")),
      ).toBe(true);
      await act(async () =>
        root.render(
          <WorldMapCanvas
            {...props}
            courseViewKey="course"
            controlsHint={null}
            controlsHintVisible={false}
          />,
        ),
      );
      expect(host.querySelector(".map-framing-tools button")).toBe(button);
      expect(host.querySelector("[data-stage]")).toBe(stage);
      await act(async () => root.render(<WorldMapCanvas {...props} />));
      expect(host.querySelector("[data-stage]")).toBe(stage);
      expect(host.querySelectorAll("[data-stage]")).toHaveLength(1);
      expect(host.querySelector(".stagewrap")?.hasAttribute("data-map-view")).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "overlay.css"), "utf8");
    const labelCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "labels/scene-label.css"),
      "utf8",
    );
    // Overview moved into the palette; reserve neither its button nor its old
    // 72px lane. Keep transient hints outside Canvas without resizing it.
    expect(css).not.toMatch(/--map-tools-height:\s*72px/);
    expect(css).toMatch(/\.map-viewport\s*\{[^}]*inset:\s*0 0 var\(--map-tools-height, 0px\)/s);
    expect(css).toMatch(/\.map-tools\s*\{[^}]*display:\s*contents/s);
    expect(css).toMatch(/\.map-framing-tools button\s*\{[^}]*min-height:\s*44px/s);
    expect(labelCss).toMatch(/\.label--course\.scene-label\s*\{[^}]*min-block-size:\s*48px/s);
    expect(css).toMatch(
      /\.stagewrap \.label--course\s*\{[^}]*max-width:\s*min\(220px, calc\(50vw - 24px\)\)/s,
    );
  });

  it.each(["live", "done", "open", "idle"] as const)(
    "keeps the %s state and rewrite notice outside the truncated course title",
    (state) => {
      const title = "很长的课程名称：状态和改写提示不应被课程名称一起裁掉";
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
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
              id: "long-course",
              position: new THREE.Vector3(),
              text: title,
              sub: "改写中",
              kind: "course",
              courseState: state,
              activate: () => undefined,
            },
          ]}
          onPick={() => undefined}
          onHover={() => undefined}
        />,
      );
      const button = host.querySelector("button.label--course")!;
      const name = button.querySelector(".label__course-title");
      expect(name?.textContent).toBe(title);
      expect(name?.querySelector("small")).toBeNull();
      expect(
        button
          .querySelector(".label__course-progress")
          ?.parentElement?.classList.contains("scene-label__text"),
      ).toBe(true);
      expect(
        button
          .querySelector(".label__course-status")
          ?.parentElement?.classList.contains("scene-label__text"),
      ).toBe(true);
      expect(button.querySelector(".label__course-status")?.textContent).toBe("改写中");
      expect(button.getAttribute("aria-label")).toBeNull();
    },
  );

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
