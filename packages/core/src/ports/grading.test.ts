import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DETERMINISTIC_GRADER_HOST,
  graderLabel,
  createMemoryGradingPort,
  freeGradingRemainingText,
  gradingAttemptsFromPowerUnits,
  gradingAttemptText,
  walletGradingBalanceText,
} from "./grading.js";

const here = dirname(fileURLToPath(import.meta.url));

const locator = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

describe("GradingPort", () => {
  it("is a pure contract: no React, no filesystem, no network library", () => {
    const src = readFileSync(join(here, "grading.ts"), "utf8");
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/from ["']node:fs["']/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });

  it("lets a fake pass a non-empty answer without a host", async () => {
    const port = createMemoryGradingPort();
    const result = await port.submitExercise({
      locator,
      exerciseId: "product-name-from-readme",
      contentRevision: 1,
      answer: "图灵密约",
      commandId: "cmd-1",
    });
    expect(result.hostGrade?.passed).toBe(true);
    expect(port.submissions).toHaveLength(1);
  });
});

describe("gradingAttemptsFromPowerUnits", () => {
  it("converts an exactly divisible balance", () => {
    expect(gradingAttemptsFromPowerUnits("400")).toBe(4n);
  });

  it("floors a balance with a remainder", () => {
    expect(gradingAttemptsFromPowerUnits("350")).toBe(3n);
  });

  it("does not claim an attempt when the balance is below the cost", () => {
    expect(gradingAttemptsFromPowerUnits("99")).toBe(0n);
  });

  it("returns zero for an empty balance", () => {
    expect(gradingAttemptsFromPowerUnits("0")).toBe(0n);
  });

  /*
    These strings come off the wire. A surface that renders one must be able to
    say "we could not read it" rather than throw while React is painting the
    lesson, so an unreadable balance is a value here, not an exception.
  */
  it("reads an unreadable balance as null instead of throwing", () => {
    expect(gradingAttemptsFromPowerUnits("100.0")).toBeNull();
    expect(gradingAttemptsFromPowerUnits("-100")).toBeNull();
    expect(gradingAttemptsFromPowerUnits("1,000")).toBeNull();
    expect(gradingAttemptsFromPowerUnits("")).toBeNull();
  });
});

describe("learner-facing attempt sentences", () => {
  it("counts a readable balance in 次", () => {
    expect(gradingAttemptText("300")).toBe("3 次");
    expect(freeGradingRemainingText("300")).toBe("今天还剩 3 次");
    expect(walletGradingBalanceText("300")).toBe("你的钱包还够 3 次");
  });

  it("never claims a usable zero", () => {
    expect(gradingAttemptText("99")).toBe("不够一次了");
    expect(freeGradingRemainingText("99")).toBe("今天还不够一次了");
    expect(walletGradingBalanceText("99")).toBe("你的钱包还不够一次了");
  });

  it("says it could not read an unreadable balance", () => {
    expect(gradingAttemptText("oops")).toBe("暂时读不到");
    expect(freeGradingRemainingText("oops")).toBe("今天还剩多少次暂时读不到");
    expect(walletGradingBalanceText("oops")).toBe("你的钱包余额暂时读不到");
  });
});

describe("what the learner is told graded them", () => {
  it("does not call deterministic matching AI", () => {
    // The free tier is sold on "obvious answers judged on the spot" and the
    // paid tier on "a model reads the rest". Calling tier one AI erases the
    // difference the product charges for.
    expect(graderLabel(DETERMINISTIC_GRADER_HOST)).toBe("当场判定");
    expect(graderLabel(DETERMINISTIC_GRADER_HOST)).not.toContain("AI");
  });

  it("calls a real model host AI", () => {
    expect(graderLabel("claude")).toBe("AI 评估");
    expect(graderLabel(null)).toBe("AI 评估");
  });
});
