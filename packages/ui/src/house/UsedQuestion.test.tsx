import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/index.js";
import { UsedQuestion } from "./UsedQuestion.js";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(onAnswer = vi.fn()) {
  await act(async () =>
    root.render(
      withInterfaceLocale(
        <InterfaceLanguageProvider locale="zh-CN">
          <UsedQuestion task="先把以前的两句话贴给它。" onAnswer={onAnswer} />
        </InterfaceLanguageProvider>,
      ),
    ),
  );
  return onAnswer;
}
const answer = (value: string) =>
  container.querySelector<HTMLButtonElement>(`[data-used-answer="${value}"]`)!;

describe("用了吗", () => {
  it("quotes the small thing and offers two ordinary answers", async () => {
    await render();
    expect(container.textContent).toContain("先把以前的两句话贴给它。");
    expect(answer("used").textContent).toBe("用了");
    expect(answer("not-yet").textContent).toBe("还没");
  });

  it("records 用了 as a mark on the house wall and says so", async () => {
    const onAnswer = await render();
    await act(async () => answer("used").click());
    expect(onAnswer).toHaveBeenCalledWith("used");
    expect(container.textContent).toBe("在小屋墙上记了一笔。");
  });

  it("takes 还没 without pressing", async () => {
    const onAnswer = await render();
    await act(async () => answer("not-yet").click());
    expect(onAnswer).toHaveBeenCalledWith("not-yet");
    expect(container.textContent).toBe("好，下次再说。");
  });
});
