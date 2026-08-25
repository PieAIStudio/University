// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Mistake } from "@pieai/university-core";
import type { ContentPort, MistakeExercise } from "../content/port.js";
import { MistakeList, MistakesEntry } from "./MistakeList.js";

const LOCATOR = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
} as const;

const EXERCISE: MistakeExercise = {
  id: "exercise",
  lessonTitle: "第一课",
  title: "问题",
  prompt: "题目本身",
  correctAnswer: "正确答案",
  contentRevision: 1,
};

function mistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    locator: LOCATOR,
    exerciseId: "exercise",
    contentRevision: 1,
    wrongAnswer: "我当时的答案",
    wrongAt: "2026-08-26T09:00:00.000Z",
    wrongCount: 2,
    corrected: false,
    ...overrides,
  };
}

function content(exercise: MistakeExercise | null): ContentPort {
  return {
    knownStudies: [],
    async studies() {
      return [];
    },
    async shelf() {
      return { studies: [] };
    },
    async lesson() {
      throw new Error("not used");
    },
    async exercise() {
      if (!exercise) throw new Error("课程内容已取不到");
      return exercise;
    },
    async card() {
      throw new Error("not used");
    },
    async notes() {
      return [];
    },
    noteEvidenceBase() {
      return "";
    },
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

async function renderList(
  mistakes: readonly Mistake[],
  port: ContentPort = content(EXERCISE),
): Promise<void> {
  await act(async () => {
    root.render(<MistakeList mistakes={mistakes} content={port} onOpenLesson={() => undefined} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("MistakesEntry", () => {
  it("does not render an entry when the book has no rows", () => {
    expect(renderToStaticMarkup(<MistakesEntry count={0} hasMistakes={false} />)).toBe("");
  });

  it("shows the uncorrected count without a noisy zero badge", () => {
    const open = renderToStaticMarkup(<MistakesEntry count={3} hasMistakes />);
    const done = renderToStaticMarkup(<MistakesEntry count={0} hasMistakes />);
    expect(open).toContain("错题本");
    expect(open).toContain(">3<");
    expect(done).toContain("已订正");
    expect(done).not.toContain(">0<");
  });
});

describe("MistakeList", () => {
  it("shows the question, both answers, count, date, and lesson action", async () => {
    await renderList([mistake()]);
    const text = container.textContent ?? "";
    expect(text).toContain("题目本身");
    expect(text).toContain("我当时的答案");
    expect(text).toContain("正确答案");
    expect(text).toContain("共错 2 次");
    expect(text).toContain("回到这课");
  });

  it("keeps a row visible as 你答过 when its content cannot be read", async () => {
    await renderList([mistake()], content(null));
    const text = container.textContent ?? "";
    expect(text).toContain("你答过：我当时的答案");
    expect(text).not.toContain("正确答案");
  });

  it("celebrates a book whose rows are all corrected", async () => {
    await renderList([
      mistake({
        corrected: true,
        correctedAt: "2026-08-26T10:00:00.000Z",
      }),
    ]);
    expect(container.textContent).toContain("都订正好了");
    expect(container.textContent).toContain("已订正");
  });

  it("does not render a question from an older content revision", async () => {
    await renderList(
      [
        mistake({
          contentRevision: 1,
        }),
      ],
      content({ ...EXERCISE, contentRevision: 2 }),
    );
    expect(container.textContent).toContain("这道题已经换版");
    expect(container.textContent).not.toContain("题目本身");
  });
});
