// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecoveryState, type RecoveryReason } from "./RecoveryState.js";

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
});

describe("RecoveryState", () => {
  it.each<RecoveryReason>(["context-lost", "webgl-unavailable", "scene-timeout", "content"])(
    "explains %s in the DOM and offers a retry",
    async (reason) => {
      await act(async () => {
        root.render(<RecoveryState reason={reason} onRetry={vi.fn()} />);
      });

      const state = container.querySelector(`[data-recovery-state="${reason}"]`);
      expect(state).not.toBeNull();
      expect(state?.textContent?.length).toBeGreaterThan(20);
      expect(state?.querySelector("button")).not.toBeNull();
    },
  );

  it("keeps both exits as native buttons", async () => {
    const retry = vi.fn();
    const continue_ = vi.fn();
    await act(async () => {
      root.render(
        <RecoveryState
          reason="scene-timeout"
          onRetry={retry}
          onContinue={continue_}
          continueLabel="先看课文"
        />,
      );
    });

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    buttons[0]?.click();
    buttons[1]?.click();
    expect(retry).toHaveBeenCalledOnce();
    expect(continue_).toHaveBeenCalledOnce();
  });

  it("marks map recovery as an overlay without hiding it from hit testing", async () => {
    await act(async () => {
      root.render(<RecoveryState reason="context-lost" onRetry={vi.fn()} overlay />);
    });

    const state = container.querySelector("[data-recovery-state]");
    expect(state?.classList.contains("recovery-state--overlay")).toBe(true);
  });
});
