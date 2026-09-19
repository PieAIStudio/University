import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { primmFixture } from "../../../../packages/core/src/learning-play/fixtures/primm.js";
import type { ChatCompletionTransport } from "@pieai/swimmer-ai-kit/chat";
import { combineCriterionReviews, createPrimmRuntime, type PrimmRuntime } from "./runtime.js";
import { createPrimmPreviewServer } from "./http.js";
import {
  createLocalOllamaTransport,
  finalCompletionText,
  PREVIEW_MODEL,
} from "./local-transport.js";
import { articleText, fetchApprovedSource } from "./sources.js";
import { RunSchema, type CanonicalPrimm } from "./content.js";

const ref = {
  studyId: "ai-literacy",
  courseId: "understanding-ai",
  unitId: "first-useful-step",
  lessonId: "ask-about-a-picture",
} as const;
const input = (phase: "run" | "modify" | "make" = "run") => ({
  lessonRef: ref,
  contentRevision: 7,
  phase,
  prompt: primmFixture.starter.prompt,
  commandId: randomUUID(),
  locale: "zh-CN" as const,
});
function setup(
  options: { quota?: number; timeoutMs?: number; transport?: ChatCompletionTransport } = {},
) {
  const complete = vi.fn(async (request: Parameters<ChatCompletionTransport["complete"]>[0]) => ({
    content: request.responseFormat
      ? JSON.stringify({
          outcome: "pass",
          evaluation: "按要求完成了任务。",
          extensions: [],
          evidence: {
            from: "finalWork",
            quote: JSON.parse(request.messages.at(-1)!.content as string).finalWork.slice(0, 40),
          },
        })
      : "真正调用了注入的测试模型",
    raw: {},
  }));
  const lesson: CanonicalPrimm = {
    activity: structuredClone(primmFixture),
    contentRevision: 7,
    exerciseRevision: 2,
    exercise: { id: primmFixture.make.exerciseId, prompt: "独立完成", rubric: ["完成当前用途"] },
    assets: [],
    fingerprint: "current",
  };
  const runtime = createPrimmRuntime({
    transport: options.transport ?? { provider: "test", complete },
    resolveLesson: async (request) => {
      if (request.contentRevision !== 7) throw new Error("stale");
      return lesson;
    },
    ...options,
  });
  return { runtime, complete, lesson };
}
const servers: ReturnType<typeof createPrimmPreviewServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
});

