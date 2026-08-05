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
    if (existsSync(snapshotDirectory) && readdirSync(snapshotDirectory).some((n) => n.includes(snapshotId))) {
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

const repository = findStudyRepository("studies", proposal.targetSnapshotId ?? "");
if (!repository || !existsSync(repository)) {
  console.error(
    `Could not locate the study repository for snapshot ${proposal.targetSnapshotId}. Pass --study <id>.`,
  );
  process.exit(2);
}

const lineCounts = new Map();
function countLines(commit, path) {
  const key = `${commit}:${path}`;
  if (!lineCounts.has(key)) {
    const text = execFileSync("git", ["-C", repository, "show", key], {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    });
    lineCounts.set(key, text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length);
  }
  return lineCounts.get(key);
}

const failures = [];
const seen = new Set();
for (const reference of references) {
  let total;
  try {
    total = countLines(reference.sourceCommit, reference.sourcePath);
  } catch {
    failures.push(`${reference.where}: ${reference.sourcePath} does not exist at ${reference.sourceCommit?.slice(0, 12)}`);
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

for (const key of [...seen].sort()) console.log(`ok  ${key}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} bad reference(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`\nall ${references.length} references resolve at their pinned commits`);
