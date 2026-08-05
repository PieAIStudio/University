import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeCourse } from "../content/repository.js";
import { createStudy } from "../studies/repository.js";
import { clearLearningFocus, setLearningFocus, showLearningFocus } from "./focus.js";

const NOW = "2026-08-06T10:00:00.000Z";

/**
 * A focus is validated against the shelf, so these cases only need a shelf —
 * the ordering behaviour is exercised in `http-server.test.ts`, where two real
 * activated courses already exist.
 */
function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-focus-"));
  const projectRoot = join(container, "project");
  const studiesRoot = join(container, "studies");
  mkdirSync(projectRoot, { recursive: true });
  createStudy(studiesRoot, { id: "sample", title: "Sample", now: new Date(NOW) });
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "unfinished",
    title: "Unfinished",
    description: "",
    audience: "Owner",
    objectives: ["Understand the sample"],
    unitIds: [],
    status: "draft",
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { projectRoot, studiesRoot };
}

function localConfig(projectRoot: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(projectRoot, "university-local.config.local.json"), "utf8"),
  ) as Record<string, unknown>;
}

describe("learning focus", () => {
  it("records a study-only focus and reads it back", () => {
    const { projectRoot, studiesRoot } = setup();

    setLearningFocus({ projectRoot, studiesRoot, studyId: "sample" });

    expect(localConfig(projectRoot)["focus"]).toEqual({ studyId: "sample", courseIds: [] });
    expect(showLearningFocus(projectRoot).focus).toEqual({ studyId: "sample", courseIds: [] });
  });

  it("refuses a study that is not on the shelf, and lists what is", () => {
    const { projectRoot, studiesRoot } = setup();

    expect(() => setLearningFocus({ projectRoot, studiesRoot, studyId: "nope" })).toThrow(
      /No study named nope\. Available: sample/,
    );
  });

  it("refuses a course that is not on the shelf", () => {
    const { projectRoot, studiesRoot } = setup();

    expect(() =>
      setLearningFocus({ projectRoot, studiesRoot, studyId: "sample", courseIds: ["nope"] }),
    ).toThrow(/No course named nope/);
  });

  it("refuses a course that is not active", () => {
    const { projectRoot, studiesRoot } = setup();

    expect(() =>
      setLearningFocus({ projectRoot, studiesRoot, studyId: "sample", courseIds: ["unfinished"] }),
    ).toThrow(/is draft/);
  });

  it("refuses the same course twice, because a run has one position per course", () => {
    const { projectRoot, studiesRoot } = setup();

    expect(() =>
      setLearningFocus({
        projectRoot,
        studiesRoot,
        studyId: "sample",
        courseIds: ["unfinished", "unfinished"],
      }),
    ).toThrow(/listed twice/);
  });

  it("leaves the rest of the local config alone when it clears the focus", () => {
    const { projectRoot, studiesRoot } = setup();
    writeFileSync(
      join(projectRoot, "university-local.config.local.json"),
      JSON.stringify({ schemaVersion: 1, studiesRoot: "./elsewhere" }),
    );

    setLearningFocus({ projectRoot, studiesRoot, studyId: "sample" });
    clearLearningFocus(projectRoot);

    expect(localConfig(projectRoot)).toEqual({ schemaVersion: 1, studiesRoot: "./elsewhere" });
  });
});
