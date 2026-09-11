import type { Persistence, ProgressDocument } from "../ports/progress.js";
import { cloneProgress, parseProgress } from "./document.js";

/** Offline copies of the same canonical document, isolated by identity. */
export function createAccountCache(persistence: Persistence) {
  const memory = new Map<string | null, ProgressDocument>();
  return {
    load(userId: string | null): ProgressDocument {
      const cached = memory.get(userId);
      if (cached) return cloneProgress(cached);
      let raw: string | null = null;
      try {
        raw = userId === null ? persistence.read() : (persistence.readAccount?.(userId) ?? null);
      } catch {
        /* Failed storage does not authorize reading another identity. */
      }
      return parseProgress(raw);
    },
    save(userId: string | null, document: ProgressDocument): void {
      memory.set(userId, cloneProgress(document));
      const raw = JSON.stringify(document);
      if (userId === null) persistence.write(raw);
      else if (persistence.writeAccount) persistence.writeAccount(userId, raw);
      else throw new Error("Account-scoped local storage is unavailable");
    },
  };
}
