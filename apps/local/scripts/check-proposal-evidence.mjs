#!/usr/bin/env node
/**
 * Checks every evidence reference in a course proposal against the real file at
 * its pinned commit, before the proposal is ever handed to the CLI.
 *
 * The workflows already reject bad evidence, but they reject it one reference at
 * a time and only after parsing everything else. When a proposal carries a
 * hundred references — which is what a generated course looks like — finding
 * them one failure per run is not a workflow. This reports all of them at once.
 *
 * Usage:
 *   node scripts/check-proposal-evidence.mjs <proposal.json> [--study <id>]
 *
 * The study is inferred from the proposal's snapshot when omitted.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const proposalPath = args.find((value) => !value.startsWith("--"));
const studyFlagIndex = args.indexOf("--study");
const studyFlag = studyFlagIndex === -1 ? null : args[studyFlagIndex + 1];

if (!proposalPath) {
  console.error("usage: node scripts/check-proposal-evidence.mjs <proposal.json> [--study <id>]");
  process.exit(2);
}

const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));

/** Proposals come in three shapes; every one of them nests lessons somewhere. */
function collectReferences(input) {
  const found = [];
  const fromLesson = (lesson, where) => {
    for (const reference of lesson.evidence ?? []) found.push({ ...reference, where });
    for (const card of lesson.cards ?? []) {
      for (const reference of card.evidence ?? []) {
        found.push({ ...reference, where: `${where} → card ${card.id}` });
      }
    }
    for (const exercise of lesson.exercises ?? []) {
      for (const reference of exercise.evidence ?? []) {
        found.push({ ...reference, where: `${where} → exercise ${exercise.id}` });
      }
    }
  };
  if (input.course) {
    for (const unit of input.course.units ?? []) {
      for (const lesson of unit.lessons ?? []) fromLesson(lesson, `lesson ${lesson.id}`);
    }
  }
  if (input.lesson) fromLesson(input.lesson, `lesson ${input.lesson.id}`);
  for (const lesson of input.lessons ?? []) fromLesson(lesson, `lesson ${lesson.id}`);
  return found;
}

function findStudyRepository(studiesRoot, snapshotId) {
  if (studyFlag) return join(studiesRoot, studyFlag, "source/repository.git");
  const candidates = readdirSync(studiesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(studiesRoot, entry.name));
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "source/snapshots", `${snapshotId}.json`))) {
      return join(candidate, "source/repository.git");
    }
    const snapshotDirectory = join(candidate, "source/snapshots");
    if (
      existsSync(snapshotDirectory) &&
      readdirSync(snapshotDirectory).some((n) => n.includes(snapshotId))
    ) {
      return join(candidate, "source/repository.git");
    }
  }
  return null;
}

const references = collectReferences(proposal);
if (references.length === 0) {
  console.error("No evidence references found — is this a course proposal?");
  process.exit(2);
}

/*
  Two pin kinds, two checks. A repository citation is checked against the file
  at its commit; a URL citation is checked by asking the page whether it is
  there. Before this split every reference was treated as a git pin, so a URL
  citation reported "undefined does not exist at undefined" and a general
  course — which has no snapshot at all — could not be checked.
*/
const repositoryReferences = references.filter((reference) => reference.sourcePath);
const urlReferences = references.filter((reference) => reference.sourceUrl);

const failures = [];
const seen = new Set();

if (repositoryReferences.length > 0) {
  const repository = findStudyRepository("studies", proposal.targetSnapshotId ?? "");
  if (!repository || !existsSync(repository)) {
    console.error(
      `Could not locate the study repository for snapshot ${proposal.targetSnapshotId}. Pass --study <id>.`,
    );
    process.exit(2);
  }

  const lineCounts = new Map();
  const countLines = (commit, path) => {
    const key = `${commit}:${path}`;
    if (!lineCounts.has(key)) {
      const text = execFileSync("git", ["-C", repository, "show", key], {
        encoding: "utf8",
        maxBuffer: 128 * 1024 * 1024,
      });
      lineCounts.set(
        key,
        text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length,
      );
    }
    return lineCounts.get(key);
  };

  for (const reference of repositoryReferences) {
    let total;
    try {
      total = countLines(reference.sourceCommit, reference.sourcePath);
    } catch {
      failures.push(
        `${reference.where}: ${reference.sourcePath} does not exist at ${reference.sourceCommit?.slice(0, 12)}`,
      );
      continue;
    }
    const { lineStart, lineEnd } = reference;
    if (lineStart === undefined && lineEnd === undefined) continue;
    if (lineStart < 1 || lineEnd > total || lineStart > lineEnd) {
      failures.push(
        `${reference.where}: ${reference.sourcePath} L${lineStart}-${lineEnd} but the file has ${total} lines`,
      );
      continue;
    }
    const key = `${reference.sourcePath}:${lineStart}-${lineEnd}`;
    if (!seen.has(key)) seen.add(key);
  }
}

/*
  Why the network check exists at all: the persist-time schema only checks the
  citation's *host* against the authority list. That catches an invented host
  and nothing else — a model that fabricates a claim will happily hang it on a
  real host and a page that was never written. Both defects look identical on
  disk, and the reader is the one who finds out.

  It fails closed. An unreachable host is reported rather than skipped, because
  a checker that quietly passes when it cannot look is a green gate that is not
  looking. Pass --no-network when that is genuinely intended; the skip is then
  printed, not silent.
*/
const skipNetwork = args.includes("--no-network");
if (urlReferences.length > 0 && skipNetwork) {
  console.log(`skipped ${urlReferences.length} URL citation(s): --no-network`);
} else if (urlReferences.length > 0) {
  const byUrl = new Map();
  for (const reference of urlReferences) {
    if (!byUrl.has(reference.sourceUrl)) byUrl.set(reference.sourceUrl, []);
    byUrl.get(reference.sourceUrl).push(reference.where);
  }

  /* HEAD is the polite request, but plenty of docs hosts answer it with 403 or
     405 while serving the same page to GET. Only a GET result is conclusive. */
  const reach = async (url) => {
    for (const method of ["HEAD", "GET"]) {
      try {
        const response = await fetch(url, { method, redirect: "follow" });
        if (response.ok) return { ok: true };
        if (method === "GET") return { ok: false, detail: `HTTP ${response.status}` };
      } catch (error) {
        if (method === "GET") return { ok: false, detail: error.message, network: true };
      }
    }
    return { ok: false, detail: "unreachable", network: true };
  };

  const results = await Promise.all([...byUrl.keys()].map(async (url) => [url, await reach(url)]));
  for (const [url, result] of results) {
    if (result.ok) {
      seen.add(url);
      continue;
    }
    for (const where of byUrl.get(url)) {
      failures.push(`${where}: ${url} — ${result.detail}`);
    }
  }
}

for (const key of [...seen].sort()) console.log(`ok  ${key}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} bad reference(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `\nall ${references.length} references resolve` +
    (repositoryReferences.length > 0 ? " at their pinned commits" : "") +
    (urlReferences.length > 0 && !skipNetwork
      ? ` (${urlReferences.length} URL citation(s) fetched)`
      : ""),
);
