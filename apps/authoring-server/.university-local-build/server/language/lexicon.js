import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { LexiconEntrySchema } from "@pieai/university-core/domain/schemas.js";
const LexiconFileSchema = z
    .object({
    schemaVersion: z.literal(1),
    note: z.string().optional(),
    entries: z.array(LexiconEntrySchema).min(1).max(5000),
})
    .strict();
let cached;
function lexiconPath() {
    const configuredRoot = process.env["UNIVERSITY_COURSE_ROOT"];
    if (configuredRoot) {
        return join(resolve(process.cwd(), configuredRoot), "vocabulary/en.json");
    }
    const generated = resolve(process.cwd(), "../university/src/content/lexicon.json");
    if (existsSync(generated))
        return generated;
    // The lexicon is repository content, not learner data: it is reviewed, it is
    // diffed, and a wrong gloss is a bug the same way a wrong lesson is.
    //
    // Found by walking up to the package root rather than by counting directory
    // levels: this module runs from TypeScript source under vitest and from the
    // compiled tree in the dev server, and those sit at different depths. A
    // fixed `../../..` was right for exactly one of the two.
    let directory = dirname(fileURLToPath(import.meta.url));
    for (let hops = 0; hops < 10; hops += 1) {
        const generated = join(directory, "apps/university/src/content/lexicon.json");
        if (existsSync(generated))
            return generated;
        const parent = dirname(directory);
        if (parent === directory)
            break;
        directory = parent;
    }
    throw new Error("Cannot locate UNIVERSITY_COURSE_ROOT/vocabulary/en.json");
}
/**
 * Loads the curated senses once.
 *
 * A duplicate `senseId` would make which gloss a learner sees depend on file
 * order, so it fails here rather than becoming an intermittent wrong answer.
 */
export function loadLexicon(path = lexiconPath()) {
    if (cached)
        return cached;
    // Course repositories may intentionally omit vocabulary. The importer
    // treats that as an empty foreign-language layer; the authoring API must
    // keep the same contract instead of turning an otherwise readable lesson
    // into a generic ENOENT error.
    if (!existsSync(path)) {
        cached = new Map();
        return cached;
    }
    const file = LexiconFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const map = new Map();
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
export function selectLexicon(senseIds) {
    const lexicon = loadLexicon();
    return senseIds.flatMap((senseId) => {
        const entry = lexicon.get(senseId);
        return entry ? [entry] : [];
    });
}
//# sourceMappingURL=lexicon.js.map