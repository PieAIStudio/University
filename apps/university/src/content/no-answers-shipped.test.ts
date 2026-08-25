import { describe, expect, it } from "vitest";

/**
 * No reference answer may reach a customer's browser.
 *
 * `import-courses.mjs` strips `expectedAnswer` and `rubric` out of every
 * lesson and leaves a fingerprint the local grader can compare against. The
 * comment saying so has been rewritten once, by a change that put the answers
 * back under a new field name and reasoned that the read model would drop
 * them. A read model dropping a field does not unsend the bytes: the answers
 * were served, in plain text, to a learner who had attempted none of them.
 *
 * So the rule is checked here rather than remembered. This reads the packages
 * the delivery build actually imports, and it fails on the *shape* — any key
 * that looks like an answer — rather than on the three names known today,
 * because the last regression arrived under a name nobody had listed.
 */
const PACKAGES = import.meta.glob<unknown>("../../content/*/*.json", {
  eager: true,
  import: "default",
});

/*
  Substring, deliberately, and it took two tries to get here. The first draft
  was `/(^|[^a-z])(answer|solution|rubric)/i`, meaning to spare `answerKey` by
  requiring a boundary — and `[^a-z]` never matches inside camelCase, so
  `referenceAnswer` sailed through the gate written to catch `referenceAnswer`.
  It read as a working check and caught nothing. The allow-list below is what
  spares the fingerprint now; the pattern is allowed to be greedy.
*/
const ANSWER_KEY_PATTERN = /answer|solution|rubric/i;
/** The compiled fingerprint. It is not the answer and cannot be read back. */
const ALLOWED = new Set(["answerKey"]);

function offendingKeys(value: unknown, path: string, found: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => offendingKeys(item, `${path}[${index}]`, found));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (!ALLOWED.has(key) && ANSWER_KEY_PATTERN.test(key)) found.push(`${path}.${key}`);
    offendingKeys(child, `${path}.${key}`, found);
  }
}

describe("the packages the delivery build ships", () => {
  it("has packages to check", () => {
    expect(Object.keys(PACKAGES).length).toBeGreaterThan(0);
  });

  it("carries no reference answer under any name", () => {
    const found: string[] = [];
    for (const [path, pkg] of Object.entries(PACKAGES)) {
      offendingKeys(pkg, path.replace("../../content/", ""), found);
    }
    expect(found.slice(0, 12)).toEqual([]);
  });
});
