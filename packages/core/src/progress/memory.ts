/**
 * Test doubles for the two injected ports. Not production storage.
 *
 * The in-memory remote is the stand-in for a University schema that does not
 * exist yet. End-to-end tests bind a progress port to one of these, never to
 * a live database, and `goOffline` is how those tests pull the plug.
 */

import type { Persistence, ProgressDocument, ProgressRemoteStore } from "../ports/progress.js";
import { cloneProgress } from "./document.js";

export function createMemoryPersistence(initial: string | null = null): Persistence & {
  raw(): string | null;
} {
  let stored = initial;
  return {
    read: () => stored,
    write(raw) {
      stored = raw;
    },
    raw: () => stored,
  };
}

export function createMemoryRemoteStore(): ProgressRemoteStore & {
  goOffline(): void;
  goOnline(): void;
  records: Map<string, ProgressDocument>;
} {
  const records = new Map<string, ProgressDocument>();
  let online = true;

  const requireOnline = () => {
    if (!online) throw new Error("progress remote is offline");
  };

  return {
    records,
    goOffline() {
      online = false;
    },
    goOnline() {
      online = true;
    },
    async load(userId) {
      requireOnline();
      const row = records.get(userId);
      return row ? cloneProgress(row) : null;
    },
    async save(userId, document) {
      requireOnline();
      records.set(userId, cloneProgress(document));
    },
  };
}
