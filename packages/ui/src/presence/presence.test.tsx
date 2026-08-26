// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryPresencePort, CURSOR_BROADCAST_INTERVAL_MS } from "@pieai/university-core";

import { CompanionCursors, CompanionMarkers } from "./CompanionOverlay.js";
import { stepCursor } from "./interpolate.js";
import { presenceAnchorId } from "./anchors.js";
import { SettingsScreen } from "../navigation/empty/SettingsScreen.js";

const AT_LESSON = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonId: "you-already-know-apps",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});

describe("presence fixture", () => {
  it("seeds the requested companions in development", async () => {
    window.history.replaceState({}, "", "/?presence-fixture");
    vi.stubEnv("DEV", true);
    vi.resetModules();

    const { createBrowserPresencePort } = await import("./store.js");
    const port = createBrowserPresencePort();

    expect(new Set(port.snapshot().peers.map((peer) => peer.userId))).toEqual(
      new Set(["fixture-ada", "fixture-lin"]),
    );
  });

  it("ignores the query parameter in a production build", async () => {
    window.history.replaceState({}, "", "/?presence-fixture");
    vi.stubEnv("DEV", false);
    vi.resetModules();

    const { createBrowserPresencePort } = await import("./store.js");
    const port = createBrowserPresencePort();

    expect(port.snapshot().peers).toEqual([]);
  });
});

describe("CompanionMarkers", () => {
  it("puts a group-mate's name in the DOM next to their lesson, never in a canvas", async () => {
    const ada = createMemoryPresencePort({
      self: { userId: "ada", displayName: "Ada" },
      seeAs: { grace: "group" },
    });
    const grace = createMemoryPresencePort({
      self: { userId: "grace", displayName: "Grace" },
      bus: ada.bus,
      seeAs: { ada: "group" },
    });
    grace.publishLocation(AT_LESSON);

    await act(async () => {
      root.render(
        <CompanionMarkers peers={ada.snapshot().peers} surface="course" attach={() => undefined} />,
      );
    });

    expect(container.textContent).toContain("Grace");
    expect(container.textContent).toContain("在这关");
    expect(container.textContent).not.toContain("在这门课");
    expect(container.querySelector("canvas")).toBeNull();
    const chip = container.querySelector<HTMLElement>(".companion");
    expect(chip?.dataset.anchor).toBe(presenceAnchorId(ada.snapshot().peers[0]!, "course"));
  });

  it("hides the lesson from a friend and does not render a cursor for them", async () => {
    const ada = createMemoryPresencePort({
      self: { userId: "ada", displayName: "Ada" },
      seeAs: { lin: "friend" },
    });
    const lin = createMemoryPresencePort({
      self: { userId: "lin", displayName: "Lin" },
      bus: ada.bus,
      seeAs: { ada: "group" },
    });
    lin.publishLocation(AT_LESSON);
    lin.publishCursor({ x: 0.2, y: 0.3, viewKey: "world" });

    await act(async () => {
      root.render(
        <>
          <CompanionMarkers peers={ada.snapshot().peers} surface="world" attach={() => undefined} />
          <CompanionCursors peers={ada.snapshot().peers} viewKey="world" />
        </>,
      );
    });

    expect(container.textContent).toContain("Lin");
    expect(container.textContent).toContain("在这门课");
    expect(container.textContent).not.toContain("在这关");
    expect(container.querySelector(".companion-cursor")).toBeNull();
  });
});

describe("CompanionCursors", () => {
  it("draws a following cursor that cannot steal clicks", async () => {
    const ada = createMemoryPresencePort({
      self: { userId: "ada", displayName: "Ada" },
      seeAs: { grace: "group" },
    });
    const grace = createMemoryPresencePort({
      self: { userId: "grace", displayName: "Grace" },
      bus: ada.bus,
      seeAs: { ada: "group" },
    });
    grace.publishCursor({ x: 0.4, y: 0.5, viewKey: "world" });

    await act(async () => {
      root.render(<CompanionCursors peers={ada.snapshot().peers} viewKey="world" />);
    });

    const layer = container.querySelector<HTMLElement>(".companion-cursors");
    const cursor = container.querySelector<HTMLElement>(".companion-cursor");
    expect(cursor).not.toBeNull();
    expect(cursor?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.style.pointerEvents).toBe("none");
  });
});

describe("stepCursor", () => {
  it("moves toward the latest sample instead of snapping to it", () => {
    const stepped = stepCursor({ x: 0, y: 0 }, { x: 1, y: 0 }, CURSOR_BROADCAST_INTERVAL_MS / 2);
    expect(stepped.x).toBeGreaterThan(0);
    expect(stepped.x).toBeLessThan(1);
    expect(stepCursor({ x: 0, y: 0 }, { x: 1, y: 0 }, CURSOR_BROADCAST_INTERVAL_MS).x).toBe(1);
  });
});

describe("SettingsScreen presence", () => {
  it("offers a switch whose off position really stops broadcasting", async () => {
    const ada = createMemoryPresencePort({
      self: { userId: "ada", displayName: "Ada" },
      seeAs: { grace: "group" },
    });
    const grace = createMemoryPresencePort({
      self: { userId: "grace", displayName: "Grace" },
      bus: ada.bus,
      seeAs: { ada: "group" },
    });
    ada.publishLocation(AT_LESSON);
    expect(grace.snapshot().peers).toHaveLength(1);

    await act(async () => {
      root.render(<SettingsScreen presence={ada} />);
    });
    expect(container.textContent).toContain("让小组看到我在学什么");

    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("让小组看到我在学什么"),
    );
    expect(toggle).toBeDefined();
    await act(async () => {
      toggle?.click();
    });
    expect(ada.snapshot().sharesPresence).toBe(false);
    expect(grace.snapshot().peers).toHaveLength(0);
    const cursors = ada.bus.cursorSends;
    ada.publishCursor({ x: 0.1, y: 0.1, viewKey: "world" });
    expect(ada.bus.cursorSends).toBe(cursors);
  });

  it("keeps the settings page working without a presence port", () => {
    const markup = renderToStaticMarkup(<SettingsScreen />);
    expect(markup).toContain("偏好设置");
    expect(markup).not.toContain("让小组看到我在学什么");
  });
});
