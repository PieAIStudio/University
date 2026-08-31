// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SourceAccessPort, SourceCheckout } from "@pieai/university-core";

import { LessonSourceVersion } from "./LessonSourceVersion.js";

const EXPLANATION = {
  kind: "explanation" as const,
  title: "打开正在学习的 App",
  whatItDoes: "取出这节课钉住的源码版本。",
  whyUnavailable: "交付端拿到的是已发布的课程包。",
  futureSupport: "以后会在桌面端提供项目检出。",
};

const CHECKOUT: SourceCheckout = {
  snapshotId: "snap",
  path: "/tmp/lesson",
  created: true,
  run: ["pnpm start"],
};

function explanationPort(): SourceAccessPort {
  return {
    lessonVersion: () => EXPLANATION,
    closeLessonVersion: () => EXPLANATION,
    uaDashboard: () => EXPLANATION,
    layerCoverage: async () => EXPLANATION,
  };
}

function actionPort(run = async () => CHECKOUT): SourceAccessPort {
  return {
    lessonVersion: () => ({ kind: "action", run }),
    closeLessonVersion: () => ({ kind: "action", run: async () => undefined }),
    uaDashboard: () => EXPLANATION,
    layerCoverage: async () => EXPLANATION,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelector("dialog")?.remove();
});

describe("LessonSourceVersion honest entry", () => {
  it("says this shell cannot open the app before the learner clicks", async () => {
    await act(async () => {
      root.render(
        <LessonSourceVersion
          studyId="turing-pact"
          sourceCommit="3b402e069a5db5fe9eb82dbc03aa05152b3d298b"
          sourceAccess={explanationPort()}
        />,
      );
    });

    expect(container.querySelector("[data-parity-control='lesson-source-version']")).not.toBeNull();
    expect(container.querySelector("[data-unavailable]")).not.toBeNull();
    expect(container.textContent).toContain("为什么浏览器打不开这个 App");
    expect(container.textContent).toContain("浏览器端读的是课程包");
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "打开正在学习的 App",
      ),
    ).toBe(false);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("still opens the explanation when the honest control is pressed", async () => {
    await act(async () => {
      root.render(
        <LessonSourceVersion
          studyId="turing-pact"
          sourceCommit="3b402e069a5db5fe9eb82dbc03aa05152b3d298b"
          sourceAccess={explanationPort()}
        />,
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-parity-control='lesson-source-version']",
    );
    if (!trigger) throw new Error("missing source-version control");
    await act(async () => {
      trigger.click();
    });
    const dialog = document.querySelector("dialog");
    expect(dialog?.textContent).toContain("为什么这一端现在做不到");
    expect(dialog?.textContent).toContain("交付端拿到的是已发布的课程包");
  });

  it("keeps the live checkout label when the port can actually open the app", async () => {
    const run = async () => CHECKOUT;
    await act(async () => {
      root.render(
        <LessonSourceVersion
          studyId="turing-pact"
          sourceCommit="3b402e069a5db5fe9eb82dbc03aa05152b3d298b"
          sourceAccess={actionPort(run)}
        />,
      );
    });
    expect(container.textContent).toContain("打开正在学习的 App");
    expect(container.textContent).not.toContain("为什么浏览器打不开这个 App");
    expect(container.querySelector("[data-unavailable]")).toBeNull();
  });
});
