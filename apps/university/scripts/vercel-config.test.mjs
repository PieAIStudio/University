import { describe, expect, it } from "vitest";

import vercel from "../../../vercel.json" with { type: "json" };

describe("the delivery fallback boundary", () => {
  it("does not rewrite API or crawler files to the app shell", () => {
    const source = vercel.rewrites[0].source;
    const fallback = new RegExp(`^${source}$`);

    expect(fallback.test("/api")).toBe(false);
    expect(fallback.test("/api/bootstrap")).toBe(false);
    expect(fallback.test("/robots.txt")).toBe(false);
    expect(fallback.test("/sitemap.xml")).toBe(false);
    expect(fallback.test("/turing-pact/foundations-before-zero")).toBe(true);
  });
});
