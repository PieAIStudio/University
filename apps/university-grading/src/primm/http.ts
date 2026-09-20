import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { safeFailure, PreviewFailure } from "./errors.js";
import type { PrimmRuntime } from "./runtime.js";

/** Explicit owner-preview service; never exported from the public grading API. */
export function createPrimmPreviewServer(
  runtime: PrimmRuntime,
  options: { port: number; origins: readonly string[] },
) {
  const origins = new Set(options.origins);
  if (
    origins.size === 0 ||
    [...origins].some((origin) => !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  )
    throw new Error("Preview origins must be explicit loopback origins");
  const reply = (response: ServerResponse, status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  async function body(request: IncomingMessage) {
    if (!request.headers["content-type"]?.startsWith("application/json"))
      throw new PreviewFailure("rejected", 415);
    let size = 0;
    const chunks: Buffer[] = [];
    const limit = request.url === "/grade" ? 64 * 1024 : 16 * 1024;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > limit) throw new PreviewFailure("rejected", 413);
      chunks.push(bytes);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new PreviewFailure("rejected");
    }
  }
  const server = createServer(async (request, response) => {
    const address = server.address();
    const actualPort = options.port || (address && typeof address === "object" ? address.port : 0);
    if (
      !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "") ||
      request.headers.host !== `127.0.0.1:${actualPort}`
    ) {
      reply(response, 403, { kind: "error", code: "rejected" });
      return;
    }
    const origin = request.headers.origin;
    if (!origin || !origins.has(origin)) {
      reply(response, 403, { kind: "error", code: "rejected" });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-university-primm",
        "Access-Control-Max-Age": "60",
      });
      response.end();
      return;
    }
    if (request.headers["x-university-primm"] !== "owner-preview-v1") {
      reply(response, 403, { kind: "error", code: "rejected" });
      return;
    }
    const controller = new AbortController();
    const disconnected = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.on("close", disconnected);
    try {
      if (request.method === "GET" && request.url === "/status") {
        reply(response, 200, runtime.status());
        return;
      }
      if (request.method !== "POST") throw new PreviewFailure("rejected", 405);
      if (!["/run", "/grade", "/cancel"].includes(request.url ?? ""))
        throw new PreviewFailure("rejected", 404);
      const input = await body(request);
      if (request.url === "/cancel") {
        const { commandId } = z.object({ commandId: z.string().uuid() }).strict().parse(input);
        runtime.cancel(commandId);
        reply(response, 200, { cancelled: true });
        return;
      }
      const result =
        request.url === "/run"
          ? await runtime.run(input, controller.signal)
          : await runtime.grade(input, controller.signal);
      if (!controller.signal.aborted) reply(response, 200, result);
    } catch (error) {
      const failure =
        error instanceof z.ZodError ? new PreviewFailure("rejected") : safeFailure(error);
      if (!response.destroyed)
        reply(response, failure.status, { kind: "error", code: failure.code });
    } finally {
      response.removeListener("close", disconnected);
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 3000;
  server.on("close", () => runtime.close());
  return server;
}
