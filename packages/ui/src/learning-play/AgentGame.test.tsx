// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAction, AgentActivity } from "@pieai/university-core";
import { activeLocale, setActiveLocale } from "../i18n/index.js";
import { AgentGame } from "./AgentGame.js";
import type { ActivityControls } from "./controls.js";

// Three permitted user steps make a late, unwanted continuation observable in real file content.
const activity: AgentActivity = {
  id: "agent-run-lifecycle",
  kind: "ai-agent",
  title: "Agent run lifecycle",
  brief: "",
  goal: "Complete a draft without changing its source.",
  takeaway: "",
  hint: "",
  source: { label: "Fixture", url: "https://example.com" },
  authorization: "Write the draft. Keep the original table unchanged.",
  files: [
    {
      id: "source",
      path: "/sandbox/source.txt",
      label: "原始表",
      content: "Original records",
      protected: true,
    },
    {
      id: "draft",
      path: "/sandbox/draft.txt",
      label: "草稿",
      content: "",
      protected: false,
    },
  ],
  tools: [
    {
      id: "writer",
      label: "沙盒编辑器",
      description: "Write authorized files.",
      capability: "write",
      taskFileIds: ["draft"],
    },
  ],
  actions: ["Draft v1", "Draft v2", "Final draft"].map<AgentAction>((content, index) => ({
    id: `write-${index + 1}`,
    title: `Draft step ${index + 1}`,
    intent: "Prepare the requested draft.",
    toolId: "writer",
    authority: "user",
    authorityText: "User task",
    inputFileIds: [],
    effects: [
      { fileId: "draft", kind: "replace", content },
      ...(index === 1
        ? [{ fileId: "source", kind: "replace" as const, content: "Original records deleted" }]
        : []),
    ],
    required: true,
    requiredFileIds: ["draft"],
  })),
  goals: [{ fileId: "draft", expectedContent: "Final draft" }],
};

let container: HTMLDivElement;
let root: Root | null;
let hidden: boolean;
let previousLocale: string;
let scrollDescriptor: PropertyDescriptor | undefined;

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}

async function click(label: string, scope: ParentNode = container) {
  await act(async () => button(label, scope).click());
}

function actualFileContent() {
  return container.querySelector(".play-ai-agent__workspace .play-ai-agent__file pre")?.textContent;
}

async function renderGame(currentActivity = activity, guided = false) {
  const onAttempt = vi.fn<ActivityControls<AgentActivity>["onAttempt"]>();
  await act(async () =>
    root!.render(
      <AgentGame
        activity={currentActivity}
        disabled={false}
        guided={guided}
        onAttempt={onAttempt}
      />,
    ),
  );
  return onAttempt;
}

