#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "../../..");
const catalogPath = resolve(import.meta.dirname, "../published-catalog.json");
const recoveryRoot = resolve(projectRoot, "apps/local/course-proposals/recovery");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Refuse an export that takes a published course away from customers.
 *
 * `check-shelf` compares the build's own output against the build's own input,
 * so both sides shrink together and it cannot see a course that fell out
 * upstream of both. This check compares the export against what the product
 * has already promised, which is the only side that does not move.
 *
 * Additions need no permission — publishing is gated elsewhere (ADR-0002).
 * Removals do, because a removal reaches someone who can already see the
 * course. Marking a course `stale` on disk is an authoring state, not a
 * decision to unpublish it; this is where that decision gets made.
 */
export function checkPublishedCatalogData(record, exported) {
  const removed = [];
  const added = [];
  const studies = record?.studies ?? {};

  for (const [studyId, publishedIds] of Object.entries(studies)) {
    const exportedIds = exported[studyId];
    if (exportedIds === undefined) {
      for (const courseId of publishedIds) removed.push(`${studyId}/${courseId}`);
      continue;
    }
    const present = new Set(exportedIds);
    for (const courseId of publishedIds) {
      if (!present.has(courseId)) removed.push(`${studyId}/${courseId}`);
    }
  }

  for (const [studyId, exportedIds] of Object.entries(exported)) {
    const published = new Set(studies[studyId] ?? []);
    for (const courseId of exportedIds) {
      if (!published.has(courseId)) added.push(`${studyId}/${courseId}`);
    }
  }

  if (removed.length > 0) {
    throw new Error(
      `this export unpublishes ${removed.length} course(s) that customers can already see:\n` +
        `${removed.map((id) => `  - ${id}`).join("\n")}\n` +
        `If you mean to take them away, record it: ` +
        `node apps/university/scripts/check-published-catalog.mjs --accept-removals`,
    );
  }

  return { published: Object.values(studies).flat().length, added };
}

export function readExportedCatalog(root = recoveryRoot) {
  const exported = {};
  if (!existsSync(root)) return exported;
  for (const studyId of readdirSync(root).sort()) {
    const indexPath = join(root, studyId, "index.json");
    if (!existsSync(indexPath)) continue;
    const index = readJson(indexPath);
    exported[studyId] = (index.courses ?? []).map((entry) => entry.courseId).sort();
  }
  return exported;
}

function acceptRemovals(record, exported) {
  const next = { ...record, studies: { ...record.studies } };
  for (const [studyId, exportedIds] of Object.entries(exported)) next.studies[studyId] = exportedIds;
  for (const studyId of Object.keys(next.studies)) {
    if (exported[studyId] === undefined) delete next.studies[studyId];
  }
  writeFileSync(catalogPath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

if (resolve(process.argv[1] ?? "") === resolve(import.meta.filename)) {
  try {
    const record = readJson(catalogPath);
    const rootFlag = process.argv.indexOf("--recovery-root");
    const exported = readExportedCatalog(
      rootFlag === -1 ? recoveryRoot : resolve(process.argv[rootFlag + 1] ?? ""),
    );
    if (process.argv.includes("--accept-removals")) {
      const next = acceptRemovals(record, exported);
      const count = Object.values(next.studies).flat().length;
      console.log(`check-published-catalog: recorded ${count} published course(s).`);
    } else {
      const result = checkPublishedCatalogData(record, exported);
      const grew = result.added.length > 0 ? `; ${result.added.length} newly published` : "";
      console.log(
        `check-published-catalog: all ${result.published} published course(s) still ship${grew}.`,
      );
    }
  } catch (error) {
    console.error(
      `check-published-catalog: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
