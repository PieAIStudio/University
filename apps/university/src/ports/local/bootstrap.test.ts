import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown): Response => ({ ok: true, json: async () => body }) as Response;
const locator = { studyId: "study", courseId: "course", unitId: "unit", lessonId: "lesson" };

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("shared loopback bootstrap contract", () => {
  it("shares the same in-flight promise and resolved payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ requestToken: "one" }));
    vi.stubGlobal("fetch", fetchMock);
    const { localBootstrap } = await import("./bootstrap");
    const first = localBootstrap();
    expect(localBootstrap()).toBe(first);
    await expect(first).resolves.toEqual({ requestToken: "one" });
    expect(localBootstrap()).toBe(first);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/bootstrap");
  });

  it("evicts a failed request, retains its URL in the error, and retries next time", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(json({ requestToken: "recovered" }));
    vi.stubGlobal("fetch", fetchMock);
    const { localBootstrap } = await import("./bootstrap");
    await expect(localBootstrap()).rejects.toThrow("/api/bootstrap: offline");
    await expect(localBootstrap()).resolves.toEqual({ requestToken: "recovered" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a late old failure cannot clear a newer refreshed opening", async () => {
    let rejectOld!: (reason: unknown) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      )
      .mockResolvedValueOnce(json({ requestToken: "new" }));
    vi.stubGlobal("fetch", fetchMock);
    const { localBootstrap, refreshLocalBootstrap } = await import("./bootstrap");
    const old = localBootstrap();
    const failure = expect(old).rejects.toThrow("/api/bootstrap: old failure");
    const current = refreshLocalBootstrap();
    rejectOld(new Error("old failure"));
    await failure;
    await current;
    expect(localBootstrap()).toBe(current);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reader and grader share one bootstrap and preserve their JSON/token request headers", async () => {
    const writes: RequestInit[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/bootstrap") return json({ requestToken: "shared" });
      writes.push(init!);
      return json({ correct: false, attemptCount: 1, score: 0, maxScore: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createLocalReaderPort } = await import("./reader");
    const { createLocalGradingPort } = await import("./grading");
    const reader = createLocalReaderPort({});
    const grader = createLocalGradingPort({});
    expect(fetchMock).not.toHaveBeenCalled();
    await Promise.all([
      reader.completeLesson(locator, { commandId: "read", contentRevision: 1 }),
      grader.submitExercise({
        locator,
        exerciseId: "exercise",
        contentRevision: 1,
        commandId: "answer",
        answer: "response",
      }),
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/bootstrap")).toHaveLength(1);
    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write.method).toBe("POST");
      expect(write.headers).toEqual({
        "Content-Type": "application/json",
        "X-University-Local-Token": "shared",
      });
    }
  });

  it("an existing reader uses the refreshed token rather than the construction-time value", async () => {
    let token = "first";
    const writes: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/bootstrap") return json({ requestToken: token });
        writes.push(init!);
        return json({});
      }),
    );
    const { createLocalReaderPort } = await import("./reader");
    const { refreshLocalBootstrap } = await import("./bootstrap");
    const reader = createLocalReaderPort({});
    await reader.completeLesson(locator, { commandId: "first", contentRevision: 1 });
    token = "second";
    await refreshLocalBootstrap();
    await reader.completeLesson(locator, { commandId: "second", contentRevision: 1 });
    expect(
      writes.map((write) => (write.headers as Record<string, string>)["X-University-Local-Token"]),
    ).toEqual(["first", "second"]);
  });

  it("calls an injected token provider per action without requesting a bootstrap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    const token = vi.fn().mockResolvedValueOnce("one").mockResolvedValueOnce("two");
    vi.stubGlobal("fetch", fetchMock);
    const { createLocalReaderPort } = await import("./reader");
    const reader = createLocalReaderPort({ requestToken: token });
    await reader.completeLesson(locator, { commandId: "one", contentRevision: 1 });
    await reader.completeLesson(locator, { commandId: "two", contentRevision: 1 });
    expect(token).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(([, init]) => init.headers["X-University-Local-Token"]),
    ).toEqual(["one", "two"]);
    expect(fetchMock.mock.calls.every(([url]) => url !== "/api/bootstrap")).toBe(true);
  });
});
