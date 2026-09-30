// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProgressPort,
  createMemoryPersistence,
  compileAnswerKey,
  lessonKeyOf,
  lessonPracticeAttempt,
  mistakesOf,
  type PracticeCourse,
  type LessonPracticeQuestion,
} from "@pieai/university-core";
import type { ContentPort } from "../content/port.js";
import type { LessonView } from "../view/lesson-view.js";
import { InterfaceLanguageProvider } from "../i18n/react.js";
import { LessonPracticeSurface } from "./LessonPracticeSurface.js";

const courses: readonly PracticeCourse[] = [
  {
    studyId: "s",
    id: "c",
    title: "Course",
    units: [
      {
        id: "u",
        lessons: [
          { id: "done", title: "Already finished", contentRevision: 1, exerciseIds: ["q"] },
          { id: "unseen", title: "Never studied", contentRevision: 1, exerciseIds: ["other"] },
        ],
      },
    ],
  },
];
const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "done" };
const question: LessonPracticeQuestion = {
  id: "q",
  ...locator,
  locator,
  exerciseId: "q",
  prompt: "Name the greeting",
  answerKey: compileAnswerKey("hello"),
  courseTitle: "Course",
  lessonTitle: "Already finished",
  lessonNumber: 1,
  contentRevision: 1,
  previousMistake: false,
};
const view = {
  lesson: {
    id: "done",
    contentRevision: 1,
    title: "Already finished",
    exercises: [
      { id: "q", contentRevision: 1, prompt: question.prompt, answerKey: question.answerKey },
    ],
  },
} as unknown as LessonView;
let root: Root, host: HTMLDivElement;
let progress: ReturnType<typeof createProgressPort>;
let content: ContentPort;
const back = vi.fn(),
  open = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  progress = createProgressPort({ persistence: createMemoryPersistence() });
  content = { lesson: vi.fn(async () => view) } as unknown as ContentPort;
  back.mockClear();
  open.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
function finish() {
  progress.confirmLessonRead(lessonKeyOf(locator), 1);
  const { purpose: _purpose, ...original } = lessonPracticeAttempt(
    question,
    "hello",
    "original",
    Date.now() - 2000,
  )!;
  progress.recordExerciseAttempt(original);
  progress.advanceLesson(lessonKeyOf(locator), 1);
}
async function show(locale = "en") {
  await act(async () =>
    root.render(
      <InterfaceLanguageProvider locale={locale}>
        <LessonPracticeSurface
          courses={courses}
          progress={progress}
          content={content}
          onOpenLesson={open}
          onBack={back}
        />
      </InterfaceLanguageProvider>,
    ),
  );
}
const state = () =>
  host.querySelector("[data-practice-state]")?.getAttribute("data-practice-state");
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent === text,
  )!;
async function answer(value: string) {
  const input = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      input,
      value,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("native practice presentation", () => {
  it("never requests an unseen question for a fresh learner", async () => {
    await show();
    expect(state()).toBe("empty");
    expect(content.lesson).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Learn a level first");
  });
  it("uses the completed level, keeps its draft across language changes and records one purpose-bounded answer", async () => {
    finish();
    await show();
    expect(state()).toBe("asking");
    expect(content.lesson).toHaveBeenCalledWith(
      locator,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const xp = progress.snapshot().totalXp;
    await answer("hello");
    const input = host.querySelector("textarea");
    await show("zh-CN");
    expect(host.querySelector("textarea")).toBe(input);
    expect(input?.value).toBe("hello");
    await show();
    await act(async () => {
      button("Submit this answer").click();
      button("Submit this answer").click();
    });
    expect(
      host.querySelector("[data-practice-verdict]")?.getAttribute("data-practice-verdict"),
    ).toBe("correct");
    expect(
      Object.values(progress.snapshot().exerciseAttempts).filter(
        (entry) => entry.purpose === "practice",
      ),
    ).toHaveLength(1);
    expect(progress.snapshot().totalXp).toBe(xp);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-practice-next]")!.click());
    expect(state()).toBe("finished");
  });
  it("prioritises a genuine mistake, shows no reference answer and allows another attempt", async () => {
    finish();
    progress.recordExerciseAttempt(
      lessonPracticeAttempt(question, "planet", "mistake", Date.now())!,
    );
    await show();
    expect(host.querySelector("[data-practice-priority=mistake]")).not.toBeNull();
    await answer("unrelated");
    await act(async () => button("Submit this answer").click());
    expect(host.textContent).not.toContain("hello");
    expect(mistakesOf(progress.snapshot())[0]?.corrected).toBe(false);
    await act(async () => button("Answer again").click());
    await answer("hello");
    await act(async () => button("Submit this answer").click());
    expect(mistakesOf(progress.snapshot())[0]?.corrected).toBe(true);
  });
  it("an empty answer is not a wrong answer or a saved attempt", async () => {
    finish();
    await show();
    await act(async () => button("Submit this answer").click());
    expect(Object.keys(progress.snapshot().exerciseAttempts)).toEqual(["original"]);
    expect(host.querySelector("[data-practice-verdict]")).toBeNull();
  });
  it("fails visibly after a bounded wait; a late old response cannot replace the retried question", async () => {
    vi.useFakeTimers();
    finish();
    let resolveOld!: (view: LessonView) => void;
    const old = new Promise<LessonView>((resolve) => {
      resolveOld = resolve;
    });
    content = {
      lesson: vi.fn().mockReturnValueOnce(old).mockResolvedValue(view),
    } as unknown as ContentPort;
    await show();
    expect(state()).toBe("loading");
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(state()).toBe("failed");
    await act(async () => button("Try again").click());
    expect(state()).toBe("asking");
    await answer("unfinished");
    await act(async () => resolveOld({ lesson: { ...view.lesson, exercises: [] } }));
    expect(state()).toBe("asking");
    expect(host.querySelector("textarea")?.value).toBe("unfinished");
  });
  it("an old account response cannot enter a new account or write its answer", async () => {
    finish();
    let resolveOld!: (view: LessonView) => void;
    content = {
      lesson: vi.fn(
        () =>
          new Promise<LessonView>((resolve) => {
            resolveOld = resolve;
          }),
      ),
    } as unknown as ContentPort;
    await show();
    await act(async () => progress.bindAccount("other", null));
    expect(state()).toBe("empty");
    await act(async () => resolveOld(view));
    expect(state()).toBe("empty");
    expect(progress.snapshot().exerciseAttempts).toEqual({});
  });
  it("leaving aborts only this surface's pending content request", async () => {
    finish();
    content = { lesson: vi.fn(() => new Promise<LessonView>(() => {})) } as unknown as ContentPort;
    await show();
    const signal = vi.mocked(content.lesson).mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(false);
    await act(async () => root.render(<div />));
    expect(signal.aborted).toBe(true);
  });
});
