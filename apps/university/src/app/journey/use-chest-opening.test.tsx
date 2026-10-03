// @vitest-environment jsdom
import { act, useSyncExternalStore, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProgressPort,
  knowledgeAlbum,
  lessonKey,
  progressSourceOf,
  type AlbumCourse,
  type ConceptHead,
  type Keepsake,
  type ProgressPort,
} from "@pieai/university-core";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import type { ChestRewards } from "@pieai/university-ui/path/ChestRewards.js";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";

const state = vi.hoisted(() => ({ port: null as ProgressPort | null }));
vi.mock("../../progress/store", () => ({
  get progressPort() {
    return state.port;
  },
  snapshot: () => state.port!.snapshot(),
}));
import { useChestOpening } from "./use-chest-opening";
import type { GuestAdoption, GuestAdoptionSnapshot } from "../../account/guest-adoption";

const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" };
const heads: readonly ConceptHead[] = [
  {
    id: "one",
    zh: "一个概念",
    en: "One",
    category: "ai",
    group: "test",
    tagline: "A real linked concept",
  },
];
const course: AlbumCourse = {
  studyId: "s",
  domainId: "ai-foundations",
  id: "c",
  title: "Course",
  isDefault: true,
  units: [
    {
      id: "u",
      title: "Unit",
      lessons: [{ id: "l", contentRevision: 1, exerciseIds: [], conceptIds: ["one"] }],
    },
  ],
};
const lessons = [{ ...locator, state: "live" }] as unknown as readonly LessonPlacement[];
let host: HTMLDivElement, root: Root;
let result: ReturnType<typeof useChestOpening>;
let sourceReady = true;
let adoption: GuestAdoption | undefined;
let paint = false;
let keepsakeFor: Keepsake | undefined;
function controlledAdoption() {
  let snapshot: GuestAdoptionSnapshot = { scope: {}, ready: true };
  const observers = new Set<() => void>();
  adoption = {
    getSnapshot: () => snapshot,
    subscribe: (callback) => {
      observers.add(callback);
      return () => {
        observers.delete(callback);
      };
    },
    connect: () => () => {},
    create: async () => {},
  };
  return (ready: boolean, replaceScope = false) => {
    snapshot = { scope: replaceScope ? {} : snapshot.scope, ready };
    const recipients = [...observers];
    for (const callback of recipients) callback();
  };
}
const done = vi.fn();
const readAlbum = () =>
  sourceReady
    ? knowledgeAlbum(heads, [course], progressSourceOf(state.port!), state.port!.snapshot())
    : null;
