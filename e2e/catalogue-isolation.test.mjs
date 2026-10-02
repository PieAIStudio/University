import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { createSourceSnapshot } from "./fixtures/catalogue/source-snapshot.mjs";
import { testProcessEnvironment } from "./process-environment.mjs";

function temporaryRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "university-catalogue-isolation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    env: testProcessEnvironment(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

test("frozen source recreates its recorded commit without the original checkout", (t) => {
  const source = JSON.parse(
    gunzipSync(readFileSync(new URL("./fixtures/catalogue/source.json.gz", import.meta.url))),
  );
  const manifest = JSON.parse(
    readFileSync(new URL("./fixtures/catalogue/manifest.json", import.meta.url), "utf8"),
  );
  const commit = createSourceSnapshot(temporaryRoot(t), source.files);
  assert.equal(commit, source.sourceCommit);
  assert.equal(commit, manifest.source.fixtureCommit);
});

test("hook Git paths cannot redirect a test snapshot into another repository", (t) => {
  const root = temporaryRoot(t);
  // Both repositories are disposable test data, never the real checkout.
  const owner = join(root, "simulated-owner");
  createSourceSnapshot(owner, { "owner.txt": "Existing source must stay unchanged.\n" });
  git(
    owner,
    "-c",
    "user.name=Test owner",
    "-c",
    "user.email=test-owner@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--allow-empty",
    "-m",
    "Existing mainline history",
  );
  const before = git(owner, "rev-parse", "HEAD");
  const index = readFileSync(join(owner, ".git/index"));
  const fixture = join(root, "fixture");
  const moduleUrl = new URL("./fixtures/catalogue/source-snapshot.mjs", import.meta.url).href;
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {createSourceSnapshot} from ${JSON.stringify(moduleUrl)}; console.log(createSourceSnapshot(${JSON.stringify(fixture)}, {"sample.js":"export const sample = 1;\\n"}));`,
    ],
    {
      env: testProcessEnvironment({
        GIT_DIR: join(owner, ".git"),
        GIT_WORK_TREE: owner,
        GIT_INDEX_FILE: join(owner, ".git/index"),
        GIT_OBJECT_DIRECTORY: join(owner, ".git/objects"),
      }),
      encoding: "utf8",
    },
  ).trim();
  assert.equal(git(owner, "rev-parse", "HEAD"), before);
  assert.deepEqual(readFileSync(join(owner, ".git/index")), index);
  assert.equal(
    readFileSync(join(owner, "owner.txt"), "utf8"),
    "Existing source must stay unchanged.\n",
  );
  assert.equal(existsSync(join(fixture, ".git")), true);
  assert.equal(git(fixture, "rev-parse", "HEAD"), output);
  assert.notEqual(output, before);
});

test("source paths cannot escape the fixture or overwrite its Git metadata", (t) => {
  const root = temporaryRoot(t);
  assert.throws(
    () => createSourceSnapshot(join(root, "escape"), { "../outside.txt": "no" }),
    /Unsafe test source path/,
  );
  assert.equal(existsSync(join(root, "outside.txt")), false);
  assert.throws(
    () => createSourceSnapshot(join(root, "metadata"), { ".git/config": "no" }),
    /Unsafe test source path/,
  );
});
