import { describe, expect, it } from "vitest";

import vercelHandler, { vercelGradeHandler } from "./vercel.js";

describe("Vercel grading entrypoint", () => {
  it("exposes the Web Request handler through Vercel's fetch export", () => {
    expect(vercelHandler.fetch).toBe(vercelGradeHandler);
  });
});
