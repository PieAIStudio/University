import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("one lesson reader", () => {
  it("does not keep a delivery-only Lesson.tsx beside the shared reader", () => {
    expect(existsSync(join(here, "Lesson.tsx"))).toBe(false);
  });
});
