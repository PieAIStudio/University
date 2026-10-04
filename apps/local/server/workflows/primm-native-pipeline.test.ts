import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executeUniversityLocalCli } from "../cli/execute.js";
import { parseUniversityLocalCli } from "../cli/parse.js";
import { readLatestLesson } from "../content/repository.js";
import { activityDisplayStrings } from "@pieai/university-core";
import { primmStepsFixture } from "../../../../packages/core/src/learning-play/fixtures/primm-steps.js";
import { checkLessonSpine } from "../../scripts/lesson-spine.mjs";

// A text-only V3 fixture exercises native create/revise/recovery, not a retired engine.
const activity = {
  ...structuredClone(primmStepsFixture),
  materials: primmStepsFixture.materials.map(({ assetId: _asset, ...material }) => material),
  starter: { ...primmStepsFixture.starter, operation: "text" as const, assetIds: [] },
  make: { ...primmStepsFixture.make, operation: "text" as const, assetIds: [] },
  steps: primmStepsFixture.steps.filter((step) => step.kind !== "point"),
};
activity.locales = {
  en: {
    strings: Object.fromEntries(
      activityDisplayStrings(activity).map((text) => [
        text,
        primmStepsFixture.locales!.en!.strings![text],
      ]),
    ),
  },
};
const evidence = activity.sources.map((source) => ({
  kind: "fact",
  sourceUrl: "url" in source.reference ? source.reference.url : undefined,
  sourceTitle: source.reference.label,
  sourceAuthority: "first-party",
  provenance: {
    type: "official-document",
    publisher: source.reference.label,
    accessedOn: "2026-10-05",
    supports: source.summary,
    limitations: source.limitation,
  },
}));
const content = `# 如何问清照片里的细节？\n\n::play{#${activity.id}}\n\n先问到想知道的那一处，再核对回答。`;
const lesson = {
  id: "keyboard-lesson",
  title: "如何用键盘提交？",
  content,
  variant: "现象",
  evidence,
  activities: [activity],
  cards: [],
  exercises: [
    {
      id: activity.make.exerciseId,
      kind: "explain",
      title: "独立练习",
      prompt: "焦点在取消按钮上，不用鼠标能按哪个键取消？",
      rubric: ["问题指向具体细节，并核对回答。"],
      evidence,
    },
  ],
};

describe("PRIMM V3 native pipeline", () => {
  it("uses stronger checks only with the explicit activity kind", () => {
    expect(checkLessonSpine(content, "现象").length).toBeGreaterThan(0);
    expect(checkLessonSpine(content, "现象", { interactionLesson: lesson })).toEqual([]);
    expect(
      checkLessonSpine(content, "现象", { interactionLesson: { ...lesson, exercises: [] } }).length,
    ).toBeGreaterThan(0);
  });
  it("creates, revises, exports and recovers an isolated lesson without learner state", async () => {
    const source = mkdtempSync(join(tmpdir(), "interaction-source-"));
    const target = mkdtempSync(join(tmpdir(), "interaction-recovery-"));
    const run = (projectRoot: string, args: string[]) =>
      executeUniversityLocalCli({
        projectRoot,
        cwd: projectRoot,
        env: {},
        command: parseUniversityLocalCli(args),
      });
    await run(source, [
      "study",
      "create",
      "--study",
      "interaction-test",
      "--title",
      "Synthetic interaction fixture",
    ]);
    const proposal = join(source, "proposal.json");
    writeFileSync(
      proposal,
      JSON.stringify({
        schemaVersion: 1,
        proposalId: "create-fixture",
        course: {
          id: "keyboard-course",
          title: "Keyboard fixture",
          audience: "Test fixture",
          objectives: ["Keyboard actions"],
          units: [
            { id: "keyboard-unit", title: "Buttons", objective: "Use a button", lessons: [lesson] },
          ],
        },
      }),
    );
    await run(source, [
      "course",
      "create",
      "--study",
      "interaction-test",
      "--input",
      proposal,
      "--dry-run",
    ]);
    await run(source, ["course", "create", "--study", "interaction-test", "--input", proposal]);
    await run(source, [
      "course",
      "open-for-edit",
      "--study",
      "interaction-test",
      "--course",
      "keyboard-course",
    ]);
    const revision = join(source, "revision.json");
    writeFileSync(
      revision,
      JSON.stringify({
        schemaVersion: 1,
        proposalId: "revise-fixture",
        lesson: {
          courseId: "keyboard-course",
          unitId: "keyboard-unit",
          id: lesson.id,
          expectedRevision: 1,
          content: content + "\n你可以重复检查键盘操作。",
          evidence,
          activities: [activity],
          cards: [],
          exercises: lesson.exercises.map((exercise) => ({ ...exercise, expectedRevision: 1 })),
        },
      }),
    );
    await run(source, [
      "course",
      "revise",
      "--study",
      "interaction-test",
      "--input",
      revision,
      "--dry-run",
    ]);
    await run(source, ["course", "revise", "--study", "interaction-test", "--input", revision]);
    await run(source, [
      "course",
      "reactivate",
      "--study",
      "interaction-test",
      "--course",
      "keyboard-course",
    ]);
    const exported = join(source, "exported");
    await run(source, [
      "course",
      "recovery",
      "export",
      "--study",
      "interaction-test",
      "--out",
      exported,
    ]);
    await run(target, [
      "course",
      "recovery",
      "import",
      "--study",
      "interaction-test",
      "--input",
      exported,
      "--dry-run",
    ]);
    await run(target, [
      "course",
      "recovery",
      "import",
      "--study",
      "interaction-test",
      "--input",
      exported,
    ]);
    const recovered = readLatestLesson(
      join(target, "studies"),
      "interaction-test",
      "keyboard-course",
      "keyboard-unit",
      "keyboard-lesson",
    );
    expect(recovered.manifest.activities[0]).toEqual(activity);
    expect(recovered.content).toContain("重复检查");
    expect(recovered.manifest.exerciseIds).toEqual([activity.make.exerciseId]);
    expect(recovered.manifest.contentRevision).toBe(2);
    const index = JSON.parse(readFileSync(join(exported, "index.json"), "utf8"));
    const bytes = readFileSync(join(exported, index.courses[0].file), "utf8");
    expect(bytes).not.toContain("helpedStepIds");
  });
});
