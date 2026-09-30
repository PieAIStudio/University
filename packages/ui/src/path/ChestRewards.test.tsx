import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import type { ChestReward } from "@pieai/university-core";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ChestRewards } from "./ChestRewards.js";

const REWARD: ChestReward = {
  xp: 40,
  levelBefore: 1,
  levelAfter: 2,
  reviewCards: 3,
  knowledgeCards: 0,
  streakDay: 1,
  badges: [{ id: "first-lesson", name: "上路", how: "", earned: true, progress: 1 }],
  allFirstTry: false,
};

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

const handlers = () => ({
  onOpen: vi.fn(),
  onSkip: vi.fn(),
  onThrow: vi.fn(),
  onContinue: vi.fn(),
});
function show(props: Partial<ComponentProps<typeof ChestRewards>> = {}) {
  const all = {
    stage: "rewards" as const,
    tier: "wood" as const,
    upgraded: false,
    reward: REWARD,
    dailyFirst: false,
    lessonNumber: 3,
    reducedMotion: false,
    ...handlers(),
    ...props,
  };
  act(() => root.render(withInterfaceLocale(<ChestRewards {...all} />)));
  return all;
}
const lines = () => [...host.querySelectorAll(".chest-rewards__line")];
const action = (name: string) =>
  host.querySelector<HTMLButtonElement>(`[data-chest-action="${name}"]`);

it("waits for one tap, then offers to skip while the chest plays", () => {
  const props = show({ stage: "closed" });
  expect(lines()).toHaveLength(0);
  act(() => action("open")!.click());
  expect(props.onOpen).toHaveBeenCalledOnce();
  show({ stage: "opening" });
  expect(action("open")).toBeNull();
  expect(action("skip")).not.toBeNull();
});

it("reveals the record's rewards one at a time, the badge last and largest", () => {
  show();
  expect(lines()).toHaveLength(0);
  for (let step = 1; step <= 5; step += 1) {
    act(() => vi.advanceTimersByTime(450));
    expect(lines()).toHaveLength(step);
  }
  const last = lines().at(-1)!;
  expect(last.classList.contains("chest-rewards__line--badge")).toBe(true);
  expect(last.textContent).toContain("上路");
});

it("shows no line for a number the record does not support", () => {
  show({ reward: { ...REWARD, levelAfter: 1, reviewCards: 0, badges: [] }, reducedMotion: true });
  // XP and the streak day only: no level, no cards, no knowledge cards, no badge.
  expect(lines()).toHaveLength(2);
});

it("puts every reward up at once under reduced motion", () => {
  show({ reducedMotion: true });
  expect(lines()).toHaveLength(5);
});

it.each(["rewards", "throwing", "done"] as const)(
  "renders the complete reduced-motion reward list in the first %s commit, without an effect",
  (stage) => {
    // Static rendering runs no effects. The full browser gate caught a commit
    // labelled 'rewards' whose list was still empty until the passive effect.
    const markup = renderToStaticMarkup(
      withInterfaceLocale(
        <ChestRewards
          {...handlers()}
          stage={stage}
          tier="wood"
          upgraded={false}
          reward={REWARD}
          dailyFirst={false}
          reducedMotion
        />,
      ),
    );
    const captured = document.createElement("div");
    captured.innerHTML = markup;
    expect(captured.querySelectorAll(".chest-rewards__line")).toHaveLength(5);
    const next = captured.querySelector('[data-chest-action="continue"]');
    // A throw already in flight still belongs to the scene owner. Only a
    // rewards/done stage can navigate away, even after changing preferences.
    if (stage === "throwing") expect(next).toBeNull();
    else expect(next).not.toBeNull();
  },
);

it.each(["closed", "opening"] as const)(
  "does not expose reduced-motion rewards or completion before the %s chest settles",
  (stage) => {
    show({ stage, reducedMotion: true, completion: <span data-course-completion /> });
    expect(lines()).toHaveLength(0);
    expect(host.querySelector("[data-course-completion]")).toBeNull();
    expect(action("continue")).toBeNull();
  },
);

it("offers the star throw when a monster stands next, and Continue when none does", () => {
  const guarded = show({ reducedMotion: true, guardName: "怕问错蛙" });
  expect(action("continue")).toBeNull();
  act(() => action("throw")!.click());
  expect(guarded.onThrow).toHaveBeenCalledOnce();
  show({ stage: "done", reducedMotion: true, guardName: "怕问错蛙" });
  expect(action("throw")).toBeNull();
  expect(action("continue")).not.toBeNull();
  const open = show({ reducedMotion: true, guardName: null });
  expect(action("throw")).toBeNull();
  act(() => action("continue")!.click());
  expect(open.onContinue).toHaveBeenCalledOnce();
});

it("names the region by its lesson and chest", () => {
  show({ stage: "closed", tier: "legendary", lessonNumber: 7 });
  const label = host.querySelector("section")!.getAttribute("aria-label")!;
  expect(label).toMatch(/7/);
});
