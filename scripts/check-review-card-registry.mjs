#!/usr/bin/env node
/**
 * Keep the learner queue inside the shared review surface's card-kind boundary.
 *
 * The UI registry is the authority for what the shared review implementation
 * serves. This gate reads that registry and compares it with the card kinds the
 * local overview actually publishes. A new queue kind therefore has to be
 * designed and registered before it can pass verification.
 *
 * Usage: node scripts/check-review-card-registry.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_SOURCE_PATH = join(ROOT, "packages/ui/src/review/scheduler-ports.ts");
const DUE_QUEUE_SOURCE_PATH = join(ROOT, "apps/local/server/workflows/learning-overview.ts");

function registryFromSource(source) {
  const match = /const REVIEW_CARD_KIND_REGISTRY\s*=\s*\{([\s\S]*?)\}\s*as const\s+satisfies/.exec(
    source,
  );
  if (!match) throw new Error("review card registry declaration was not found");

  const entries = new Map();
  for (const entry of match[1].matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
    const [, kind, status] = entry;
    if (!kind || !status) continue;
    if (entries.has(kind)) throw new Error(`review card registry repeats ${kind}`);
    if (status !== "supported" && status !== "unsupported") {
      throw new Error(`review card registry has an invalid status for ${kind}: ${status}`);
    }
    entries.set(kind, status);
  }
  if (entries.size === 0) throw new Error("review card registry is empty");
  return entries;
}

function closingBrace(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function dueKindsFromSource(source) {
  const kinds = [];
  let searchFrom = 0;
  while (true) {
    const callIndex = source.indexOf("dueCards.push(", searchFrom);
    if (callIndex === -1) break;
    const openingIndex = source.indexOf("{", callIndex);
    if (openingIndex === -1) throw new Error("a dueCards.push call has no object literal");
    const closingIndex = closingBrace(source, openingIndex);
    if (closingIndex === -1) throw new Error("a dueCards.push object is not closed");
    const body = source.slice(openingIndex + 1, closingIndex);
    const matches = [...body.matchAll(/\bkind\s*:\s*["']([^"']+)["']/g)];
    if (matches.length !== 1) {
      throw new Error("each dueCards.push object must declare exactly one literal card kind");
    }
    kinds.push(matches[0][1]);
    searchFrom = closingIndex + 1;
  }
  if (kinds.length === 0) throw new Error("no due card publications were found");
  return kinds;
}

export function reviewCardRegistryErrors({ registrySource, dueQueueSource }) {
  const registry = registryFromSource(registrySource);
  const dueKinds = dueKindsFromSource(dueQueueSource);
  const errors = [];
  for (const kind of dueKinds) {
    if (registry.get(kind) !== "supported") {
      errors.push(`due queue publishes ${kind}, but the review registry marks it unsupported`);
    }
  }
  return errors;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function selfTest() {
  const registrySource = `
    const REVIEW_CARD_KIND_REGISTRY = {
      "course-card": "supported",
      "knowledge-card": "unsupported",
    } as const satisfies Record<ReviewCardLocator["kind"], ReviewCardKindSupport>;
  `;
  const supportedQueue = `dueCards.push({ kind: "course-card" });`;
  const mismatchedQueue = `dueCards.push({ kind: "knowledge-card" });`;
  assert(
    reviewCardRegistryErrors({ registrySource, dueQueueSource: supportedQueue }).length === 0,
    "supported due kind should pass the self-test",
  );
  assert(
    reviewCardRegistryErrors({ registrySource, dueQueueSource: mismatchedQueue }).length === 1,
    "unsupported due kind should fail the self-test",
  );
  console.log("review card registry self-test:");
  console.log("  supported due kind: green");
  console.log("  unsupported due kind: red");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  let errors;
  try {
    errors = reviewCardRegistryErrors({
      registrySource: readFileSync(REGISTRY_SOURCE_PATH, "utf8"),
      dueQueueSource: readFileSync(DUE_QUEUE_SOURCE_PATH, "utf8"),
    });
  } catch (error) {
    console.error(`review card registry: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (errors.length > 0) {
    console.error("review card registry: mismatch");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log("review card registry: ok");
}
