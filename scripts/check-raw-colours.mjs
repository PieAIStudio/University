import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  FIXED_MATERIAL,
  PENDING_MIGRATION_COUNT,
  PENDING_MIGRATION_START_COUNT,
  PENDING_MIGRATIONS,
  RAW_COLOUR_SOURCE_FILES,
} from "./raw-colour-registry.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RAW_COLOUR_PATTERN =
  /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;

function sourceEntries(sources) {
  return sources instanceof Map ? sources.entries() : Object.entries(sources);
}

export function scanRawColours(sources) {
  const entries = [];

  for (const [path, source] of sourceEntries(sources)) {
    const lines = source.split("\n");

    lines.forEach((line, lineIndex) => {
      RAW_COLOUR_PATTERN.lastIndex = 0;

      for (const match of line.matchAll(RAW_COLOUR_PATTERN)) {
        entries.push({
          path,
          line: lineIndex + 1,
          column: match.index + 1,
          literal: match[0],
        });
      }
    });
  }

  return entries;
}

function entryKey(entry) {
  return [entry.path, entry.line, entry.column, entry.literal].join("\u0000");
}

function entryLabel(entry) {
  return (
    entry.path +
    ":" +
    entry.line +
    ":" +
    entry.column +
    ': "' +
    entry.literal +
    '"'
  );
}

function readProductionSources() {
  return new Map(
    RAW_COLOUR_SOURCE_FILES.map((relativePath) => [
      relativePath,
      readFileSync(join(ROOT, relativePath), "utf8"),
    ]),
  );
}

export function validateRawColourRatchet({
  sources,
  fixedMaterial = FIXED_MATERIAL,
  pendingMigrations = PENDING_MIGRATIONS,
  pendingMigrationCount = PENDING_MIGRATION_COUNT,
  pendingMigrationStartCount = PENDING_MIGRATION_START_COUNT,
} = {}) {
  const actualEntries = scanRawColours(sources);
  const actualKeys = new Set(actualEntries.map(entryKey));
  const fixedKeys = new Set();
  const pendingKeys = new Set();
  const errors = [];

  for (const entry of fixedMaterial) {
    const key = entryKey(entry);

    if (fixedKeys.has(key)) {
      errors.push(
        "fixed material registry contains a duplicate: " + entryLabel(entry),
      );
    }

    fixedKeys.add(key);

    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      errors.push(
        "fixed material registry entry has no human-written reason: " +
          entryLabel(entry),
      );
    }

    if (!actualKeys.has(key)) {
      errors.push(
        "fixed material registry entry does not exist in source: " +
          entryLabel(entry),
      );
    }
  }

  for (const entry of pendingMigrations) {
    const key = entryKey(entry);

    if (pendingKeys.has(key)) {
      errors.push(
        "pending migration ledger contains a duplicate: " + entryLabel(entry),
      );
    }

    pendingKeys.add(key);

    if (!actualKeys.has(key)) {
      errors.push(
        "pending migration entry no longer exists; remove it after migration: " +
          entryLabel(entry),
      );
    }
  }

  for (const entry of fixedMaterial) {
    const key = entryKey(entry);

    if (pendingKeys.has(key)) {
      errors.push("an entry appears in both registries: " + entryLabel(entry));
    }
  }

  const registeredKeys = new Set([...fixedKeys, ...pendingKeys]);
  const unregisteredEntries = actualEntries.filter(
    (entry) => !registeredKeys.has(entryKey(entry)),
  );

  if (unregisteredEntries.length > 0) {
    errors.push("raw colour is not registered in either registry:");

    for (const entry of unregisteredEntries) {
      errors.push("  " + entryLabel(entry));
    }
  }

  const actualPendingCount = actualEntries.filter(
    (entry) => !fixedKeys.has(entryKey(entry)),
  ).length;

  if (pendingMigrationCount < actualPendingCount) {
    errors.push(
      "pending migration count " +
        pendingMigrationCount +
        " is less than actual debt " +
        actualPendingCount,
    );
  }

  if (pendingMigrationCount > actualPendingCount) {
    errors.push(
      "pending migration count " +
        pendingMigrationCount +
        " exceeds actual debt " +
        actualPendingCount +
        "; remove migrated entries from the ledger",
    );
  }

  if (pendingMigrationCount !== pendingMigrations.length) {
    errors.push(
      "pending migration count " +
        pendingMigrationCount +
        " does not match ledger length " +
        pendingMigrations.length,
    );
  }

  if (pendingMigrationCount > pendingMigrationStartCount) {
    errors.push(
      "pending migration count increased from " +
        pendingMigrationStartCount +
        " to " +
        pendingMigrationCount,
    );
  }

  if (pendingMigrations.length > pendingMigrationStartCount) {
    errors.push(
      "pending migration ledger increased from " +
        pendingMigrationStartCount +
        " to " +
        pendingMigrations.length +
        " entries",
    );
  }

  return {
    actualEntries,
    actualFixedCount: actualEntries.filter((entry) =>
      fixedKeys.has(entryKey(entry)),
    ).length,
    actualPendingCount,
    errors,
  };
}

