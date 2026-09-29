// @vitest-environment jsdom
import { act, StrictMode, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNerveOpening, type NerveOpeningController } from "@pieai/swimmer-nerve-kit/opening";
import { useJourneyOpening, type JourneyOpening } from "./use-journey-opening.js";

let host: HTMLDivElement, root: Root, controller: NerveOpeningController<ReactNode>;
function Probe({ invitation, ready }: { invitation: JourneyOpening | null; ready: boolean }) {
  useJourneyOpening(controller, invitation, ready);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return state.current ? (
    <section data-key={state.current.key}>
      <p>{state.current.message}</p>
      {state.current.card}
    </section>
  ) : null;
}
const render = async (invitation: JourneyOpening | null, ready = true) => {
  await act(async () =>
    root.render(
      <StrictMode>
        <Probe invitation={invitation} ready={ready} />
      </StrictMode>,
    ),
  );
};
const invitation = (overrides: Partial<JourneyOpening> = {}): JourneyOpening => ({
  key: "completion:one",
  topic: "wrap-up",
  message: "Two saved cards",
  card: <input defaultValue="" />,
  onShown: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  controller = createNerveOpening({ scope: { id: "learner/course" }, now: () => Date.now() });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    controller.dispose();
  });
  host.remove();
  vi.useRealTimers();
});

describe("V7 cards use the installed Nerve opening contract", () => {
  it("offers a valid bounded topic and records only an actually shown card, once", async () => {
    const value = invitation();
    await render(value);
    expect(controller.getSnapshot().current).toBeNull();
    expect(value.onShown).not.toHaveBeenCalled();
    await act(async () => controller.setDeferred(false));
    expect(controller.getSnapshot().current?.topic).toBe("wrap-up");
    expect(value.onShown).toHaveBeenCalledTimes(1);
    await render(value, false);
    await render(value);
    expect(value.onShown).toHaveBeenCalledTimes(1);
    await act(async () => controller.dismiss(controller.getSnapshot().current!.key, "escape"));
    expect(value.onClose).toHaveBeenCalledTimes(1);
  });

  it("updates a save receipt without remounting an unfinished input or replaying the opening", async () => {
    const value = invitation();
    await render(value);
    await act(async () => controller.setDeferred(false));
    const input = host.querySelector("input")!;
    input.value = "unfinished recap";
    const key = controller.getSnapshot().current!.key;
    await render({ ...value, message: "Saved on both devices", card: <input defaultValue="" /> });
    expect(controller.getSnapshot().current!.key).toBe(key);
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("unfinished recap");
    expect(host.textContent).toContain("Saved on both devices");
    expect(value.onShown).toHaveBeenCalledTimes(1);
  });

  it("uses the kit's four-second timer and its pause/resume instead of a competing host timer", async () => {
    vi.useFakeTimers();
    const value = invitation({ autoHideMs: 4000 });
    await render(value);
    await act(async () => controller.setDeferred(false));
    await act(async () => vi.advanceTimersByTimeAsync(3999));
    expect(controller.getSnapshot().current).not.toBeNull();
    await act(async () => controller.setDeferred(true));
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    expect(controller.getSnapshot().current).not.toBeNull();
    await act(async () => controller.setDeferred(false));
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(controller.getSnapshot().current).toBeNull();
    expect(value.onClose).toHaveBeenCalledTimes(1);
  });

  it("retires the visible product card without executing its close callback for a new owner", async () => {
    const value = invitation();
    await render(value);
    await act(async () => controller.setDeferred(false));
    await render(null);
    expect(controller.getSnapshot().current).toBeNull();
    expect(value.onClose).not.toHaveBeenCalled();
  });
});
