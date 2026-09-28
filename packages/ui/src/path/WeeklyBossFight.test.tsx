import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compileAnswerKey, type WeeklyBoss } from "@pieai/university-core";

import { WeeklyBossFight, type WeeklyBossStrike } from "./WeeklyBossFight.js";

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

/** Monday noon of the boss's week; it leaves at the end of Sunday. */
const NOW = new Date(2026, 8, 28, 12).getTime();

function bossWith(hearts: number): WeeklyBoss {
  const pool = ["a", "b", "c", "d", "e"].slice(0, Math.max(1, hearts)).map((lesson) => ({
    lessonId: `s/c/${lesson}`,
    exerciseId: "e",
    prompt: `${lesson} 的问题`,
    answerKey: compileAnswerKey("对"),
  }));
  return {
    week: "2026-09-28",
    island: { studyId: "s", courseId: "c" },
    leavesAt: new Date(2026, 9, 5).getTime(),
    beaten: false,
    hearts,
    pool,
  };
}

function mount(boss: WeeklyBoss) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const strikes: WeeklyBossStrike[] = [];
  const opened: string[] = [];
  act(() => {
    root.render(
      withInterfaceLocale(
        <WeeklyBossFight
          boss={boss}
          now={NOW}
          lessonTitle={(key) => `标题 ${key}`}
          onStrike={(strike) => strikes.push(strike)}
          onOpenLesson={(key) => opened.push(key)}
          onClose={() => {}}
          pick={() => 0}
        />,
      ),
    );
  });
  const text = () => container.textContent ?? "";
  const click = async (action: string) => {
    const button = container.querySelector(`[data-weekly-boss-action="${action}"]`);
    const fallback = [...container.querySelectorAll("button")].find((node) =>
      (node.textContent ?? "").includes(action),
    );
    const target = button ?? fallback;
    if (!target) throw new Error(`no ${action} in: ${text()}`);
    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };
  const answer = async (value: string) => {
    const field = container.querySelector("textarea");
    if (!field) throw new Error(`no answer field in: ${text()}`);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const hearts = () =>
    Number(container.querySelector(".weekly-boss-fight__hearts")?.getAttribute("data-hearts"));
  return { container, root, text, click, answer, hearts, strikes, opened };
}

describe("the weekly boss's fight", () => {
  it("opens on its hearts and days left, and offers a fight rather than starting one", () => {
    const test = mount(bossWith(5));
    expect(test.hearts()).toBe(5);
    expect(test.text()).toContain("还剩 7 天");
    expect(test.container.querySelector("textarea")).toBeNull();
    test.root.unmount();
  });

  it("takes a heart for each right answer and costs nothing for a wrong one", async () => {
    const test = mount(bossWith(5));
    await test.click("fight");
    await test.answer("对");
    await test.click("扔星星");
    expect(test.strikes.at(-1)).toMatchObject({ verdict: "correct", won: false });
    expect(test.strikes.at(-1)?.hitEventId).toMatch(/^weekly-boss:2026-09-28:hit:/);
    expect(test.hearts()).toBe(4);

    await test.click("next");
    await test.answer("完全不相干");
    await test.click("扔星星");
    expect(test.strikes.at(-1)).toMatchObject({ verdict: "wrong", hitEventId: null });
    expect(test.hearts()).toBe(4);
    // The miss names where the question came from, and offers it.
    expect(test.text()).toContain("标题 s/c/");
    await test.click("回去读这一关");
    expect(test.opened).toHaveLength(1);
    test.root.unmount();
  });

  it("asks for an answer instead of counting a blank one", async () => {
    const test = mount(bossWith(5));
    await test.click("fight");
    await test.click("扔星星");
    expect(test.strikes).toHaveLength(0);
    expect(test.container.querySelector(".question-step__note")).not.toBeNull();
    test.root.unmount();
  });

  it("ends a round with hearts standing and starts another at once", async () => {
    const test = mount(bossWith(2));
    await test.click("fight");
    await test.answer("完全不相干");
    await test.click("扔星星");
    await test.click("next");
    await test.answer("对");
    await test.click("扔星星");
    expect(test.text()).toContain("这一轮打完了");
    await test.click("again");
    expect(test.container.querySelector("textarea")).not.toBeNull();
    test.root.unmount();
  });

  it("reports the last heart as a win, flawless only from five in a row", async () => {
    const test = mount(bossWith(5));
    await test.click("fight");
    for (let index = 0; index < 5; index += 1) {
      await test.answer("对");
      await test.click("扔星星");
      if (index < 4) await test.click("next");
    }
    expect(test.strikes.at(-1)).toMatchObject({ won: true, flawless: true });
    test.root.unmount();

    const late = mount(bossWith(1));
    await late.click("fight");
    await late.answer("对");
    await late.click("扔星星");
    expect(late.strikes.at(-1)).toMatchObject({ won: true, flawless: false });
    late.root.unmount();
  });
});
