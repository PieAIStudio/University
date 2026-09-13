// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectActivity } from "@pieai/university-core";
import { ConnectGame } from "./ConnectGame.js";

function board(rows: readonly number[]): ConnectActivity {
  return {
    kind: "connect",
    id: "how-a-click-travels",
    title: "点击怎么走完一趟",
    brief: "把每一步接到它真正引发的下一步。",
    goal: "说得出一次点击经过了哪些站。",
    takeaway: "每一步都得有人接住，否则就停在那里。",
    hint: "先找会触发下一步的那个动作。",
    source: { label: "MDN", url: "https://developer.mozilla.org/" },
    nodes: rows.map((y, index) => ({
      id: `n${index}`,
      label: `节点 ${index}`,
      note: "说明",
      x: 16 + (index % 3) * 34,
      y,
    })),
    edges: [{ from: "n0", to: "n1", why: "点击触发请求" }],
    probes: [{ label: "正常一趟", path: ["n0", "n1"] }],
  } as ConnectActivity;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(activity: ConnectActivity): HTMLElement {
  act(() => {
    root.render(<ConnectGame activity={activity} disabled={false} onAttempt={() => {}} />);
  });
  return container.querySelector<HTMLElement>(".play-connect__board")!;
}

describe("connect board height", () => {
  /*
    The board was a flat 288px whatever the layout, which fits the two rows
    every example happened to use and silently overlaps a third. A node is 88px
    tall, so three rows sharing 288px cannot all be drawn — and that stopped
    being hypothetical when the difficulty picker made a seven-node challenge
    board reachable: three cards drew on top of each other.
  */
  it("keeps the standard height for a two-row layout", () => {
    expect(render(board([25, 25, 25, 75, 75, 75])).style.height).toBe("288px");
  });

  it("grows for a third row instead of stacking nodes", () => {
    const height = Number.parseInt(render(board([25, 25, 25, 50, 75, 75, 75])).style.height, 10);
    expect(height).toBeGreaterThanOrEqual(420);
  });
});

describe("connect first visible layout", () => {
  it("uses the measured phone width before ResizeObserver's first notification", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(261);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = vi.fn();
      },
    );

    const element = render(board([25, 25, 75, 75]));
    expect(observe).toHaveBeenCalled();
    expect(element.dataset.compact).toBe("true");
    expect(
      [...element.querySelectorAll<HTMLElement>(".play-connect__node")].map(
        (node) => node.style.insetInlineStart,
      ),
    ).toEqual(["25%", "75%", "25%", "75%"]);
  });

  it("does not reinterpret a hidden zero-width board as a phone layout", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(0);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    expect(render(board([25, 25, 75, 75])).dataset.compact).toBe("false");
  });
});
