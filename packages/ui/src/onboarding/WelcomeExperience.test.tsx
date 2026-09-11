// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeExperience } from "./WelcomeExperience.js";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("WelcomeExperience", () => {
  const choices = [
    { id: "basics", title: "认识 AI" },
    { id: "games", title: "用 AI 做游戏" },
  ];
  const lesson = { title: "真实的第一课", sectionCount: 4, exerciseCount: 2 };
  it("W3 starts an actual lesson immediately, without waiting for animation or creating progress", async () => {
    const onStart = vi.fn();
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <StrictMode>
          <WelcomeExperience
            choices={choices}
            selectedId="basics"
            lesson={lesson}
            onSelect={onSelect}
            onStart={onStart}
            onBrowse={vi.fn()}
            onSignIn={vi.fn()}
          />
        </StrictMode>,
      ),
    );
    const dialog = document.querySelector("dialog")!;
    expect(dialog.textContent).toContain("不用先注册");
    expect(dialog.textContent).toContain("真实的第一课");
    expect(dialog.querySelectorAll("[data-welcome-choice]").length).toBe(2);
    await act(async () =>
      (dialog.querySelector('[data-welcome-choice="games"]') as HTMLButtonElement).click(),
    );
    expect(onSelect).toHaveBeenCalledWith("games");
    const start = dialog.querySelector("[data-welcome-start]") as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    await act(async () => start.click());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(dialog.querySelectorAll("audio,video,canvas,input[type=email]").length).toBe(0);
  });
  it("W4 allows browsing and signing in even if no course or renderer is ready", async () => {
    const onBrowse = vi.fn();
    const onSignIn = vi.fn();
    await act(async () =>
      root.render(
        <WelcomeExperience
          choices={[]}
          selectedId={null}
          lesson={null}
          onSelect={vi.fn()}
          onStart={vi.fn()}
          onBrowse={onBrowse}
          onSignIn={onSignIn}
        />,
      ),
    );
    const dialog = document.querySelector("dialog")!;
    expect((dialog.querySelector("[data-welcome-start]") as HTMLButtonElement).disabled).toBe(true);
    await act(async () =>
      (dialog.querySelector("[data-welcome-browse]") as HTMLButtonElement).click(),
    );
    await act(async () =>
      (dialog.querySelector("[data-welcome-signin]") as HTMLButtonElement).click(),
    );
    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
