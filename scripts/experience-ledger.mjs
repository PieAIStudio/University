/**
 * The ledger that lets a finding die.
 *
 * An AI review loop does not fail because the model is bad at noticing. It
 * fails on round two, when eighty percent of the report is what you already
 * read on round one, and you stop reading. Measured here on 2026-08-31: two
 * independent reviewers walking the same live site agreed on 5 of 5 top
 * findings and shared none of the remaining 11. Convergence is highest exactly
 * where re-reporting is most tiring.
 *
 * So each finding is keyed on the *thing* — screen, element, category — and
 * never on how it was described. The same defect arrived once as "the account
 * page says login is unavailable and then draws a login form" and once as "the
 * publishable key is absent from the bundle": one symptom, one cause, same
 * defect. Text similarity would have filed them apart.
 *
 * The second rule is the one that makes the loop compound instead of repeat:
 * a finding may only be marked `fixed` when it names the test that keeps it
 * fixed. Without that, it comes back in three weeks and the loop is Sisyphus.
 *
 *   node scripts/experience-ledger.mjs check          gate: run it in verify
 *   node scripts/experience-ledger.mjs list [state]   read it
 *   node scripts/experience-ledger.mjs diff run.json  what is new since
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LEDGER = fileURLToPath(new URL("../e2e/experience-ledger.json", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const STATES = new Set(["open", "fixed", "accepted", "wontfix"]);
const SEVERITIES = new Set(["blocking", "friction", "polish"]);

/**
 * A separator that cannot appear inside a screen, an element or a category,
 * so two different keys can never collide by running together.
 */
const KEY_SEPARATOR = "\u0000";

/** Screen, element and category — never the prose. See the note above. */
export function findingId({ screen, element, category }) {
  return createHash("sha256")
    .update([screen, element, category].join(KEY_SEPARATOR))
    .digest("hex")
    .slice(0, 12);
}

