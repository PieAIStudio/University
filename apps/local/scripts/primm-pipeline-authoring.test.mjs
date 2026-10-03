import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { resolvePrimmPreviewSource } from "../../../scripts/primm-preview-source.mjs";
import {
  authoringContext,
  nativeAuthoring,
  prepareUnpublished,
  prepareUnpublishedPreview,
} from "./primm-pipeline-authoring.mjs";
import {
  readLatestLesson,
  readLatestCard,
  readLatestExercise,
} from "../.university-local-build/server/content/repository.js";

const MODULE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(MODULE, "../..");
const roots = [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function temporary() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "university-primm-authoring-")));
  roots.push(root);
  return root;
}
function frozenRecovery(root) {
  const fixture = join(REPO, "e2e/fixtures/catalogue");
  const name = "ai-literacy.json.gz";
  const bytes = readFileSync(join(fixture, name));
  const entry = read(join(fixture, "manifest.json")).artifacts.find((item) => item.file === name);
  expect(sha(bytes)).toBe(entry.sha256);
  const bundle = JSON.parse(gunzipSync(bytes).toString("utf8"));
  const recoveryRoot = join(root, "recovery");
  mkdirSync(recoveryRoot);
  writeFileSync(join(recoveryRoot, "index.json"), `${JSON.stringify(bundle.index, null, 2)}\n`);
  for (const item of bundle.packages)
    writeFileSync(
      join(recoveryRoot, item.entry.file),
      `${JSON.stringify(item.package, null, 2)}\n`,
    );
  return recoveryRoot;
}

describe("the production line uses one native authoring root", () => {
  it("does not require the optional personal config and obeys the native configured root", () => {
    const root = temporary();
    const context = authoringContext(root, {});
    expect(context.studiesRoot).toBe(join(root, "studies"));
    expect(existsSync(join(root, "university-local.config.local.json"))).toBe(false);
    expect(() => authoringContext(root, { UNIVERSITY_LOCAL_STUDIES_ROOT: root })).toThrow();
  });
  it("restores an unpublished native shelf without changing its source, and packets read that same shelf", async () => {
    const root = temporary();
    const recoveryRoot = frozenRecovery(root);
    const before = sha(readFileSync(join(recoveryRoot, "index.json")));
    const projectRoot = join(root, "authoring");
    const receipt = await prepareUnpublished({
      projectRoot,
      recoveryRoot,
      studyId: "ai-literacy",
      courseId: "understanding-ai",
      env: {},
    });
    expect(receipt.purpose).toBe("unpublished-owner-reading");
    expect(receipt.receipts).toHaveLength(3);
    expect(receipt.studiesRoot).toBe(join(projectRoot, "studies"));
    expect(
      read(join(receipt.studiesRoot, "ai-literacy/courses/understanding-ai/course.json")).status,
    ).toBe("stale");
    expect(sha(readFileSync(join(recoveryRoot, "index.json")))).toBe(before);
    await expect(
      prepareUnpublished({
        projectRoot,
        recoveryRoot,
        studyId: "ai-literacy",
        courseId: "understanding-ai",
        env: {},
      }),
    ).rejects.toThrow("already exists");
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !key.startsWith("GIT_") &&
          !key.startsWith("UNIVERSITY_LOCAL_") &&
          !key.startsWith("PRIMM_"),
      ),
    );
    const runRoot = join(root, "runs");
    const output = execFileSync(
      process.execPath,
      [
        join(MODULE, "scripts/primm-pipeline.mjs"),
        "packet",
        "--lesson",
        "first-useful-step/edit-one-part",
      ],
      {
        cwd: MODULE,
        env: { ...env, PRIMM_PROJECT_ROOT: projectRoot, PRIMM_RUN_ROOT: runRoot },
        encoding: "utf8",
      },
    );
    expect(output).toContain("packet: edit-one-part");
    const packet = read(join(runRoot, "edit-one-part/packet.json"));
    expect(packet.storage).toEqual({ projectRoot, studiesRoot: receipt.studiesRoot });
    expect(packet.experienceVersion).toBe(3);
    expect(packet.exerciseIds).toEqual(["edit-one-part-exercise"]);
    expect(sha(readFileSync(join(recoveryRoot, "index.json")))).toBe(before);
    const context = authoringContext(projectRoot, {});
    const location = [
      context.studiesRoot,
      "ai-literacy",
      "understanding-ai",
      "first-useful-step",
      "edit-one-part",
    ];
    const original = readLatestLesson(...location);
    const manifest = original.manifest;
    const proposal = {
      schemaVersion: 1,
      proposalId: "native-unpublished-test",
      lesson: {
        courseId: location[2],
        unitId: location[3],
        id: location[4],
        expectedRevision: manifest.contentRevision,
        title: manifest.title,
        variant: manifest.variant,
        content: original.content + "\n",
        sections: manifest.sections,
        locales: manifest.locales,
        evidence: manifest.evidence,
        assets: manifest.assets,
        activities: manifest.activities,
        cards: manifest.cardIds.map((id) => {
          const card = readLatestCard(...location, id);
          return {
            id,
            expectedRevision: card.contentRevision,
            kind: card.kind,
            front: card.front,
            back: card.back,
            tags: card.tags,
            evidence: card.evidence,
            locales: card.locales,
          };
        }),
        exercises: manifest.exerciseIds.map((id) => {
          const exercise = readLatestExercise(...location, id);
          return {
            id,
            expectedRevision: exercise.contentRevision,
            kind: exercise.kind,
            title: exercise.title,
            prompt: exercise.prompt,
            rubric: exercise.rubric,
            evidence: exercise.evidence,
            locales: exercise.locales,
          };
        }),
      },
    };
    const proposalPath = join(root, "native-proposal.json");
    writeFileSync(proposalPath, JSON.stringify(proposal));
    const revise = ["course", "revise", "--study", "ai-literacy", "--input", proposalPath];
    const dryRun = await nativeAuthoring(context, [...revise, "--dry-run"]);
    expect(dryRun.mode).toBe("dry-run");
    expect(dryRun.disposition).toBe("validated");
    expect(readLatestLesson(...location)).toEqual(original);
    const applied = await nativeAuthoring(context, revise);
    expect(applied.mode).toBe("apply");
    expect(readLatestLesson(...location).manifest.contentRevision).toBe(
      manifest.contentRevision + 1,
    );
    const preview = await prepareUnpublishedPreview({ projectRoot, env: {} });
    const generated = read(join(preview.contentRoot, "ai-literacy/understanding-ai.json"));
    const updated = generated.course.units
      .find((unit) => unit.id === location[3])
      .lessons.find((lesson) => lesson.id === location[4]);
    expect(updated.contentRevision).toBe(manifest.contentRevision + 1);
    expect(preview.recoveryRoot.startsWith(projectRoot)).toBe(true);
    expect(preview.manifestSha256).toBe(sha(readFileSync(preview.manifestPath)));
    const selected = resolvePrimmPreviewSource(REPO, dirname(preview.manifestPath));
    expect(selected.unpublished).toBe(true);
    expect(selected.studyId).toBe("ai-literacy");
    expect(selected.appEnvironment.UNIVERSITY_CONTENT_ROOT).toBe(preview.contentRoot);
    expect(sha(readFileSync(join(recoveryRoot, "index.json")))).toBe(before);
  });
});