describe("bounded PRIMM runtime", () => {
  it("rejects a declared missing clock time before asking a model, but still grades a timed result", async () => {
    const { runtime, lesson, complete } = setup();
    lesson.activity.make.clockTimeCheck = { missing: "提醒里还没写几点见面。请对照留言补上。" };
    const request = input("make"),
      result = await runtime.run(request);
    const grade = (finalWork: string) =>
      runtime.grade({
        locator: ref,
        contentRevision: 2,
        exerciseId: primmFixture.make.exerciseId,
        commandId: randomUUID(),
        answer: JSON.stringify({
          kind: "primm-make",
          request,
          resultRequestId: result.requestId,
          finalWork,
        }),
      });
    expect((await grade("星期日下午去公园")).hostGrade?.outcome).toBe("fail");
    expect(complete).toHaveBeenCalledTimes(1);
    expect((await grade("周日14点到公园")).hostGrade?.outcome).toBe("pass");
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it("grades only the current Make material, never unrelated historical case facts", async () => {
    const { runtime, lesson, complete } = setup();
    lesson.activity.materials.push({
      id: "old-case",
      kind: "practice",
      label: "Unused case",
      text: "UNRELATED HISTORICAL CLAIM",
    });
    const request = input("make"),
      result = await runtime.run(request);
    await runtime.grade({
      locator: ref,
      contentRevision: 2,
      exerciseId: primmFixture.make.exerciseId,
      commandId: randomUUID(),
      answer: JSON.stringify({
        kind: "primm-make",
        request,
        resultRequestId: result.requestId,
        finalWork: "The learner's actual work.",
      }),
    });
    expect(JSON.stringify(complete.mock.calls.at(-1)![0].messages)).not.toContain(
      "UNRELATED HISTORICAL CLAIM",
    );
  });
  it("runs the prepared request once, rejects changing its input under the same command", async () => {
    const { runtime, complete } = setup();
    const request = input();
    const [a, b] = await Promise.all([runtime.run(request), runtime.run(request)]);
    expect(a).toEqual(b);
    expect(a.kind).toBe("live");
    expect(complete).toHaveBeenCalledTimes(1);
    await expect(runtime.run({ ...request, prompt: "silently changed" })).rejects.toThrow();
    await expect(runtime.run({ ...request, contentRevision: 8 })).rejects.toThrow();
  });
  it("does not accept arbitrary lesson, file, URL or model fields", () => {
    for (const extra of [
      { path: "/private" },
      { url: "https://example.org" },
      { model: "other" },
      { lessonRef: { ...ref, lessonId: "unknown" } },
    ])
      expect(RunSchema.safeParse({ ...input(), ...extra }).success).toBe(false);
  });
  it("enforces a finite call budget and no automatic retries", async () => {
    const { runtime, complete } = setup({ quota: 1 });
    await runtime.run(input());
    await expect(runtime.run(input())).rejects.toMatchObject({ code: "quota" });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("does not confuse interface language with the requested translation language", async () => {
    const { runtime, complete } = setup();
    await runtime.run({ ...input("modify"), locale: "en", prompt: "请译成中文，保留原意。" });
    const messages = complete.mock.calls.at(-1)![0].messages;
    expect(messages[0]!.content).toContain("en as the default language");
    expect(messages[0]!.content).toContain(
      "follow an explicitly requested output language instead",
    );
    expect(JSON.stringify(messages.at(-1)!.content)).toContain("请译成中文，保留原意。");
  });
  it("cancels a current job and denies another concurrent command", async () => {
    const transport: ChatCompletionTransport = {
      provider: "test",
      complete: ({ signal }) =>
        new Promise((_, reject) =>
          signal!.addEventListener("abort", () => reject(signal!.reason), { once: true }),
        ),
    };
    const { runtime } = setup({ transport });
    const request = input();
    const promise = runtime.run(request);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(runtime.run(input())).rejects.toMatchObject({ code: "busy" });
    runtime.cancel(request.commandId);
    await expect(promise).rejects.toMatchObject({ code: "cancelled" });
    expect(runtime.status().busy).toBe(false);
  });
  it("keeps ASR original words rather than silently translating Run", async () => {
    const { lesson, complete } = setup();
    lesson.activity.starter.operation = "transcribe";
    lesson.assets = [{ id: "audio", mime: "audio/wav", bytes: Buffer.from("test") }];
    const transcribe = vi.fn(async () => ({ text: "Original English words", model: "test-ASR" }));
    const runtime = createPrimmRuntime({
      transport: { provider: "test", complete },
      resolveLesson: async () => lesson,
      transcriber: { transcribe },
    });
    const result = await runtime.run(input());
    expect(result.text).toBe("Original English words");
    expect(result.model).toBe("test-ASR");
    expect(complete).not.toHaveBeenCalled();
    await runtime.run({ ...input("modify"), prompt: "Translate the meaning" });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    lesson.activity.make.operation = "audio-text";
    await runtime.run({ ...input("make"), prompt: "Summarize in Chinese" });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
    await runtime.run(input());
    expect(transcribe).toHaveBeenCalledTimes(2); // An explicit R really reruns recognition.
    lesson.assets[0]!.bytes = Buffer.from("different real clip");
    await runtime.run({ ...input("modify"), prompt: "Different clip" });
    expect(transcribe).toHaveBeenCalledTimes(3);
  });
  it("grades real Make evidence with the independent exercise revision and permits learner edits", async () => {
    const { runtime, complete } = setup();
    const request = input("make"),
      result = await runtime.run(request);
    const grade = {
      locator: ref,
      contentRevision: 2,
      exerciseId: primmFixture.make.exerciseId,
      commandId: randomUUID(),
      answer: JSON.stringify({
        kind: "primm-make",
        request,
        resultRequestId: result.requestId,
        finalWork: "The learner repaired the final work.",
      }),
    };
    const decision = await runtime.grade(grade);
    expect(decision.hostGrade?.outcome).toBe("pass");
    expect(complete.mock.calls.at(-1)![0].messages.at(-1)!.content).toContain(
      "The learner repaired",
    );
    expect(complete.mock.calls.at(-1)![0].messages.at(-1)!.content).not.toContain("actualResult");
    expect(complete.mock.calls.at(-1)![0].messages.at(-1)!.content).not.toContain(result.text);
    await expect(
      runtime.grade({ ...grade, commandId: randomUUID(), contentRevision: 7 }),
    ).rejects.toThrow();
    await expect(
      runtime.grade({
        ...grade,
        answer: JSON.stringify({
          kind: "primm-make",
          request,
          resultRequestId: randomUUID(),
          finalWork: "forged",
        }),
      }),
    ).rejects.toThrow();
  });
  it("rejects feedback quoting an old draft rather than the submitted work", async () => {
    const transport: ChatCompletionTransport = {
      provider: "test",
      complete: async (request) => ({
        content: request.responseFormat
          ? JSON.stringify({
              outcome: "fail",
              evaluation: "Quoted problem",
              extensions: [],
              evidence: { from: "finalWork", quote: "old erroneous words" },
            })
          : "old erroneous words",
        raw: {},
      }),
    };
    const { runtime } = setup({ transport });
    const request = input("make"),
      result = await runtime.run(request);
    await expect(
      runtime.grade({
        locator: ref,
        contentRevision: 2,
        exerciseId: primmFixture.make.exerciseId,
        commandId: randomUUID(),
        answer: JSON.stringify({
          kind: "primm-make",
          request,
          resultRequestId: result.requestId,
          finalWork: "The learner has repaired this text.",
        }),
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("every authored condition matters", () => {
  const criterion = (index: number, outcome: "pass" | "fail" | "undecided") => ({
    criterion: index,
    outcome,
    evaluation: outcome === "fail" ? "还缺具体几点见面。" : "已核对这一项。",
    extensions: [],
    evidence: { from: "finalWork" as const, quote: "周日下午" },
  });
  it("does not pass a whole task when one required part failed", () => {
    const decision = combineCriterionReviews(
      [criterion(0, "pass"), criterion(1, "fail"), criterion(2, "pass")],
      3,
    );
    expect(decision.outcome).toBe("fail");
    expect(decision.evaluation).toBe("还缺具体几点见面。");
  });
  it("keeps uncertainty rather than forging a pass", () => {
    expect(
      combineCriterionReviews([criterion(0, "pass"), criterion(1, "undecided")], 2).outcome,
    ).toBe("undecided");
  });
  it("rejects omitted, repeated and unknown criterion indices", () => {
    for (const checks of [
      [criterion(0, "pass")],
      [criterion(0, "pass"), criterion(0, "pass")],
      [criterion(0, "pass"), criterion(2, "pass")],
    ])
      expect(() => combineCriterionReviews(checks, 2)).toThrow();
  });
});

describe("owner preview HTTP boundary", () => {
  async function start(runtime: PrimmRuntime) {
    const server = createPrimmPreviewServer(runtime, {
      port: 0,
      origins: ["http://127.0.0.1:23150"],
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw Error();
    return `http://127.0.0.1:${address.port}`;
  }
  const headers = {
    Origin: "http://127.0.0.1:23150",
    "X-University-Primm": "owner-preview-v1",
    "Content-Type": "application/json",
  };
  it("rejects foreign origins, missing headers and oversized input", async () => {
    const { runtime, complete } = setup(),
      url = await start(runtime);
    expect(
      (
        await fetch(url + "/run", {
          method: "POST",
          headers: { ...headers, Origin: "https://example.org" },
          body: JSON.stringify(input()),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "/run", {
          method: "POST",
          headers: { Origin: headers.Origin },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "/run", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: "x".repeat(17000) }),
        })
      ).status,
    ).toBe(413);
    expect(complete).not.toHaveBeenCalled();
    expect(
      (await fetch(url + "/run", { method: "POST", headers, body: JSON.stringify(input()) }))
        .status,
    ).toBe(200);
  });
});

describe("local file and source boundaries", () => {
  it("never exposes reasoning or treats it as the final answer", async () => {
    expect(finalCompletionText("<think>internal analysis</think>Final answer")).toBe(
      "Final answer",
    );
    expect(() => finalCompletionText("<think>unfinished")).toThrow();
    expect(() => finalCompletionText("<think>only reasoning</think>")).toThrow();
    const transport = createLocalOllamaTransport({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ done: true, message: { content: "", thinking: '{"outcome":"pass"}' } }),
        ),
    });
    await expect(transport.complete({ model: PREVIEW_MODEL, messages: [] })).rejects.toThrow();
  });
  it("passes paths as text and images as approved bytes, with no tool or URL loading", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ done: true, message: { content: "Actual result" } })),
    );
    const transport = createLocalOllamaTransport({ fetchImpl: fetcher });
    const original = "/private/example.png ../other.jpg ~/a.webp https://host/x.png";
    await transport.complete({
      model: PREVIEW_MODEL,
      maxTokens: 700,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: "Keep roles" },
        {
          role: "user",
          content: [
            { type: "text", text: original },
            { type: "image", url: "data:image/png;base64,aW1hZ2U=" },
          ],
        },
      ],
    });
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(options.redirect).toBe("error");
    expect(body.messages).toEqual([
      { role: "system", content: "Keep roles" },
      { role: "user", content: original, images: ["aW1hZ2U="] },
    ]);
    expect(body.tools).toBeUndefined();
    expect(body.options.num_predict).toBe(700);
    expect(body.format).toBe("json");
    await expect(
      transport.complete({
        model: PREVIEW_MODEL,
        messages: [{ role: "user", content: [{ type: "image", url: "https://host/x.png" }] }],
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects arbitrary retrieval before fetching and strips executable page content", async () => {
    const fetcher = vi.fn();
    await expect(
      fetchApprovedSource("http://127.0.0.1/", AbortSignal.timeout(100), fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(articleText("<main><script>evil()</script><p>Useful &amp; real</p></main>")).toBe(
      "Useful & real",
    );
  });
});
