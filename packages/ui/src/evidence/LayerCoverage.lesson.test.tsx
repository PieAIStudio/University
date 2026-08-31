// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SourceAccessPort, SourceLayerCoverage } from "@pieai/university-core";

import { LayerCoverage } from "./LayerCoverage.js";
import type { EvidenceView } from "../view/lesson-view.js";

const EXPLANATION = {
  kind: "explanation" as const,
  title: "查看项目分层",
  whatItDoes: "按项目分层列出已经引用的文件。",
  whyUnavailable: "交付端没有私有仓库的分析快照。",
  futureSupport: "以后会在桌面端提供已授权的分析快照。",
};

const MAP: SourceLayerCoverage = {
  analysisId: "map-1",
  sourceCommit: "abc123",
  nodeCount: 2,
  outputLanguage: "zh",
  layers: [
    {
      id: "ui",
      name: "界面",
      description: "",
      fileCount: 4,
      citedFileCount: 1,
      citedFiles: ["README.md"],
    },
  ],
  uncharted: [],
};

const EVIDENCE: readonly EvidenceView[] = [
  {
    kind: "fact",
    sourceCommit: "abc123",
    sourcePath: "README.md",
    lineStart: 1,
    lineEnd: 4,
    nodeIds: [],
    note: "README",
  },
  {
    kind: "fact",
    sourceCommit: "abc123",
    sourcePath: "src/app.ts",
    lineStart: 1,
    lineEnd: 8,
    nodeIds: [],
    note: "app",
  },
];

function explanationPort(): SourceAccessPort {
  return {
    lessonVersion: () => EXPLANATION,
    closeLessonVersion: () => EXPLANATION,
    uaDashboard: () => EXPLANATION,
    layerCoverage: async () => EXPLANATION,
  };
}

function actionPort(): SourceAccessPort {
  return {
    lessonVersion: () => EXPLANATION,
    closeLessonVersion: () => EXPLANATION,
    uaDashboard: () => EXPLANATION,
    layerCoverage: async () => ({ kind: "action", run: async () => MAP }),
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

describe("lesson layer coverage when this shell cannot open the map", () => {
  it("shows cited files and an honest label before anyone clicks", async () => {
    await act(async () => {
      root.render(
        <LayerCoverage
          variant="lesson"
          studyId="turing-pact"
          evidence={EVIDENCE}
          sourceAccess={explanationPort()}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("README.md");
    expect(container.textContent).toContain("src/app.ts");
    expect(container.textContent).toContain("为什么这一端没有完整项目分层");
    expect(container.textContent).toContain("课文已经引用的文件可以直接看");
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "查看项目分层",
      ),
    ).toBe(false);
    expect(container.querySelector("[data-parity-control='lesson-layer-coverage']")).not.toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens the explanation only after the honest control is pressed", async () => {
    await act(async () => {
      root.render(
        <LayerCoverage
          variant="lesson"
          studyId="turing-pact"
          evidence={EVIDENCE}
          sourceAccess={explanationPort()}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-parity-control='lesson-layer-coverage']",
    );
    if (!trigger) throw new Error("missing layer-coverage control");
    await act(async () => {
      trigger.click();
    });
    expect(document.querySelector("dialog")?.textContent).toContain("为什么这一端现在做不到");
    expect(document.querySelector("dialog")?.textContent).toContain("交付端没有私有仓库的分析快照");
  });

  it("keeps the live map label when the port can actually open coverage", async () => {
    await act(async () => {
      root.render(
        <LayerCoverage
          variant="lesson"
          studyId="turing-pact"
          evidence={EVIDENCE}
          sourceAccess={actionPort()}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("查看项目分层");
    expect(container.textContent).not.toContain("为什么这一端没有完整项目分层");
  });
});
