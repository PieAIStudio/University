import { afterEach, describe, expect, it, vi } from "vitest";

import { localSourceVersionAction } from "./source-version-action";

function jsonOk(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local source version action", () => {
  it("keeps the checkout route in the authoring callback", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ snapshotId: "snapshot", path: "/tmp/checkout", created: true, run: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      localSourceVersionAction("open", {
        studyId: "turing-pact",
        sourceCommit: "a".repeat(40),
      }),
    ).resolves.toEqual({
      snapshotId: "snapshot",
      path: "/tmp/checkout",
      created: true,
      run: [],
    });
    await localSourceVersionAction("close", {
      studyId: "turing-pact",
      sourceCommit: "a".repeat(40),
    });

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["/api/studies/turing-pact/checkout?sourceCommit=" + "a".repeat(40), "POST"],
      ["/api/studies/turing-pact/checkout?sourceCommit=" + "a".repeat(40), "DELETE"],
    ]);
  });
});
