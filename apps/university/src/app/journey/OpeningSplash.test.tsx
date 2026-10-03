// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withInterfaceLocale } from "../../../../../packages/ui/test-support/interface-locale";
import { OpeningSplash } from "./OpeningSplash";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("the actual shared splash's admission contract", () => {
  it("offers a web entrance immediately on readiness, never before it and never automatically", async () => {
    const start = vi.fn();
    const render = async (ready: boolean) => {
      await act(async () =>
        root.render(
          withInterfaceLocale(
            <StrictMode>
              <OpeningSplash ready={ready} progress={ready ? 1 : 0.5} onStart={start} />
            </StrictMode>,
          ),
        ),
      );
    };
    await render(false);
    expect(host.querySelector("button")).toBeNull();
    expect(start).not.toHaveBeenCalled();
    await render(true);
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(false);
    expect(start).not.toHaveBeenCalled();
    await act(async () => button.click());
    expect(start).toHaveBeenCalledTimes(1);
  });
  it("an explicit native-host opt-in enters exactly once when ready without requesting a web tap", async () => {
    const start = vi.fn();
    const render = async (ready: boolean) => {
      await act(async () =>
        root.render(
          withInterfaceLocale(
            <StrictMode>
              <OpeningSplash ready={ready} progress={ready ? 1 : 0.5} autoStart onStart={start} />
            </StrictMode>,
          ),
        ),
      );
    };
    await render(false);
    expect(start).not.toHaveBeenCalled();
    await render(true);
    expect(start).toHaveBeenCalledTimes(1);
    await render(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(host.querySelector("button")).toBeNull();
  });
});
