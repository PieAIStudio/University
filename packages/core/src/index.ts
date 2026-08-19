/**
 * The shapes every part of this product agrees on.
 *
 * No React, no filesystem, no network — that is the whole point. A local server
 * writing JSON to disk and an online server writing rows to a database must
 * still be describing the same lesson, and this is where that sameness is
 * written down once.
 */
export * from "./domain/schemas.js";
