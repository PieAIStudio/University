import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMemoryGradingPort } from "./grading.js";

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
