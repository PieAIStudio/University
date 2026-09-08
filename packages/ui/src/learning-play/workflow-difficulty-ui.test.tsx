// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeLocale, setActiveLocale, translate } from "../i18n/index.js";
import { ContextGame } from "./ContextGame.js";
import { getAIWorkflowExamples } from "./ai-workflow-examples.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";

let container: HTMLDivElement;
let root: Root;
let previousLocale: string;
let scrollDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  previousLocale = activeLocale();
  setActiveLocale("zh-CN");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  setActiveLocale(previousLocale);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function click(label: string, scope: ParentNode = container) {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) =>
      item.textContent?.trim().startsWith(label) || item.getAttribute("aria-label") === label,
  );
  expect(button, label).toBeDefined();
  await act(async () => {
    button!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function family(id: string) {
  const found = getWorkflowFamily(getAIWorkflowExamples().find((item) => item.id === id)!);
  if (found.kind !== "ai-context") throw new Error("Expected a context family");
  return found;
}

describe.each(["ai-context-cafe", "ai-context-workshop"])(
  "context difficulty guidance: %s",
  (id) => {
    it("takes one actual customer from failed source through rebuilding and delivery without hidden extra customers", async () => {
      const activity = family(id).levels.intro;
      const customer = activity.visitors![0]!;
      const trial = activity.documents.find((document) => document.id === "trial")!;
      const onAttempt = vi.fn();
      await act(async () =>
        root.render(
          <ContextGame activity={activity} guided disabled={false} onAttempt={onAttempt} />,
        ),
      );
      expect(container.querySelector<HTMLDetailsElement>(".play-context-materials")?.open).toBe(
        false,
      );
      expect(container.querySelectorAll(".play-ai-context__library > button")).toHaveLength(2);
      expect(container.querySelectorAll(".ai-context-counter__queue > button")).toHaveLength(1);
      expect(onAttempt).not.toHaveBeenCalled();

      await click(translate("play.ai.context.guide.visit", { name: customer.name }));
      expect(container.querySelector(".ai-context-counter__answer")?.textContent).toContain(
        translate("play.ai.context.customerBlocked"),
      );
      await click(translate("play.ai.context.guide.openSource", { title: trial.title }));
      expect(container.querySelector<HTMLDetailsElement>(".play-context-materials")?.open).toBe(
        true,
      );
      expect(container.querySelector(".play-ai-context__paper h4")?.textContent).toBe(trial.title);
      await click(
        translate("play.ai.context.removeDocument"),
        container.querySelector(".play-ai-context__paper")!,
      );
      await click(
        translate("play.ai.context.buildCounter"),
        container.querySelector(".play-context-build")!,
      );
      expect(onAttempt).not.toHaveBeenCalled();
      await click(translate("play.ai.context.guide.retry", { name: customer.name }));
      await click(translate("play.ai.context.deliverCounter"));
      expect(onAttempt).toHaveBeenCalledExactlyOnceWith(
        true,
        expect.objectContaining({
          selectedParagraphIds: ["brief-offering"],
          workResult: [expect.objectContaining({ slotId: "offering", status: "ready" })],
          visits: [
            expect.objectContaining({ visitorId: customer.id, passed: false }),
            expect.objectContaining({ visitorId: customer.id, passed: true }),
          ],
        }),
        translate("play.ai.context.difficulty.serviceSuccess", { count: 1 }),
      );
    });

    it("explains the actual excess capacity beside the customer's answer and keeps source clues", async () => {
      const activity = family(id).levels.challenge;
      await act(async () =>
        root.render(
          <ContextGame activity={activity} guided disabled={false} onAttempt={vi.fn()} />,
        ),
      );
      await click(translate("play.ai.context.guide.visit", { name: activity.visitors![0]!.name }));
      const answer = container.querySelector(".ai-context-counter__answer")!;
      expect(answer.textContent).toContain(
        translate("play.ai.context.guide.overCapacity", { extra: 5 }),
      );
      expect(answer.querySelectorAll(".ai-context-counter__clues > button")).toHaveLength(2);
    });
  },
);
