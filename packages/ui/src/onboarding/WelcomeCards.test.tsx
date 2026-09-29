// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withInterfaceLocale } from "../../test-support/interface-locale.js";
import {
  WelcomeCards,
  WelcomeQuestions,
  recommendedWelcomePath,
  type WelcomePath,
} from "./WelcomeCards.js";

let host: HTMLDivElement;
let root: Root;
const choices: readonly WelcomePath[] = [
  { id: "ai-literacy", kind: "basics", firstLessonTitle: "真实的第一关", lessonCount: 36 },
  { id: "browser-ai", kind: "build", firstLessonTitle: "从一个小应用开始", lessonCount: 27 },
];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const click = async (selector: string) => {
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
};

describe("V7 welcome cards inside the existing guide", () => {
  it("W3 chooses the actual path immediately without a second dialog, animation gate or progress write", async () => {
    const choose = vi.fn();
    await act(async () =>
      root.render(
        withInterfaceLocale(
          <StrictMode>
            <WelcomeCards
              choices={choices}
              onChoose={choose}
              onHelp={vi.fn()}
              onAssess={vi.fn()}
              onBrowse={vi.fn()}
              onSignIn={vi.fn()}
            />
          </StrictMode>,
        ),
      ),
    );
    expect(host.querySelectorAll("[data-welcome-choice]")).toHaveLength(2);
    expect(host.textContent).toContain("真实的第一关");
    const start = host.querySelector<HTMLButtonElement>('[data-welcome-start="browser-ai"]')!;
    expect(start.disabled).toBe(false);
    await click('[data-welcome-start="browser-ai"]');
    expect(choose).toHaveBeenCalledExactlyOnceWith("browser-ai");
    expect(host.querySelectorAll('dialog,audio,video,canvas,input[type="email"]')).toHaveLength(0);
  });
  it("W4 keeps browse and sign-in available when no course is ready", async () => {
    const browse = vi.fn(),
      signIn = vi.fn();
    await act(async () =>
      root.render(
        withInterfaceLocale(
          <WelcomeCards
            choices={[]}
            onChoose={vi.fn()}
            onHelp={vi.fn()}
            onAssess={vi.fn()}
            onBrowse={browse}
            onSignIn={signIn}
          />,
        ),
      ),
    );
    expect(host.querySelector("[data-welcome-start]")).toBeNull();
    await click("[data-welcome-browse]");
    await click("[data-welcome-signin]");
    expect(browse).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
  it("asks two explicit preferences and recommends only an existing path, without starting it", async () => {
    const choose = vi.fn();
    await act(async () =>
      root.render(
        withInterfaceLocale(
          <WelcomeQuestions choices={choices} onChoose={choose} onBack={vi.fn()} />,
        ),
      ),
    );
    expect(host.querySelectorAll("fieldset")).toHaveLength(2);
    expect(host.querySelector("[data-welcome-recommended]")).toBeNull();
    await click('[data-welcome-goal="build"]');
    expect(host.querySelector("[data-welcome-recommended]")).toBeNull();
    await click('[data-welcome-experience="never"]');
    expect(host.textContent).toContain("推荐你走「用 AI 做一个小应用」");
    expect(choose).not.toHaveBeenCalled();
    await click("[data-welcome-recommended]");
    expect(choose).toHaveBeenCalledExactlyOnceWith("browser-ai");
  });
  it("never invents a missing route or recommends a lesson as proven", () => {
    expect(recommendedWelcomePath(choices, "work")).toBe(choices[0]);
    expect(recommendedWelcomePath([choices[0]!], "build")).toBe(choices[0]);
    expect(recommendedWelcomePath([], "build")).toBeNull();
  });
});
