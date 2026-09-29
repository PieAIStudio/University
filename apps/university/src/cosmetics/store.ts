import { createCosmeticsStore, CosmeticFailure } from "@pieai/university-core";
import { createSupabaseCosmeticsRemote } from "@pieai/university-backend/browser.js";
import { identityPort, swimmerBackendClient } from "../account/identity.js";
import { progressPort } from "../progress/store.js";

/** A source candidate is not a remote rollout. Change this only after the
 * Owner-authorized Backend migration, metadata registration and Data API gate.
 * No UI flag, query string or localStorage value can enable the service. */
export const COSMETICS_SERVICE_RELEASED = false;
export function cosmeticOwner(): string | null {
  const identity = identityPort.status();
  return identity.kind === "signed_in" && progressPort.syncState().userId === identity.user.id
    ? identity.user.id
    : null;
}
export const cosmeticsStore = createCosmeticsStore({
  remote:
    COSMETICS_SERVICE_RELEASED && swimmerBackendClient
      ? createSupabaseCosmeticsRemote(swimmerBackendClient)
      : null,
  currentOwner: cosmeticOwner,
  uuid: () => crypto.randomUUID(),
  schedule: (callback, delayMs) => {
    const timer = window.setTimeout(callback, delayMs);
    return () => window.clearTimeout(timer);
  },
  persistence: {
    read: (owner, kind) => localStorage.getItem(`university.cosmetics.v1:${owner}:${kind}`),
    write: (owner, kind, value) =>
      localStorage.setItem(`university.cosmetics.v1:${owner}:${kind}`, value),
    removePending: (owner) => localStorage.removeItem(`university.cosmetics.v1:${owner}:pending`),
  },
  beforeClaim: async () => {
    const owner = cosmeticOwner();
    if (!owner) throw new CosmeticFailure("identity", true);
    await progressPort.flush();
    const sync = progressPort.syncState();
    if (cosmeticOwner() !== owner) throw new CosmeticFailure("identity", true);
    if (sync.dirty || sync.status !== "idle" || sync.remoteAvailable !== true || !sync.lastSyncedAt)
      throw new CosmeticFailure("save-first", true);
  },
});
