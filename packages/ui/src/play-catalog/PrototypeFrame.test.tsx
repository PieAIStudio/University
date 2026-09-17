// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PrototypeFrame } from "./PrototypeFrame.js";

it("does not stop a mounted prototype during StrictMode replay, but stops it on removal", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const postMessage = vi.fn();
  const windowSpy = vi
    .spyOn(HTMLIFrameElement.prototype, "contentWindow", "get")
    .mockReturnValue({ postMessage } as unknown as Window);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let unmounted = false;
  try {
    await act(async () => {
      root.render(
        <StrictMode>
          <PrototypeFrame source="<button>Start</button>" presentation="" title="Test game" />
        </StrictMode>,
      );
    });
    const stopCalls = () => postMessage.mock.calls.filter(([data]) => data.stop === true);
    expect(host.querySelector("iframe")?.isConnected).toBe(true);
    expect(postMessage).toHaveBeenCalled();
    expect(stopCalls()).toHaveLength(0);
    await act(async () => root.unmount());
    unmounted = true;
    expect(stopCalls()).toHaveLength(1);
  } finally {
    if (!unmounted) await act(async () => root.unmount());
    host.remove();
    windowSpy.mockRestore();
  }
});
