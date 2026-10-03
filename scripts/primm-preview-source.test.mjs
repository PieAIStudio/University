import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolvePrimmPreviewSource } from "./primm-preview-source.mjs";

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "primm-preview-source-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const preview = join(root, "preview");
  mkdirSync(join(preview, "content"), { recursive: true });
  mkdirSync(join(preview, "recovery", "study"), { recursive: true });
  const manifestPath = join(preview, "imported.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({ studies: [{ studyId: "study", courses: [{ courseId: "course" }] }] }),
  );
  const receipt = {
    schemaVersion: 1,
    purpose: "unpublished-owner-reading",
    studyId: "study",
    courseId: "course",
    contentRoot: join(preview, "content"),
    recoveryRoot: join(preview, "recovery", "study"),
    manifestPath,
    manifestSha256: createHash("sha256").update(readFileSync(manifestPath)).digest("hex"),
  };
  const save = () => writeFileSync(join(preview, "receipt.json"), JSON.stringify(receipt));
  save();
  return { root, preview, receipt, save };
}
test("the ordinary preview keeps its original formal sources", (t) => {
  const { root } = fixture(t);
  const source = resolvePrimmPreviewSource(root);
  assert.equal(source.unpublished, false);
  assert.equal(source.contentRoot, join(root, "apps/university/content"));
  assert.deepEqual(source.appEnvironment, {});
});
test("one explicit native projection feeds both execution and the app catalogue", (t) => {
  const { root, preview, receipt } = fixture(t);
  const source = resolvePrimmPreviewSource(root, preview);
  assert.equal(source.unpublished, true);
  assert.equal(source.recoveryRoot, receipt.recoveryRoot);
  assert.equal(source.appEnvironment.UNIVERSITY_CONTENT_ROOT, source.contentRoot);
  assert.equal(source.appEnvironment.UNIVERSITY_IMPORTED_MANIFEST_PATH, receipt.manifestPath);
});
test("missing, changed or wrongly scoped receipts never fall back to formal content", (t) => {
  const { root, preview, receipt, save } = fixture(t);
  receipt.purpose = "other";
  save();
  assert.throws(() => resolvePrimmPreviewSource(root, preview), /unpublished/);
  receipt.purpose = "unpublished-owner-reading";
  receipt.manifestSha256 = "0".repeat(64);
  save();
  assert.throws(() => resolvePrimmPreviewSource(root, preview), /changed/);
  receipt.contentRoot = root;
  save();
  assert.throws(() => resolvePrimmPreviewSource(root, preview), /own projection/);
  assert.throws(() => resolvePrimmPreviewSource(root, join(root, "missing")));
});
test("a symlinked content root outside the explicit projection is rejected", (t) => {
  const { root, preview, receipt } = fixture(t);
  rmSync(receipt.contentRoot, { recursive: true });
  const external = join(root, "external");
  mkdirSync(external);
  symlinkSync(external, receipt.contentRoot, "dir");
  assert.throws(() => resolvePrimmPreviewSource(root, preview), /escapes/);
});
