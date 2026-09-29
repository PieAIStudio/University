// @vitest-environment jsdom
import { act, StrictMode, useEffect, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import type { NerveOpeningController } from "@pieai/swimmer-nerve-kit/opening";
import type { ReactNode } from "react";
import { withInterfaceLocale } from "../../../../packages/ui/test-support/interface-locale.js";
import { useFirstMeeting, useGuideOpening } from "./use-first-meeting.js";
import type { FirstStoneInvitation, WelcomeInvitation } from "./first-meeting.js";

let host: HTMLDivElement, root: Root;
let current: NerveOpeningController<ReactNode> | null;
const targets = createTargetRegistry();
const noSubscription = () => () => {};
const noSnapshot = () => null;
const immediateLayout = (run: () => void) => {
  run();
  return () => {};
};
const choices = [
  {
    id: "ai-literacy",
    kind: "basics" as const,
    firstLessonTitle: "实际第一关",
    lessonCount: 36,
    lesson: {
      studyId: "ai-literacy",
      courseId: "understanding-ai",
      unitId: "first",
      lessonId: "question",
    },
  },
];
const invitation = (): WelcomeInvitation => ({
  choices,
  onChoose: vi.fn(),
  onBrowse: vi.fn(),
  onSignIn: vi.fn(),
  onDismiss: vi.fn(),
});

function Probe({
  scope,
  value,
  stone = null,
  layout = immediateLayout,
}: {
  scope: string;
  value: WelcomeInvitation | null;
  stone?: FirstStoneInvitation | null;
  layout?: typeof immediateLayout;
}) {
  const controller = useGuideOpening(scope);
  current = controller;
  const meeting = useFirstMeeting({
    scope,
    ready: true,
    targets,
    invitation: value,
    firstStone: stone,
    afterLayout: layout,
    controller,
  });
  const state = useSyncExternalStore(
    controller?.subscribe ?? noSubscription,
    controller?.getSnapshot ?? noSnapshot,
    noSnapshot,
  );
  useEffect(() => {
    controller?.setDeferred(false);
  }, [controller]);
  return (
    <>
      {state?.current?.card}
      {meeting.activity}
    </>
  );
}
const render = async (
  scope: string,
  value: WelcomeInvitation | null,
  stone: FirstStoneInvitation | null = null,
  layout = immediateLayout,
) => {
  await act(async () =>
    root.render(
      withInterfaceLocale(
        <StrictMode>
          <Probe scope={scope} value={value} stone={stone} layout={layout} />
        </StrictMode>,
      ),
    ),
  );
};
const click = async (selector: string) => {
  const node = host.querySelector<HTMLButtonElement>(selector);
  expect(node).not.toBeNull();
  await act(async () => node!.click());
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  current = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  targets.clear();
});

describe("first meeting lifetime belongs to the current learner and map", () => {
  it("survives StrictMode rehearsal and changes pages inside one opening key", async () => {
    const value = invitation();
    await render("guest/world", value);
    const first = current!.getSnapshot().current!;
    expect(first.topic).toBe("welcome");
    expect(host.querySelector('[data-welcome-page="1"]')).not.toBeNull();
    await click("[data-welcome-help]");
    const second = current!.getSnapshot().current!;
    expect(second.key).toBe(first.key);
    expect(second.page).toBe(first.page + 1);
    await click('[data-welcome-experience="never"]');
    await click('[data-welcome-goal="work"]');
    await click("[data-welcome-recommended]");
    expect(value.onChoose).toHaveBeenCalledExactlyOnceWith(choices[0], false);
    expect(value.onDismiss).not.toHaveBeenCalled();
    expect(current!.getSnapshot().current).toBeNull();
  });

  it("disposes the old owner and rejects a delayed button from that owner's opening", async () => {
    const previous = invitation(),
      next = invitation();
    await render("guest/world", previous);
    const oldController = current!;
    const card = oldController.getSnapshot().current!.card as React.ReactElement<{
      onChoose: (id: string) => void;
    }>;
    await render("account/world", next);
    expect(oldController.getSnapshot().closed).toBe(true);
    await act(async () => card.props.onChoose("ai-literacy"));
    expect(previous.onChoose).not.toHaveBeenCalled();
    expect(next.onChoose).not.toHaveBeenCalled();
    expect(current!.getSnapshot().current?.topic).toBe("welcome");
  });

  it("close acknowledges the current welcome once without inventing a selection", async () => {
    const value = invitation();
    await render("guest/world", value);
    const key = current!.getSnapshot().current!.key;
    await act(async () => {
      current!.dismiss(key, "escape");
    });
    expect(value.onDismiss).toHaveBeenCalledTimes(1);
    expect(value.onChoose).not.toHaveBeenCalled();
    expect(current!.getSnapshot().current).toBeNull();
    await render("guest/world", value);
    expect(current!.getSnapshot().current).toBeNull();
  });

  it("does not declare a target unavailable while the camera is still framing it", async () => {
    const layout = vi.fn(immediateLayout);
    const stone = {
      id: "guest:first",
      lessonId: "question",
      ready: false,
      onEnter: vi.fn(),
      onDismiss: vi.fn(),
    };
    await render("guest/course", null, stone, layout);
    expect(layout).not.toHaveBeenCalled();
    expect(host.querySelector('[data-welcome-page="3"]')).toBeNull();
    await render("guest/course", null, { ...stone, ready: true }, layout);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-first-stone-state="unavailable"]')).not.toBeNull();
  });

  it("a delayed post-close measurement cannot revive a stone after leaving that scope", async () => {
    const callbacks: (() => void)[] = [];
    const layout = (run: () => void) => {
      callbacks.push(run);
      return () => {};
    };
    const stone = {
      id: "guest:first",
      lessonId: "question",
      ready: true,
      onEnter: vi.fn(),
      onDismiss: vi.fn(),
    };
    await render("guest/course", null, stone, layout);
    const late = [...callbacks];
    await render("account/world", null, null, layout);
    await act(async () => {
      for (const callback of late) callback();
    });
    expect(host.querySelector('[data-welcome-page="3"]')).toBeNull();
    expect(stone.onEnter).not.toHaveBeenCalled();
  });

  it("discards a cancelled measurement even when the same stone becomes ready again", async () => {
    const callbacks: (() => void)[] = [];
    // Deliberately retain callbacks after cancellation to test the ownership
    // check independently of the layout scheduler's ordinary cleanup.
    const layout = (run: () => void) => {
      callbacks.push(run);
      return () => {};
    };
    const stone = {
      id: "guest:first",
      lessonId: "question",
      ready: true,
      onEnter: vi.fn(),
      onDismiss: vi.fn(),
    };
    await render("guest/course", null, stone, layout);
    const cancelled = [...callbacks];
    await render("guest/course", null, { ...stone, ready: false }, layout);
    await act(async () => {
      for (const callback of cancelled) callback();
    });
    await render("guest/course", null, stone, layout);
    expect(host.querySelector('[data-welcome-page="3"]')).toBeNull();
    await act(async () => callbacks.at(-1)!());
    expect(host.querySelector('[data-first-stone-state="unavailable"]')).not.toBeNull();
    expect(stone.onEnter).not.toHaveBeenCalled();
  });
});
