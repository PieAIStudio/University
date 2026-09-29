// @vitest-environment jsdom
import { act, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createProgressPort,
  type IdentityStatus,
  type LessonRef,
  type PaymentPort,
  type ProgressPort,
  type View,
} from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { withInterfaceLocale } from "../../../../packages/ui/test-support/interface-locale.js";
import { useJourney } from "./use-journey.js";
import type { WrapUpCard } from "../guide/WrapUpCard.js";

const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "one" };
const course = {
  id: "c",
  title: "Course",
  units: [
    {
      id: "u",
      objective: "Explain it",
      lessons: [
        {
          id: "one",
          title: "First",
          contentRevision: 1,
          exerciseCount: 0,
          exerciseIds: [],
          contentChars: 100,
          cardCount: 0,
          progress: null,
        },
        {
          id: "two",
          title: "Second",
          contentRevision: 1,
          exerciseCount: 0,
          exerciseIds: [],
          contentChars: 100,
          cardCount: 0,
          progress: null,
        },
      ],
    },
  ],
} as unknown as CourseView;
let root: Root, host: HTMLDivElement, progress: ProgressPort;
let current: ReturnType<typeof useJourney>, owner: string | null;
let onAccount: Mock<() => void>, onLesson: Mock<(locator: LessonRef) => void>;
const courseOf = () => course;
const payment = {
  readEntitlements: async () => ({ kind: "unavailable" }),
} as unknown as PaymentPort;
function Probe({ identity }: { identity: IdentityStatus }) {
  const [view, setView] = useState<View>({ kind: "settled", ...locator });
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  current = useJourney({
    view,
    identity,
    progress,
    document,
    payment,
    courseOf,
    onMap: () => setView({ kind: "course", studyId: "s", courseId: "c" }),
    onLesson,
    onAccount,
    onMember: () => {},
    onReview: () => {},
  });
  return current.opening?.card ?? null;
}
const render = async (identity: IdentityStatus = { kind: "unconfigured" }) => {
  await act(async () => root.render(withInterfaceLocale(<Probe identity={identity} />)));
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const port = createProgressPort({ persistence: { read: () => null, write: () => {} } });
  owner = null;
  progress = { ...port, syncState: () => ({ ...port.syncState(), userId: owner }) };
  onAccount = vi.fn<() => void>();
  onLesson = vi.fn<(locator: LessonRef) => void>();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const finish = () => {
  // Isolated deterministic fixture: no exercise in this lesson, current prose
  // explicitly confirmed. Production still reads the completion contract.
  progress.snapshot().lessons["s/c/one"] = {
    progress: 1,
    completedAt: Date.now(),
    attempts: 0,
    readConfirmed: true,
    readConfirmedRevision: 1,
  };
};
describe("journey actions are scoped to a real completion and its learner", () => {
  it("does not turn a result URL or an unconfirmed revision into a completion or prompt", async () => {
    await render();
    await act(async () => current.afterLesson(locator));
    expect(current.opening).toBeNull();
    finish();
    progress.snapshot().lessons["s/c/one"] = {
      ...progress.snapshot().lessons["s/c/one"]!,
      readConfirmedRevision: 2,
    };
    await act(async () => current.afterLesson(locator));
    expect(current.opening).toBeNull();
    expect(progress.accountData().preferences.journey).toBeUndefined();
  });
  it("records the prompt only when shown, and explicit save-only keeps learning data intact", async () => {
    finish();
    await render();
    const before = JSON.stringify(progress.snapshot().lessons);
    await act(async () => current.afterLesson(locator));
    expect(current.opening?.topic).toBe("wrap-up");
    expect(progress.accountData().preferences.journey).toBeUndefined();
    await act(async () => current.opening!.onShown!());
    expect(progress.accountData().preferences.journey?.saveDays).toHaveLength(1);
    const card = current.opening!.card as ReactElement<Parameters<typeof WrapUpCard>[0]>;
    await act(async () => card.props.onSave(false));
    expect(progress.accountData().preferences.reviewEmail?.enabled).toBe(false);
    expect(onAccount).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(progress.snapshot().lessons)).toBe(before);
    expect(current.opening).toBeNull();
  });
  it("a retained old card cannot write consent or navigate after a new account takes ownership", async () => {
    finish();
    await render();
    await act(async () => current.afterLesson(locator));
    const old = current.opening!.card as ReactElement<Parameters<typeof WrapUpCard>[0]>;
    owner = "other";
    await render({
      kind: "signed_in",
      user: { id: owner, email: "synthetic@example.test" },
    } as IdentityStatus);
    await act(async () => {
      old.props.onSave(true);
      old.props.onNext?.();
    });
    expect(current.opening).toBeNull();
    expect(progress.accountData().preferences.reviewEmail).toBeUndefined();
    expect(onAccount).not.toHaveBeenCalled();
    expect(onLesson).not.toHaveBeenCalled();
  });
});
