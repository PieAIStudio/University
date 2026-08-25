import { afterEach, describe, expect, it, vi } from "vitest";

import { evidenceSourceOf } from "./evidence-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evidenceSourceOf", () => {
  it("returns nothing when import baked no snippets", () => {
    expect(evidenceSourceOf([{ snippetUrl: undefined }])).toBeUndefined();
    expect(evidenceSourceOf([])).toBeUndefined();
  });

  it("loads the content-addressed file for that evidence index", async () => {
    const snippet = { sourcePath: "a.ts", code: "export const a = 1;" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(snippet),
      }),
    );
    const resolve = evidenceSourceOf([
      { snippetUrl: "/content/buzz/demo/evidence/aaa.json" },
      { snippetUrl: "/content/buzz/demo/evidence/bbb.json" },
    ]);
    expect(resolve).toBeDefined();
    await expect(resolve!(1)).resolves.toEqual(snippet);
    expect(fetch).toHaveBeenCalledWith("/content/buzz/demo/evidence/bbb.json");
  });

  it("rejects an index that was not baked", async () => {
    const resolve = evidenceSourceOf([{ snippetUrl: "/content/x.json" }, {}]);
    await expect(resolve!(1)).rejects.toThrow("这条证据没有烘焙源码");
  });
});
