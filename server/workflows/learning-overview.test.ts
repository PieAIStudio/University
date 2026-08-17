import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeCourse } from "../content/repository.js";
import { getCoursePaths } from "../studies/paths.js";
import { createStudy, setStudyStatus } from "../studies/repository.js";
import { buildLearningOverview } from "./learning-overview.js";

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-overview-"));
  const studiesRoot = join(container, "studies");
  return { container, studiesRoot };
}

describe("learning overview", () => {
  it("reports an archived focus and falls back to the active shelf", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "archived", title: "Archived" });
    setStudyStatus(studiesRoot, "archived", "archived");
    createStudy(studiesRoot, { id: "active", title: "Active" });

    const overview = buildLearningOverview({
      studiesRoot,
      focus: { studyId: "archived", courseIds: [] },
      getStore: () => null,
    });

    expect(overview.focus).toBeNull();
    expect(overview.teachingStudyId).toBe("active");
    expect(overview.issues).toContain("Learning focus study is not active: archived is archived");
  });

  it("reports stale focus and malformed course manifests instead of hiding them", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "sample", title: "Sample" });
    const staleCourse = {
      schemaVersion: 1 as const,
      id: "stale-course",
      title: "Stale course",
      description: "",
      audience: "Learner",
      objectives: ["Understand stale data"],
      unitIds: [],
      status: "draft" as const,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    writeCourse(studiesRoot, "sample", staleCourse);
    const stale = getCoursePaths(studiesRoot, "sample", "stale-course");
    writeFileSync(
      stale.manifest,
      `${JSON.stringify({ ...staleCourse, status: "stale" }, null, 2)}\n`,
    );
    const broken = getCoursePaths(studiesRoot, "sample", "broken-course");
    mkdirSync(broken.root, { recursive: true });
    writeFileSync(broken.manifest, "{ not valid course json }\n");

    const staleFocus = buildLearningOverview({
      studiesRoot,
      focus: { studyId: "sample", courseIds: ["stale-course"] },
      getStore: () => null,
    });
    expect(staleFocus.focus).toBeNull();
    expect(staleFocus.teachingStudyId).toBe("sample");
    expect(staleFocus.issues).toContain(
      "Learning focus course is not active: sample/stale-course is stale",
    );
    expect(staleFocus.issues.join(" ")).toContain("sample/broken-course: course manifest:");

    const noFocus = buildLearningOverview({ studiesRoot, getStore: () => null });
    expect(noFocus.issues.join(" ")).toContain("sample/broken-course: course manifest:");
  });
});