function Probe() {
  useSyncExternalStore(state.port!.subscribe, state.port!.snapshot);
  result = useChestOpening({
    lessonOpen: locator,
    lessons,
    guardName: () => "Guard",
    onLessonDone: done,
    readAlbum,
    courseTitle: course.title,
    guestAdoption: adoption,
    keepsakeOf: () => keepsakeFor,
  });
  return paint ? result.overlay : null;
}
const card = () => (result.overlay as ReactElement<Parameters<typeof ChestRewards>[0]>).props;
async function render() {
  await act(async () =>
    root.render(
      <InterfaceLanguageProvider locale="en">
        <Probe />
      </InterfaceLanguageProvider>,
    ),
  );
}
async function finish() {
  await act(async () => {
    state.port!.advanceLesson(lessonKey("s", "c", "l"), 1);
    state.port!.confirmLessonRead(lessonKey("s", "c", "l"), 1);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.port = createProgressPort({
    persistence: {
      read: () => null,
      write: () => undefined,
      readAccount: () => null,
      writeAccount: () => undefined,
    },
  });
  sourceReady = true;
  done.mockReset();
  adoption = undefined;
  paint = false;
  keepsakeFor = undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("chest rewards and callbacks keep their original record and owner", () => {
  it("shows this level's already collected cards on a repeat without announcing another new award", async () => {
    await finish();
    await render();
    const record = JSON.stringify(state.port!.snapshot());
    await act(async () => result.begin(locator));
    expect(card().reward.knowledgeCards).toBe(0);
    expect(card().knowledgeCards?.map((item) => item.head.id)).toEqual(["one"]);
    expect(card().reward.xp).toBe(0);
    expect(JSON.stringify(state.port!.snapshot())).toBe(record);
  });
  it("reveals only newly collected authored concepts and the genuinely completed course", async () => {
    await render();
    await finish();
    await act(async () => result.begin(locator));
    expect(card().reward.knowledgeCards).toBe(1);
    expect(card().knowledgeCards?.map((item) => item.head.id)).toEqual(["one"]);
    expect(card().completion).toBeTruthy();
    const record = JSON.stringify(state.port!.snapshot());
    await act(async () => result.opening!.onTap?.());
    await act(async () => result.opening!.onPhase?.("settled"));
    expect(card().stage).toBe("rewards");
    expect(JSON.stringify(state.port!.snapshot())).toBe(record);
  });
  it("does not invent a new course badge when the before-shelf was unavailable", async () => {
    sourceReady = false;
    await render();
    sourceReady = true;
    await finish();
    await act(async () => result.begin(locator));
    expect(card().reward.knowledgeCards).toBe(0);
    expect(card().completion).toBeNull();
    expect(card().reward.badges.some((badge) => badge.id === "first-course")).toBe(false);
  });
  it("rejects the old scene's settlement callback after another chest starts", async () => {
    await render();
    await finish();
    await act(async () => result.begin(locator));
    const oldScene = result.opening!;
    await act(async () => oldScene.onTap?.());
    await act(async () => result.begin(locator));
    await act(async () => oldScene.onPhase?.("settled"));
    expect(card().stage).toBe("closed");
  });
  it("does not let an old close timer clear the next chest or navigate back to the old lesson", async () => {
    vi.useFakeTimers();
    await render();
    await finish();
    await act(async () => result.begin(locator));
    await act(async () => card().onContinue());
    await act(async () => result.begin(locator));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.active).toBe(true);
    expect(card().stage).toBe("closed");
    expect(done).not.toHaveBeenCalled();
  });
  it("does not reopen the chest when a late star callback arrives after Continue", async () => {
    vi.useFakeTimers();
    await render();
    await finish();
    await act(async () => result.begin(locator));
    await act(async () => card().onOpen());
    await act(async () => result.opening!.onPhase?.("settled"));
    await act(async () => card().onThrow());
    const starDone = result.opening!.throwing!.onDone!;
    // The existing six-second fallback wins the race against a slow scene.
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(card().stage).toBe("done");
    await act(async () => card().onContinue());
    expect(result.overlay).toBeNull();
    // The real renderer may finish during the camera's 950ms return.
    await act(async () => starDone());
    expect(result.overlay, "a stale animation must not resurrect the Continue button").toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(950));
    expect(result.active).toBe(false);
    expect(done).toHaveBeenCalledExactlyOnceWith(locator);
  });
  it("does not detach a pressed button or discard its event while this same guest is being adopted", async () => {
    const change = controlledAdoption();
    paint = true;
    await render();
    await finish();
    await act(async () => result.begin(locator));
    const button = host.querySelector<HTMLButtonElement>('[data-chest-action="open"]')!;
    const receipt = JSON.stringify(state.port!.snapshot());
    await act(async () => change(false));
    expect(host.querySelector('[data-chest-action="open"]')).toBe(button);
    await act(async () => button.click());
    expect(result.opening?.started).toBe(true);
    await act(async () => result.opening!.onPhase?.("settled"));
    await act(async () => change(true));
    expect(card().stage).toBe("rewards");
    expect(JSON.stringify(state.port!.snapshot())).toBe(receipt);
  });
  it("defers Continue's navigation until local adoption completes and still refuses a replaced scope", async () => {
    vi.useFakeTimers();
    const change = controlledAdoption();
    await render();
    await finish();
    await act(async () => result.begin(locator));
    const next = card().onContinue;
    await act(async () => {
      change(false);
      next();
    });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(done).not.toHaveBeenCalled();
    await act(async () => change(true));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(done).toHaveBeenCalledExactlyOnceWith(locator);
    done.mockReset();
    await act(async () => result.begin(locator));
    const oldNext = card().onContinue;
    await act(async () => {
      change(false);
      oldNext();
    });
    await act(async () => change(true, true));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(done).not.toHaveBeenCalled();
    expect(result.active).toBe(false);
  });
  it("hides the old account's receipt immediately and blocks its retained scene actions", async () => {
    await render();
    await finish();
    await act(async () => result.begin(locator));
    const oldScene = result.opening!;
    await act(async () => state.port!.bindAccount("another", null));
    expect(result.active).toBe(false);
    const record = JSON.stringify(state.port!.snapshot());
    await act(async () => {
      oldScene.onTap?.();
      oldScene.onPhase?.("settled");
    });
    expect(result.active).toBe(false);
    expect(JSON.stringify(state.port!.snapshot())).toBe(record);
    expect(done).not.toHaveBeenCalled();
  });
});

describe("a keepsake chest (V7 amendment one)", () => {
  const lighthouse: Keepsake = {
    id: "s/c/course/course",
    tier: "course",
    art: "lighthouse",
    copy: "keepsake.lighthouse",
    studyId: "s",
    courseId: "c",
    unitId: "u",
    anchorLessonId: "l",
  };
  const slot = () =>
    card().keepsake as ReactElement<{ "data-chest-keepsake": string; children: unknown }> | null;
  // The slot shows once the chest's rewards are shown; read it directly.
  const slotText = () =>
    renderToStaticMarkup(
      <InterfaceLanguageProvider locale="en">{slot()}</InterfaceLanguageProvider>,
    );
  it("shows the keepsake as new the first time the lesson is finished", async () => {
    keepsakeFor = lighthouse;
    await render();
    await finish();
    await act(async () => result.begin(locator));
    expect(slot()?.props["data-chest-keepsake"]).toBe(lighthouse.id);
    expect(slotText()).toContain("A keepsake fell out of the chest");
  });
  it("says it is already home when the finished lesson is finished again", async () => {
    keepsakeFor = lighthouse;
    await finish();
    await render();
    await act(async () => result.begin(locator));
    expect(slotText()).toContain("is already in your house");
    expect(slotText()).not.toContain("A keepsake fell out of the chest");
  });
  it("leaves no keepsake slot when the lesson has none", async () => {
    await render();
    await finish();
    await act(async () => result.begin(locator));
    expect(card().keepsake).toBeFalsy();
  });
});