async function letAllStepsElapse() {
  // Deliberately independent of the component's step cadence.
  await act(async () => vi.advanceTimersByTime(10_000));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  previousLocale = activeLocale();
  setActiveLocale("zh-CN");
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  // jsdom does not lay out viewports. Real viewport behavior belongs to the browser suite.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

describe("Agent guidance uses the real permissions and workspace", () => {
  const withRead: AgentActivity = {
    ...activity,
    tools: [
      {
        id: "reader",
        label: "材料读取器",
        description: "Read approved files.",
        capability: "read",
        // A wider allowed task scope must not be silently granted by the first-step button.
        taskFileIds: ["source", "draft"],
      },
      ...activity.tools,
    ],
    actions: [
      {
        id: "read-source",
        title: "Read the original records",
        intent: "Read the records before drafting.",
        toolId: "reader",
        authority: "user",
        authorityText: "User task",
        inputFileIds: ["source"],
        effects: [],
        required: true,
        requiredFileIds: ["source"],
      },
      ...activity.actions,
    ],
  };

  it("grants only the displayed read files and keeps the actual read when switching views", async () => {
    const onAttempt = await renderGame(withRead, true);
    expect(container.querySelector<HTMLDetailsElement>(".play-agent-tools")?.open).toBe(false);
    expect(container.querySelector<HTMLDetailsElement>(".play-agent-workspace")?.open).toBe(false);
    expect(container.querySelector<HTMLDetailsElement>(".play-agent-files-frame")?.open).toBe(
      false,
    );
    expect(container.querySelector(".play-agent-read-start ul")?.textContent).toContain(
      "原始表/sandbox/source.txt",
    );
    expect(button("仅授权读取这些文件并开始").closest(".play-agent-read-start")).not.toBeNull();
    expect(container.querySelector(".play-ai-agent__target-card code")?.textContent).toBe(
      "/sandbox/source.txt",
    );
    expect(onAttempt).not.toHaveBeenCalled();

    await click("仅授权读取这些文件并开始");
    expect(container.querySelector(".play-ai-agent__last-result pre")?.textContent).toBe(
      "Original records",
    );
    expect(button("允许「沙盒编辑器」触达「草稿」").getAttribute("aria-checked")).toBe("false");
    expect(onAttempt).not.toHaveBeenCalled();

    await act(async () =>
      root!.render(
        <AgentGame activity={withRead} disabled={false} guided={false} onAttempt={onAttempt} />,
      ),
    );
    await click("验收沙盒里的工作");
    expect(onAttempt.mock.lastCall).toEqual([
      false,
      expect.objectContaining({
        capabilities: { reader: ["source"] },
        completedActionIds: ["read-source"],
        files: activity.files,
        log: [
          expect.objectContaining({
            actionId: "read-source",
            readFileIds: ["source"],
            changedFileIds: [],
          }),
        ],
      }),
      expect.any(String),
    ]);
  });

  it("keeps a mixed required step after rejection and executes only the player's allowed file", async () => {
    const onAttempt = await renderGame(withRead, true);
    await click("仅授权读取这些文件并开始");
    await click("允许「沙盒编辑器」触达「草稿」");
    await click("按当前范围执行一步");
    expect(container.querySelector(".play-ai-agent__last-result pre")?.textContent).toBe(
      "Draft v1",
    );

    await click("退回这一步");
    expect(container.querySelector(".play-ai-agent__action > header h4")?.textContent).toBe(
      "Draft step 2",
    );
    expect(container.querySelector(".play-ai-agent__feedback")?.textContent).toContain("没有执行");
    await click("就在这里修改文件范围");
    expect(document.activeElement).toBe(button("允许「沙盒编辑器」触达「原始表」"));
    expect(button("允许「沙盒编辑器」触达「原始表」").getAttribute("aria-checked")).toBe("false");

    await click("按当前范围执行一步");
    expect(container.querySelector(".play-ai-agent__last-result pre")?.textContent).toBe(
      "Draft v2",
    );
    await click("按当前范围执行一步");
    await click("验收沙盒里的工作");
    expect(onAttempt.mock.lastCall).toEqual([
      true,
      expect.objectContaining({
        capabilities: { reader: ["source"], writer: ["draft"] },
        files: [activity.files[0], { ...activity.files[1], content: "Final draft" }],
        completedActionIds: ["read-source", "write-1", "write-2", "write-3"],
        log: expect.arrayContaining([
          expect.objectContaining({
            actionId: "write-2",
            changedFileIds: ["draft"],
            blockedFileIds: ["source"],
          }),
        ]),
      }),
      expect.any(String),
    ]);
  });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container.remove();
  if (scrollDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
  setActiveLocale(previousLocale);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Agent controlled run lifecycle", () => {
  it("writes the first actual file immediately, then continues to the final artifact", async () => {
    const onAttempt = await renderGame();
    await click("仅任务范围");
    await click("推进到需要我判断处");

    // No timer has been advanced: this must already be the executed file, not a proposed card.
    expect(actualFileContent()).toBe("Draft v1");
    expect(container.querySelector(".play-ai-agent__last-result pre")?.textContent).toBe(
      "Draft v1",
    );
    expect(button("停在这里")).toBeDefined();
    expect(onAttempt).not.toHaveBeenCalled();

    await letAllStepsElapse();
    expect(actualFileContent()).toBe("Final draft");
    await click("验收沙盒里的工作");
    expect(onAttempt).toHaveBeenCalledExactlyOnceWith(
      true,
      expect.objectContaining({ completedActionIds: ["write-1", "write-2", "write-3"] }),
      expect.any(String),
    );
  });

  it("does no more work after user stop and resumes only on another run click", async () => {
    await renderGame();
    await click("仅任务范围");
    await click("推进到需要我判断处");
    await click("停在这里");
    await letAllStepsElapse();

    expect(actualFileContent()).toBe("Draft v1");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("已停下");
    await click("推进到需要我判断处");
    expect(actualFileContent()).toBe("Draft v2");
    await letAllStepsElapse();
    expect(actualFileContent()).toBe("Final draft");
  });

  it("stops when hidden and does not resume merely because the page becomes visible", async () => {
    await renderGame();
    await click("仅任务范围");
    await click("推进到需要我判断处");
    await act(async () => {
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await letAllStepsElapse();
    expect(actualFileContent()).toBe("Draft v1");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("页面切到后台");

    await act(async () => {
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await letAllStepsElapse();
    expect(actualFileContent()).toBe("Draft v1");
    await click("推进到需要我判断处");
    expect(actualFileContent()).toBe("Draft v2");
  });

  it("cancels pending execution timers on unmount", async () => {
    const onAttempt = await renderGame();
    // Settle the native <details> toggle event that jsdom queues on mount.
    await act(async () => vi.advanceTimersByTime(0));
    expect(vi.getTimerCount()).toBe(0);
    await click("仅任务范围");
    await click("推进到需要我判断处");
    expect(actualFileContent()).toBe("Draft v1");
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await act(async () => root!.unmount());
    root = null;
    expect(vi.getTimerCount()).toBe(0);
    await letAllStepsElapse();
    expect(container.textContent).toBe("");
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it("uses one real permission scope for file-card switches, toolbox controls and execution", async () => {
    const onAttempt = await renderGame();
    await click("仅任务范围");
    await click("按当前范围执行一步");
    await click("整个沙盒");
    const sourceLabel = "允许「沙盒编辑器」触达「原始表」";
    expect(button(sourceLabel).getAttribute("aria-checked")).toBe("true");

    await click(sourceLabel);
    expect(button(sourceLabel).getAttribute("aria-checked")).toBe("false");
    expect(button("仅任务范围").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".play-ai-agent__grant-paths")?.textContent).toContain(
      "/sandbox/draft.txt",
    );
    expect(container.querySelector(".play-ai-agent__grant-paths")?.textContent).not.toContain(
      "/sandbox/source.txt",
    );

    await click("按当前范围执行一步");
    expect(actualFileContent()).toBe("Draft v2");
    await click("原始表", container.querySelector(".play-ai-agent__file-tabs")!);
    expect(actualFileContent()).toBe("Original records");
    await click("验收沙盒里的工作");
    expect(onAttempt.mock.lastCall?.[1]).toMatchObject({
      capabilities: { writer: ["draft"] },
      completedActionIds: ["write-1", "write-2"],
      log: [
        { actionId: "write-1", changedFileIds: ["draft"] },
        { actionId: "write-2", changedFileIds: ["draft"], blockedFileIds: ["source"] },
      ],
    });

    // Closing the remaining required file through its card must also stop actual work.
    await click("允许「沙盒编辑器」触达「草稿」");
    expect(button("关闭").getAttribute("aria-pressed")).toBe("true");
    await click("按当前范围执行一步");
    await click("草稿", container.querySelector(".play-ai-agent__file-tabs")!);
    expect(actualFileContent()).toBe("Draft v2");
    await click("验收沙盒里的工作");
    expect(onAttempt.mock.lastCall).toEqual([
      false,
      expect.objectContaining({
        capabilities: { writer: [] },
        completedActionIds: ["write-1", "write-2"],
      }),
      expect.any(String),
    ]);
  });
});
