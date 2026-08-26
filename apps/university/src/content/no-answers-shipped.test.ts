import { describe, expect, it } from "vitest";
import { publicDtoViolations } from "../../scripts/delivery-artifact.mjs";

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
 * the delivery build actually imports, and it fails on both the *shape* and
 * the *values*: an author field or an author-machine route is a leak even when
 * somebody gives it a new name.
 */
const PACKAGES = import.meta.glob<unknown>("../../content/*/*.json", {
  eager: true,
  import: "default",
});

describe("the packages the delivery build ships", () => {
  it("has packages to check", () => {
    expect(Object.keys(PACKAGES).length).toBeGreaterThan(0);
  });

  it("carries no reference answer, author fields, or author-machine route values", () => {
    const found: string[] = [];
    for (const [path, pkg] of Object.entries(PACKAGES)) {
      found.push(...publicDtoViolations(pkg, path.replace("../../content/", "")));
    }
    expect(found.slice(0, 12)).toEqual([]);
  });
});
