import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { LexiconEntrySchema, type LexiconEntry } from "@pieai/university-core/domain/schemas.js";

const LexiconFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    note: z.string().optional(),
    entries: z.array(LexiconEntrySchema).min(1).max(5000),
  })
  .strict();

let cached: ReadonlyMap<string, LexiconEntry> | undefined;

function lexiconPath(): string {
  // The lexicon is repository content, not learner data: it is reviewed, it is
  // diffed, and a wrong gloss is a bug the same way a wrong lesson is.
  //
  // Found by walking up to the package root rather than by counting directory
  // levels: this module runs from TypeScript source under vitest and from the
  // compiled tree in the dev server, and those sit at different depths. A
  // fixed `../../..` was right for exactly one of the two.
  let directory = dirname(fileURLToPath(import.meta.url));
  for (let hops = 0; hops < 10; hops += 1) {
    if (existsSync(join(directory, "package.json"))) {
      return join(directory, "data/vocabulary/en.json");
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("Cannot locate the project root that holds data/vocabulary/en.json");
}

/**
 * Loads the curated senses once.
 *
 * A duplicate `senseId` would make which gloss a learner sees depend on file
 * order, so it fails here rather than becoming an intermittent wrong answer.
 */
export function loadLexicon(path = lexiconPath()): ReadonlyMap<string, LexiconEntry> {
  if (cached) return cached;
  const file = LexiconFileSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  const map = new Map<string, LexiconEntry>();
  for (const entry of file.entries) {
    if (map.has(entry.senseId)) {
      throw new Error(`Lexicon contains a duplicate sense: ${entry.senseId}`);
    }
    map.set(entry.senseId, entry);
  }
  cached = map;
  return cached;
}

/** The senses a lesson actually uses, so the page ships nothing it will not show. */
export function selectLexicon(senseIds: readonly string[]): readonly LexiconEntry[] {
  const lexicon = loadLexicon();
  return senseIds.flatMap((senseId) => {
    const entry = lexicon.get(senseId);
    return entry ? [entry] : [];
  });
}
