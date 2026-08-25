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
