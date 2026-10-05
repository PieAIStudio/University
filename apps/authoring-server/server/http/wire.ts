import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { HttpError } from "./errors.js";

const MAX_JSON_BODY_BYTES = 64 * 1024;
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function rejectNonLoopbackHost(request: IncomingMessage, response: ServerResponse): boolean {
  const host = request.headers.host;
  if (!host || !LOOPBACK_HOST.test(host)) {
    sendJson(response, 403, { error: "UniversityLocal only accepts loopback Host headers" });
    return true;
  }
  return false;
}

function isLoopbackOrigin(candidate: string): boolean {
  try {
    const origin = new URL(candidate);
    return (
      origin.protocol === "http:" &&
      (origin.hostname === "127.0.0.1" ||
        origin.hostname === "localhost" ||
        origin.hostname === "[::1]" ||
        origin.hostname === "::1")
    );
  } catch {
    return false;
  }
}

function tokensMatch(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function requireMutationAccess(request: IncomingMessage, requestToken: string): void {
  const origin = request.headers.origin;
  if (origin && !isLoopbackOrigin(origin)) {
    throw new HttpError(403, "State-changing requests require a loopback Origin");
  }
  const tokenHeader = request.headers["x-university-local-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (!tokensMatch(token, requestToken)) {
    throw new HttpError(403, "Missing or invalid UniversityLocal request token");
  }
  if (request.headers["content-type"]?.split(";", 1)[0]?.trim() !== "application/json") {
    throw new HttpError(415, "State-changing requests require application/json");
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "Request body is too large");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += bytes.length;
    if (total > MAX_JSON_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(bytes);
    }
  }
  if (tooLarge) throw new HttpError(413, "Request body is too large");
  if (total === 0) throw new HttpError(400, "Request body must be valid JSON");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

/**
 * Four functions, and no more. The body limit, the loopback pattern, the header
 * set and the two comparison helpers stay private: they are how these four are
 * implemented, not things a caller should reach for. A handler that imported
 * `tokensMatch` directly would be doing its own authorisation.
 */
export { sendJson, rejectNonLoopbackHost, requireMutationAccess, readJsonBody };
