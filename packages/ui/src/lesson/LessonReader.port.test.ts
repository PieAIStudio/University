import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The shared reader used to call the authoring shell's loopback API by URL.
 * That is why the delivery shell grew a second, thinner reader: it has no
 * server on 4317. A test that only rendered the tree would still pass after
 * someone put a fetch back — jsdom would swallow it. Reading the source is
 * the check that actually fails.
 */
const here = dirname(fileURLToPath(import.meta.url));

describe("LessonReader talks through ReaderPort", () => {
  it("does not hard-code the authoring API", () => {
    const src = readFileSync(join(here, "LessonReader.tsx"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/lessonPath\s*\(/);
    expect(src).not.toMatch(/X-University-Local-Token/);
  });
});
