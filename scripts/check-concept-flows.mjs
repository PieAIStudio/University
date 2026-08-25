#!/usr/bin/env node

/**
 * Check the one-reusable-path rule for concept flows.
 *
 * Flow steps live on each entry by design. This gate compares entries that
 * chose the same title after removing only the per-entry `current` flag. A
 * different label or description is content drift, not a new flow.
 *
 * The core build runs before this script in `pnpm verify`, so this reads the
 * emitted catalogue rather than teaching a second parser how to execute the
 * TypeScript source files.
 */

let catalogue;
try {
  catalogue = await import("../packages/core/dist/concepts/catalogue.js");
} catch (error) {
  console.error("Unable to load the built concept catalogue.");
  console.error("Run `pnpm --filter @pieai/university-core build` first.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { CONCEPT_ENTRIES } = catalogue;

function flowOf(entry) {
  return entry.sections.find((section) => section.type === "flow");
}

function withoutCurrent(steps) {
  return steps.map(({ current: _current, ...step }) => step);
}

const FLOW_DESCRIPTION_MAX_LENGTH = 40;
const FORBIDDEN_FLOW_DESCRIPTION_TEXT = ["；", "打个比方"];

const wordingFailures = [];
for (const entry of CONCEPT_ENTRIES) {
  const flow = flowOf(entry);
  if (!flow) continue;

  flow.payload.steps.forEach((step, index) => {
    const length = Array.from(step.description).length;
    const forbidden = FORBIDDEN_FLOW_DESCRIPTION_TEXT.filter((text) =>
      step.description.includes(text),
    );
    if (length <= FLOW_DESCRIPTION_MAX_LENGTH && forbidden.length === 0) return;
    wordingFailures.push({
      id: entry.head.id,
      step: index + 1,
      length,
      forbidden,
      description: step.description,
    });
  });
}

if (wordingFailures.length > 0) {
  console.error(`Concept flow wording failed: ${wordingFailures.length} violation(s).`);
  for (const failure of wordingFailures) {
    const reasons = [];
    if (failure.length > FLOW_DESCRIPTION_MAX_LENGTH) {
      reasons.push(
        `description is ${failure.length} characters (maximum ${FLOW_DESCRIPTION_MAX_LENGTH})`,
      );
    }
    for (const forbidden of failure.forbidden) {
      reasons.push(`contains forbidden text ${JSON.stringify(forbidden)}`);
    }
    console.error(`  ${failure.id} step ${failure.step}: ${reasons.join(", ")}`);
    console.error(`    description: ${JSON.stringify(failure.description)}`);
  }
  process.exit(1);
}

function firstDifference(left, right) {
  if (left.length !== right.length) {
    return {
      step: Math.min(left.length, right.length) + 1,
      left: left.length,
      right: right.length,
      kind: "length",
    };
  }

  for (let index = 0; index < left.length; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
      return { step: index + 1, left: left[index], right: right[index], kind: "content" };
    }
  }
  return undefined;
}

const byTitle = new Map();
for (const entry of CONCEPT_ENTRIES) {
  const flow = flowOf(entry);
  if (!flow) continue;
  const entries = byTitle.get(flow.payload.title) ?? [];
  entries.push({ id: entry.head.id, steps: withoutCurrent(flow.payload.steps) });
  byTitle.set(flow.payload.title, entries);
}

const failures = [];
let sharedTitles = 0;
for (const [title, entries] of byTitle) {
  if (entries.length < 2) continue;
  sharedTitles += 1;
  const baseline = entries[0];
  for (const candidate of entries.slice(1)) {
    const difference = firstDifference(baseline.steps, candidate.steps);
    if (!difference) continue;
    failures.push({ title, baseline, candidate, difference });
  }
}

if (failures.length > 0) {
  console.error(`Concept flow consistency failed: ${failures.length} mismatch(es).`);
  for (const { title, baseline, candidate, difference } of failures) {
    console.error(`  title: ${title}`);
    console.error(`  entries: ${baseline.id} vs ${candidate.id}`);
    if (difference.kind === "length") {
      console.error(
        `  step ${difference.step}: length differs (${baseline.id}: ${difference.left}, ${candidate.id}: ${difference.right})`,
      );
    } else {
      console.error(`  step ${difference.step}: descriptions or labels differ`);
      console.error(`    ${baseline.id}: ${JSON.stringify(difference.left)}`);
      console.error(`    ${candidate.id}: ${JSON.stringify(difference.right)}`);
    }
  }
  process.exit(1);
}

console.log(
  `Concept flow consistency passed: ${sharedTitles} shared title(s), ${CONCEPT_ENTRIES.filter((entry) => flowOf(entry)).length} flow entrie(s); steps match after removing current.`,
);
