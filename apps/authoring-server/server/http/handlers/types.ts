import type { IncomingMessage, ServerResponse } from "node:http";

import type { ServerContext } from "../context.js";

/**
 * Every route branch is a handler with this shape. Returns true when it handled
 * the request (including method-not-allowed responses for its own paths);
 * false when the next handler in the ordered list should try. Order is
 * behaviour — the list in createUniversityLocalHttpServer preserves the
 * original branch sequence.
 */
export type Handler = (
  ctx: ServerContext,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) => Promise<boolean> | boolean;