function expectRed(label, options, evidenceNeedle) {
  const result = validateRawColourRatchet(options);

  assert.notEqual(result.errors.length, 0, label + " should fail");
  const evidence =
    result.errors.find((error) => error.includes(evidenceNeedle)) ??
    result.errors[0];

  console.log("  " + label + ": red");
  console.log("    " + evidence);
}

function fixtureEntry(source, literal, occurrence = 0) {
  const entries = scanRawColours(
    new Map([["fixture.css", source]]),
  ).filter((entry) => entry.literal === literal);

  assert.ok(entries[occurrence], "fixture literal not found: " + literal);
  return entries[occurrence];
}

export function runSelfTests() {
  const baseSource = [
    ".fixed { color: #111111; }",
    ".pending { background: rgb(1 2 3); }",
  ].join("\n");
  const fixedEntry = fixtureEntry(baseSource, "#111111");
  const pendingEntry = fixtureEntry(baseSource, "rgb(1 2 3)");

  console.log("check-raw-colours self-test:");

  const registeredOptions = {
    sources: new Map([["fixture.css", baseSource]]),
    fixedMaterial: [{ ...fixedEntry, reason: "fixture brand mark" }],
    pendingMigrations: [pendingEntry],
    pendingMigrationCount: 1,
    pendingMigrationStartCount: 1,
  };

  expectRed(
    "1. injected raw colour outside both registries",
    {
      ...registeredOptions,
      sources: new Map([
        [
          "fixture.css",
          baseSource + "\n.injected { color: #abcdef; }",
        ],
      ]),
    },
    "#abcdef",
  );

  expectRed(
    "2. fixed registry source missing",
    {
      ...registeredOptions,
      fixedMaterial: [
        {
          ...fixedEntry,
          literal: "#999999",
          reason: "fixture brand mark",
        },
      ],
    },
    "fixed material registry entry does not exist",
  );

  const countSource = [
    ".fixed { color: #111111; }",
    ".pending-a { background: rgb(1 2 3); }",
    ".pending-b { background: #222222; }",
  ].join("\n");
  const countFixedEntry = fixtureEntry(countSource, "#111111");
  const countPendingEntries = [
    fixtureEntry(countSource, "rgb(1 2 3)"),
    fixtureEntry(countSource, "#222222"),
  ];

  expectRed(
    "3. declared pending count below actual debt",
    {
      sources: new Map([["fixture.css", countSource]]),
      fixedMaterial: [{ ...countFixedEntry, reason: "fixture brand mark" }],
      pendingMigrations: countPendingEntries,
      pendingMigrationCount: 1,
      pendingMigrationStartCount: 2,
    },
    "is less than actual debt",
  );

  const withdrawn = validateRawColourRatchet({
    sources: new Map([["fixture.css", ""]]),
    fixedMaterial: [],
    pendingMigrations: [],
    pendingMigrationCount: 0,
    pendingMigrationStartCount: PENDING_MIGRATION_START_COUNT,
  });

  assert.deepEqual(withdrawn.errors, []);
  console.log("  4. all raw colours withdrawn: green");
}

if (process.argv.includes("--self-test")) {
  runSelfTests();
} else {
  const result = validateRawColourRatchet({
    sources: readProductionSources(),
  });

  if (result.errors.length > 0) {
    console.error("check-raw-colours: failed");

    for (const error of result.errors) {
      console.error(error);
    }

    process.exitCode = 1;
  } else {
    console.log(
      "check-raw-colours: ok (fixed material: " +
        FIXED_MATERIAL.length +
        "; pending migrations: " +
        PENDING_MIGRATIONS.length +
        "; raw colours: " +
        result.actualEntries.length +
        "; files: " +
        RAW_COLOUR_SOURCE_FILES.length +
        ")",
    );
  }
}
