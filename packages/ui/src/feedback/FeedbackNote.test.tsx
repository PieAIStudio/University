// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeedbackPort, FeedbackSubmission } from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FeedbackNote } from "./FeedbackNote.js";

let container: HTMLDivElement;
let root: Root;
let rail: HTMLElement;
let footer: HTMLElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  rail = document.createElement("nav");
  rail.className = "nav-rail";
  rail.id = "app-shell-rail";
  footer = document.createElement("div");
  footer.id = "app-shell-rail-footer";
  footer.className = "nav-rail__footer";
  rail.append(footer);
  document.body.append(rail);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  rail.remove();
  window.location.hash = "";
});

function dispatchPointerSequence(target: Element) {
  const base = { bubbles: true, cancelable: true, clientX: 8, clientY: 8, button: 0 };
  const pointer =
    typeof PointerEvent === "function"
      ? (type: string, buttons: number) =>
          new PointerEvent(type, {
            ...base,
            buttons,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
      : null;
  const mouse = (type: string, buttons: number) => new MouseEvent(type, { ...base, buttons });
  const fire = (type: string, buttons: number) => {
    if (pointer && type.startsWith("pointer")) target.dispatchEvent(pointer(type, buttons));
    else target.dispatchEvent(mouse(type, buttons));
  };
  fire("pointerdown", 1);
  fire("mousedown", 1);
  fire("pointerup", 0);
  fire("mouseup", 0);
  fire("click", 0);
}

describe("FeedbackNote in the rail", () => {
  it("docks 提意见 in the rail footer as a button that is not a page link", async () => {
    await act(async () => {
      root.render(<FeedbackNote shell="在线端" />);
    });
    const docked = footer.querySelector("button");
    expect(docked).toBeTruthy();
    expect(docked?.textContent).toContain("提意见");
    expect(docked?.tagName).toBe("BUTTON");
    expect(docked?.getAttribute("href")).toBeNull();
    expect(docked?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(docked?.className).toMatch(/nav-rail__/);
    expect(docked?.querySelector(".nav-rail__icon")).toBeTruthy();
    expect(docked?.querySelector(".nav-rail__label")?.textContent).toBe("提意见");
  });

  it("opens a panel from the docked control instead of navigating", async () => {
    const hashBefore = window.location.hash;
    await act(async () => {
      root.render(<FeedbackNote shell="在线端" />);
    });
    const docked = footer.querySelector("button");
    expect(docked).toBeTruthy();
    await act(async () => {
      dispatchPointerSequence(docked!);
    });
    expect(document.querySelector(".feedback-note")).toBeTruthy();
    expect(document.querySelector(".feedback-note textarea")).toBeTruthy();
    expect(window.location.hash).toBe(hashBefore);
    expect(footer.querySelector("a")).toBeNull();
  });

  it("shows the real delivery receipt with lesson context", async () => {
    let submitted: FeedbackSubmission | null = null;
    const port: FeedbackPort = {
      transport: "swimmer-backend",
      async submit(input) {
        submitted = input;
        return {
          id: null,
          submittedAt: "2026-08-27T06:00:00.000Z",
          transport: "swimmer-backend",
        };
      },
      async readMine() {
        return [];
      },
    };
    window.location.hash = "#/lesson/study/course/unit/lesson";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    await act(async () => {
      root.render(
        <FeedbackNote
          shell="在线端"
          port={port}
          lessonTitle="第一节"
          context={{
            locator: { studyId: "study", courseId: "course", unitId: "unit", lessonId: "lesson" },
            contentRevision: 3,
            exerciseAttemptCount: 4,
            signedIn: true,
          }}
        />,
      );
    });
    await act(async () => {
      dispatchPointerSequence(footer.querySelector("button")!);
    });
    const textarea = document.querySelector<HTMLTextAreaElement>(".feedback-note textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(textarea, "这一节我没看懂");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".feedback-note__copy")!.click();
    });

    expect(submitted).toMatchObject({
      message: "这一节我没看懂",
      context: {
        locator: { studyId: "study", courseId: "course", unitId: "unit", lessonId: "lesson" },
        contentRevision: 3,
        exerciseAttemptCount: 4,
        signedIn: true,
        route: "#/lesson/study/course/unit/lesson",
        viewport: [390, 844],
      },
    });
    expect(document.querySelector(".feedback-note")?.textContent).toContain(
      "收到。这条记在《第一节》第 3 版上了。",
    );
    expect(document.querySelector(".feedback-note__copy")?.textContent).toContain("已收到");
  });

  it("does not claim delivery success or copy on a delivery error", async () => {
    const port: FeedbackPort = {
      transport: "swimmer-backend",
      async submit() {
        throw new Error("backend gap");
      },
      async readMine() {
        return [];
      },
    };
    await act(async () => {
      root.render(<FeedbackNote shell="在线端" port={port} />);
    });
    await act(async () => {
      dispatchPointerSequence(footer.querySelector("button")!);
    });
    const textarea = document.querySelector<HTMLTextAreaElement>(".feedback-note textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(textarea, "送不出去也要说实话");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".feedback-note__copy")!.click();
    });

    const panelText = document.querySelector(".feedback-note")?.textContent ?? "";
    expect(panelText).toContain("反馈暂时没有送出");
    expect(panelText).toContain("不会放进剪贴板");
    expect(panelText).not.toContain("已收到 ✓");
  });
});
