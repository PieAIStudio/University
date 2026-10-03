// @vitest-environment jsdom
import { act, useSyncExternalStore, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  answerWeeklyBoss,
  compileAnswerKey,
  createProgressPort,
  lessonKey,
  startWeeklyBossRound,
  weeklyBossFlawless,
  weeklyBossFlawlessEventId,
  weeklyBossRoundWon,
  weeklyBossWeek,
  weeklyBossWonEventId,
  weeklyBossHistory,
  type ProgressPort,
} from "@pieai/university-core";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";
import type { WeeklyBossFight } from "@pieai/university-ui/path/WeeklyBossFight.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

const fixture = vi.hoisted(() => ({ port: null as ProgressPort | null, reduced: true }));
vi.mock("../../progress/store", () => ({
  get progressPort() {
    return fixture.port;
  },
  snapshot: () => fixture.port!.snapshot(),
}));
vi.mock("@pieai/university-world", () => ({ usePrefersReducedMotion: () => fixture.reduced }));
vi.mock("@pieai/university-world/learning-nodes.js", () => ({ weeklyBossMarker: () => null }));
vi.mock("../../ports/index", () => ({
  contentPort: {
    lesson: async () => ({
      lesson: { exercises: [{ id: "e", prompt: "Which one?", answerKey: compileAnswerKey("a") }] },
    }),
  },
}));
import { useWeeklyBoss } from "./use-weekly-boss";

const course = {
  id: "c",
  units: [{ id: "u", lessons: ["a", "b", "c", "d", "e"].map((id) => ({ id, title: id })) }],
} as unknown as CourseView;
const courseOf = () => course;
const onChest = vi.fn();
let island: { studyId: string; courseId: string } | null;
let showWorld = false;
let host: HTMLDivElement, root: Root, value: ReturnType<typeof useWeeklyBoss>;
function Probe() {
  const progress = useSyncExternalStore(fixture.port!.subscribe, fixture.port!.snapshot);
  value = useWeeklyBoss({
    progress,
    island,
    lessons: [],
    showWorld,
    courseOf,
    onChest,
    onOpenLesson: () => {},
  });
  return null;
}
async function render() {
  await act(async () =>
    root.render(
      <InterfaceLanguageProvider locale="en">
        <Probe />
      </InterfaceLanguageProvider>,
    ),
  );
}
const fight = () => (value.overlay as ReactElement<Parameters<typeof WeeklyBossFight>[0]>).props;
async function open() {
  await render();
  await act(async () => value.open());
  return fight();
}
async function win() {
  const props = await open();
  let round = startWeeklyBossRound(props.boss, () => 0);
  for (let index = 0; index < 5; index++) {
    const step = answerWeeklyBoss(round, "a");
    round = step.round;
    await act(async () =>
      props.onStrike({
        verdict: "correct",
        hitEventId: step.hitEventId,
        won: weeklyBossRoundWon(round),
        flawless: weeklyBossFlawless(round),
      }),
    );
  }
  return props;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 29, 12));
  fixture.port = createProgressPort({ persistence: { read: () => null, write: () => {} } });
  for (const id of ["a", "b", "c", "d", "e"])
    fixture.port.advanceLesson(lessonKey("s", "c", id), 1);
  fixture.reduced = true;
  showWorld = false;
  island = { studyId: "s", courseId: "c" };
  onChest.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it("persists a flawless witness before the one win, without inventing extra XP or replaying a chest", async () => {
  const week = weeklyBossWeek(Date.now());
  const seen: boolean[] = [];
  const stop = fixture.port!.subscribe(() => {
    const events = fixture.port!.snapshot().xpEvents;
    if (Object.hasOwn(events, weeklyBossWonEventId(week)))
      seen.push(Object.hasOwn(events, weeklyBossFlawlessEventId(week)));
  });
  const props = await win();
  expect(fixture.port!.snapshot().xpEvents[weeklyBossFlawlessEventId(week)]).toBe(0);
  expect(fixture.port!.snapshot().xpEvents[weeklyBossWonEventId(week)]).toBe(50);
  expect(weeklyBossHistory(fixture.port!.snapshot(), Date.now()).weeks[0]!.location).toMatchObject({
    studyId: "s",
    courseId: "c",
  });
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every(Boolean)).toBe(true);
  expect(onChest).toHaveBeenCalledOnce();
  await act(async () =>
    props.onStrike({ verdict: "correct", hitEventId: null, won: true, flawless: true }),
  );
  expect(onChest).toHaveBeenCalledOnce();
  stop();
});

it("rejects an old fight callback after switching accounts before React commits", async () => {
  const props = await open();
  const question = props.boss.pool[0]!;
  await act(async () => {
    await fixture.port!.bindAccount("another-learner", null);
    props.onStrike({
      verdict: "correct",
      hitEventId: `weekly-boss:${props.boss.week}:hit:${question.lessonId}#${question.exerciseId}`,
      won: true,
      flawless: true,
    });
  });
  expect(Object.keys(fixture.port!.snapshot().xpEvents)).toEqual([]);
  expect(onChest).not.toHaveBeenCalled();
});

it("cancels a delayed scene/drop callback when leaving its island", async () => {
  fixture.reduced = false;
  await win();
  const finished = value.scene?.strike;
  expect(finished?.kind).toBe("final");
  expect(onChest).not.toHaveBeenCalled();
  island = null;
  await render();
  await act(async () => {
    if (finished?.kind === "final") finished.onGone?.();
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(onChest).not.toHaveBeenCalled();
});

it("announces an available boss on the overview without mounting its scene or fight", async () => {
  island = null;
  showWorld = true;
  await render();
  expect(value.availableIsland).toEqual({ studyId: "s", courseId: "c" });
  expect(value.scene).toBeNull();
  expect(value.overlay).toBeNull();
  await act(async () => value.open());
  expect(value.overlay).toBeNull();
});

it("rolls Sunday into Monday without remounting, awarding XP or accepting the old fight", async () => {
  vi.setSystemTime(new Date(2026, 9, 4, 23, 59, 59, 700));
  const old = await open();
  expect(old.boss.week).toBe("2026-09-28");
  const before = JSON.stringify(fixture.port!.snapshot());
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(value.scene?.week).toBe("2026-10-05");
  expect(value.overlay).toBeNull();
  await act(async () =>
    old.onStrike({
      verdict: "correct",
      hitEventId: "weekly-boss:2026-09-28:hit:s/c/a#e",
      won: true,
      flawless: true,
    }),
  );
  expect(JSON.stringify(fixture.port!.snapshot())).toBe(before);
  expect(onChest).not.toHaveBeenCalled();
});

it("sees a lesson completed after mounting on the same day", async () => {
  fixture.port = createProgressPort({ persistence: { read: () => null, write: () => {} } });
  for (const id of ["a", "b", "c", "d"]) fixture.port.advanceLesson(lessonKey("s", "c", id), 1);
  await render();
  expect(value.scene).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
    fixture.port!.advanceLesson(lessonKey("s", "c", "e"), 1);
  });
  expect(value.scene?.week).toBe("2026-09-28");
});
