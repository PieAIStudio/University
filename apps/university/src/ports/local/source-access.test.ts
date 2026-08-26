import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalSourceAccessPort } from "./source-access";

function jsonOk(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createLocalSourceAccessPort", () => {
  it("keeps checkout routes in the local adapter", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ snapshotId: "snapshot", path: "/tmp/checkout", created: true, run: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const port = createLocalSourceAccessPort();
    const input = { studyId: "turing-pact", sourceCommit: "a".repeat(40) };

    const open = port.lessonVersion(input);
    expect(open.kind).toBe("action");
    if (open.kind !== "action") throw new Error("expected checkout action");
    await expect(open.run()).resolves.toEqual({
      snapshotId: "snapshot",
      path: "/tmp/checkout",
      created: true,
      run: [],
    });

    const close = port.closeLessonVersion(input);
    expect(close.kind).toBe("action");
    if (close.kind !== "action") throw new Error("expected close action");
    await close.run();

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["/api/studies/turing-pact/checkout?sourceCommit=" + "a".repeat(40), "POST"],
      ["/api/studies/turing-pact/checkout?sourceCommit=" + "a".repeat(40), "DELETE"],
    ]);
  });
});
