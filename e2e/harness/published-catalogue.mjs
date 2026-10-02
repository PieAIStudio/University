import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { checkShelfData } from "../../apps/university/scripts/check-shelf.mjs";

/** Deliberate production-shelf exception. Invoked inside its test, never at
 * module collection; no role, historical ID, course count or private studies. */
export function inspectPublishedCatalogue() {
  const root = fileURLToPath(new URL("../../apps/university/", import.meta.url));
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const manifest = read(join(root, "src/content/imported.json"));
  const contentManifest = read(join(root, "content/manifest.json"));
  const shelf = read(join(root, "content/shelf.json"));
  assert.deepEqual(contentManifest, manifest, "published and tracked manifests must agree");
  const counts = checkShelfData(manifest, shelf);
  const fixture = read(
    fileURLToPath(new URL("../fixtures/catalogue/manifest.json", import.meta.url)),
  );
  const fixtureHashes = new Set(fixture.courses.map((course) => course.fixtureSha256));
  for (const study of manifest.studies) {
    assert.match(study.studyId, /^[a-z0-9-]+$/);
    const publishedStudy = shelf.studies.find((entry) => entry.id === study.studyId);
    for (const entry of study.courses) {
      assert.match(entry.courseId, /^[a-z0-9-]+$/);
      assert.equal(
        fixtureHashes.has(entry.sha256),
        false,
        "test recovery must not become a release input",
      );
      const bytes = readFileSync(join(root, "content", study.studyId, `${entry.courseId}.json`));
      assert.equal(
        bytes.includes(Buffer.from("UNIVERSITY_E2E_FROZEN_CATALOGUE")),
        false,
        "test-only course leaked into delivery content",
      );
      const course = JSON.parse(bytes).course;
      const publishedCourse = publishedStudy.courses.find((item) => item.id === entry.courseId);
      assert.equal(course.id, entry.courseId);
      assert.deepEqual(
        course.units.map((unit) => unit.id),
        publishedCourse.units.map((unit) => unit.id),
      );
      for (const unit of course.units) {
        const shelfUnit = publishedCourse.units.find((item) => item.id === unit.id);
        assert.deepEqual(
          unit.lessons.map((lesson) => [lesson.id, lesson.contentRevision]),
          shelfUnit.lessons.map((lesson) => [lesson.id, lesson.contentRevision]),
        );
      }
      assert.equal(
        course.units.reduce((n, unit) => n + unit.lessons.length, 0),
        entry.lessons,
      );
    }
  }
  return counts;
}
