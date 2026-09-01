#!/usr/bin/env node
/**
 * Keep author workflow status out of the learner-facing content projections.
 *
 * The recovery packages are allowed to carry authoring state. The generated
 * manifest and shelf are delivery projections, so their course, unit, and
 * lesson data must contain learner facts only. This check reads those files
 * rather than trusting the TypeScript view types or the importer source.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const contentRoot = resolve(import.meta.dirname, "../content");
const AUTHOR_STATUS_KEY = "status";
const SELF_TEST_TITLE =
  "injected author status at course, unit, and lesson turns red, then restoration turns green";

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${label} at ${path}: ${detail}`);
  }
}

/** Return every author workflow status field found in a delivery projection. */
export function publicBoundaryViolations(value, path = "projection") {
  const violations = [];

  const visit = (current, at) => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (current === null || typeof current !== "object") return;

    for (const [key, child] of Object.entries(current)) {
      const childPath = `${at}.${key}`;
      if (key === AUTHOR_STATUS_KEY) {
        violations.push(`${childPath}=${JSON.stringify(child)}`);
      }
      visit(child, childPath);
    }
  };

  visit(value, path);
  return violations;
}

export function publicBoundaryErrors({ manifest, shelf } = {}) {
  return [
    ["manifest", manifest],
    ["shelf", shelf],
  ].flatMap(([name, projection]) => publicBoundaryViolations(projection, name));
}

function failureMessage(violations) {
  const shown = violations.slice(0, 20);
  const remainder =
    violations.length > shown.length ? `\n  ... and ${violations.length - shown.length} more` : "";
  return (
    "author workflow status crossed the learner publish boundary:\n" +
    shown.map((violation) => `  - ${violation}`).join("\n") +
    remainder
  );
}

export function checkPublicBoundaryData(projections) {
  const violations = publicBoundaryErrors(projections);
  if (violations.length > 0) throw new Error(failureMessage(violations));
  return { projections: 2, violations: [] };
}

export function checkPublicBoundaryFiles({ manifestPath, shelfPath } = {}) {
  const resolvedManifest = manifestPath ?? join(contentRoot, "manifest.json");
  const resolvedShelf = shelfPath ?? join(contentRoot, "shelf.json");
  return checkPublicBoundaryData({
    manifest: readJson(resolvedManifest, "delivery manifest"),
    shelf: readJson(resolvedShelf, "delivery shelf"),
  });
}

function writeProjectionFiles(root, projections) {
  const manifestPath = join(root, "manifest.json");
  const shelfPath = join(root, "shelf.json");
  writeFileSync(manifestPath, `${JSON.stringify(projections.manifest)}\n`);
  writeFileSync(shelfPath, `${JSON.stringify(projections.shelf)}\n`);
  return { manifestPath, shelfPath };
}

function learnerProjectionFixture() {
  return {
    manifest: {
      importedAt: "2026-09-01",
      evidenceMode: "auto",
      studies: [
        {
          studyId: "study",
          courses: [
            {
              courseId: "course",
              isBeingRewritten: true,
            },
          ],
        },
      ],
    },
    shelf: {
      studies: [
        {
          id: "study",
          courses: [
            {
              id: "course",
              isBeingRewritten: true,
              units: [
                {
                  id: "unit",
                  lessons: [{ id: "lesson" }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function expectRed(label, root, projections) {
  const paths = writeProjectionFiles(root, projections);
  let failure;
  try {
    checkPublicBoundaryFiles(paths);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error, `${label} should fail closed`);
  assert.match(
    failure.message,
    /author workflow status crossed the learner publish boundary/,
    `${label} should name the boundary violation`,
  );
  console.log(`  ${label}: red`);
  console.log(`    ${failure.message.split("\n")[1]}`);
}

export function runSelfTests() {
  const root = mkdtempSync(join(tmpdir(), "university-public-boundary-"));
  try {
    const projections = learnerProjectionFixture();
    const paths = writeProjectionFiles(root, projections);

    checkPublicBoundaryFiles(paths);
    console.log("check-public-boundary self-test:");
    console.log("  isBeingRewritten learner fact: green");

    projections.manifest.status = "draft";
    expectRed("injected manifest status", root, projections);
    delete projections.manifest.status;

    projections.shelf.studies[0].courses[0].status = "active";
    expectRed("injected course status", root, projections);
    delete projections.shelf.studies[0].courses[0].status;

    projections.shelf.studies[0].courses[0].units[0].status = "stale";
    expectRed("injected unit status", root, projections);
    delete projections.shelf.studies[0].courses[0].units[0].status;

    projections.shelf.studies[0].courses[0].units[0].lessons[0].status = "retired";
    expectRed("injected lesson status", root, projections);
    delete projections.shelf.studies[0].courses[0].units[0].lessons[0].status;

    writeProjectionFiles(root, projections);
    checkPublicBoundaryFiles(paths);
    console.log(`  ${SELF_TEST_TITLE}: green`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  runSelfTests();
} else {
  try {
    const result = checkPublicBoundaryFiles();
    console.log(
      `check-public-boundary: ${result.projections} delivery projections contain no author status fields.`,
    );
  } catch (error) {
    console.error(
      `check-public-boundary: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