function load() {
  if (!existsSync(LEDGER)) {
    console.error(`experience ledger: no ledger at ${LEDGER}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(LEDGER, "utf8"));
}

const GUARD_FILE = /(?:[\w.-]+\/)+[\w.-]+\.(?:tsx|ts|mjs|js)/gu;

/**
 * A guard nobody can follow is not a guard.
 *
 * Checking only that `guardedBy` is non-empty made this gate the same shape as
 * the three blind ones found on 2026-09-01: it watched the field, not the
 * thing. Fourteen of twenty-six guards turned out to name a file that was
 * never given, or a test name that no longer existed in the file it named.
 *
 * Format stays loose on purpose — `path::name`, `path name` and several names
 * separated by ` / ` are all in use and all readable. What is strict is
 * resolution: every path must exist, and any name left over must appear in the
 * file beside it.
 *
 * Name the test by its stable id (`O1`, `X3/X5`), not by its prose title. The
 * seven guards this first caught were paraphrases of Chinese titles that had
 * since been reworded, and a reference keyed on wording breaks every time
 * someone improves a sentence — the same reason probes key on structure.
 */
function unresolvedGuards(guardedBy) {
  const problems = [];
  // Several tests in the same file are written as "path::first / second", so a
  // reference with no path of its own inherits the last one named.
  let inherited;
  for (const reference of String(guardedBy).split(" / ")) {
    const trimmed = reference.trim();
    if (trimmed === "") continue;
    const paths = trimmed.match(GUARD_FILE) ?? [];
    if (paths.length === 0) {
      if (inherited === undefined) {
        problems.push(`guard "${trimmed}" names no file — say which file holds this test`);
        continue;
      }
      const source = readFileSync(resolve(repoRoot, inherited), "utf8");
      if (!source.includes(trimmed)) {
        problems.push(`guard "${trimmed}" is not in ${inherited} — renamed or deleted`);
      }
      continue;
    }
    inherited = paths[0];
    const missing = paths.filter((path) => !existsSync(resolve(repoRoot, path)));
    if (missing.length > 0) {
      problems.push(`guard names a file that does not exist: ${missing.join(", ")}`);
      continue;
    }
    const name = trimmed.replaceAll(GUARD_FILE, "").replaceAll("::", " ").trim();
    if (name === "" || paths.length > 1) continue;
    const source = readFileSync(resolve(repoRoot, paths[0]), "utf8");
    if (!source.includes(name)) {
      problems.push(`guard "${name}" is not in ${paths[0]} — renamed or deleted`);
    }
  }
  return problems;
}

function check() {
  const doc = load();
  const problems = [];
  const seen = new Map();

  for (const finding of doc.findings ?? []) {
    const where = `${finding.id ?? "(no id)"} ${finding.summary ?? ""}`.trim();
    if (!STATES.has(finding.state)) problems.push(`${where}: state "${finding.state}" is not one of ${[...STATES].join("/")}`);
    if (!SEVERITIES.has(finding.severity)) problems.push(`${where}: severity "${finding.severity}" is not one of ${[...SEVERITIES].join("/")}`);

    const expected = findingId(finding);
    if (finding.id !== expected) {
      problems.push(`${where}: id does not match screen+element+category (expected ${expected})`);
    }
    if (seen.has(finding.id)) {
      problems.push(`${where}: duplicate of ${seen.get(finding.id)} — same screen, element and category`);
    }
    seen.set(finding.id, finding.summary ?? finding.id);

    /*
     * The rule the whole loop rests on. "Fixed" without a named guard is a
     * promise that the same walkthrough will find it again, and nobody will
     * believe the ledger after that happens twice.
     */
    if (finding.state === "fixed" && !finding.guardedBy) {
      problems.push(`${where}: marked fixed but names no test that keeps it fixed`);
    } else if (finding.state === "fixed") {
      for (const problem of unresolvedGuards(finding.guardedBy)) {
        problems.push(`${where}: ${problem}`);
      }
    }
    if (finding.state === "accepted" && !finding.why) {
      problems.push(`${where}: accepted as debt but does not say why`);
    }
  }

  if (problems.length > 0) {
    console.error("experience ledger: the ledger does not hold.\n");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  const counts = {};
  for (const finding of doc.findings ?? []) counts[finding.state] = (counts[finding.state] ?? 0) + 1;
  const summary = Object.entries(counts).map(([state, n]) => `${n} ${state}`).join(", ");
  console.log(`experience ledger: ok (${doc.findings?.length ?? 0} findings — ${summary})`);
}

function list(state) {
  const doc = load();
  for (const finding of doc.findings ?? []) {
    if (state && finding.state !== state) continue;
    const guard = finding.guardedBy ? ` [${finding.guardedBy}]` : "";
    console.log(`${finding.id}  ${finding.severity.padEnd(8)} ${finding.state.padEnd(8)} ${finding.screen}  ${finding.summary}${guard}`);
  }
}

/** A run is a list of raw findings; print only the ones the ledger has not seen. */
function diff(path) {
  const known = new Set((load().findings ?? []).map((finding) => finding.id));
  const run = JSON.parse(readFileSync(path, "utf8"));
  const fresh = (Array.isArray(run) ? run : (run.findings ?? [])).filter(
    (finding) => !known.has(finding.id ?? findingId(finding)),
  );
  if (fresh.length === 0) {
    console.log("experience ledger: nothing new in this run.");
    return;
  }
  console.log(`experience ledger: ${fresh.length} finding(s) the ledger has not seen\n`);
  for (const finding of fresh) {
    console.log(`  ${findingId(finding)}  ${finding.screen}  ${finding.element}  ${finding.summary ?? ""}`);
  }
}

// Only act as a CLI when invoked as one. A test importing `findingId` must
// not run the gate and exit the process that imported it.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const [command = "check", argument] = process.argv.slice(2);
  if (command === "check") check();
  else if (command === "list") list(argument);
  else if (command === "diff") diff(argument);
  else {
    console.error(`experience ledger: unknown command "${command}" (check | list | diff)`);
    process.exit(1);
  }
}
