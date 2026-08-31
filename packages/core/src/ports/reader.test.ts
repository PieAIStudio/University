import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMemoryReaderPort } from "./reader.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("ReaderPort", () => {
  it("is a pure contract: no React, no filesystem, no network library", () => {
    const src = readFileSync(join(here, "reader.ts"), "utf8");
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/from ["']node:fs["']/);
    expect(src).not.toMatch(/from ["']node:http["']/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });

  it("records a mark against the lesson on screen and lists it back", async () => {
    const port = createMemoryReaderPort();
    const locator = {
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    };
    const mark = await port.writeMark(locator, {
      contentRevision: 1,
      kind: "question",
      quote: { exact: "App", prefix: "", suffix: "" },
    });
    expect(mark.lessonKey).toBe(
      "turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    const listed = await port.listMarks(locator.studyId);
    expect(listed).toEqual([mark]);
  });

  it("returns an explicit locator-only result when source bytes are absent", async () => {
    const port = createMemoryReaderPort();
    await expect(
      port.loadEvidenceSnippet(
        {
          studyId: "study",
          courseId: "course",
          unitId: "unit",
          lessonId: "lesson",
        },
        0,
      ),
    ).resolves.toEqual({ kind: "locator-only" });
  });
});
