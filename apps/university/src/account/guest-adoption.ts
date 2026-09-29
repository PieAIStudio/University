import type { IdentityPort, ProgressPort } from "@pieai/university-core";

export interface GuestAdoptionSnapshot {
  /** Transient presentation identity, not an account id or a persistence key. */
  readonly scope: object;
  readonly ready: boolean;
}

/** Keep a celebration with the same guest when optional anonymous persistence
 * is created. Only the actual creation response may authorize adoption. Ordinary
 * sign-in, restoration, logout and a competing account always get a new scope.
 * The shared identity/progress ports still own every account and data write. */
export function createGuestAdoption(identity: IdentityPort, progress: ProgressPort) {
  let owner = progress.syncState().userId;
  let scope: object = Object.freeze({});
  let snapshot: GuestAdoptionSnapshot = { scope, ready: true };
  let serial = 0;
  let pending: { id: number; candidate: string | null } | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    const ready = progress.syncState().userId === owner;
    if (snapshot.scope === scope && snapshot.ready === ready) return;
    snapshot = { scope, ready };
    const recipients = [...listeners];
    for (const listener of recipients) {
      try {
        listener();
      } catch {
        /* Observers cannot interrupt account binding. */
      }
    }
  };
  const reset = () => {
    serial++;
    pending = null;
    owner = progress.syncState().userId;
    scope = Object.freeze({});
    publish();
  };
  const reconcile = () => {
    const next = progress.syncState().userId;
    const status = identity.status();
    if (pending) {
      if (
        status.kind === "signed_in" ||
        status.kind === "pending" ||
        (pending.candidate !== null &&
          (status.kind !== "anonymous" || status.user.id !== pending.candidate))
      ) {
        reset();
        return;
      }
      if (next !== owner) {
        if (
          owner !== null ||
          status.kind !== "anonymous" ||
          status.user.id !== next ||
          (pending.candidate !== null && pending.candidate !== next)
        ) {
          reset();
          return;
        }
        pending.candidate = next;
      }
    } else if (next !== owner) {
      reset();
      return;
    }
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      const stopProgress = progress.subscribe(reconcile);
      const stopIdentity = identity.subscribe(reconcile);
      reconcile();
      return () => {
        stopProgress();
        stopIdentity();
        reset();
      };
    },
    async create() {
      reconcile();
      const before = identity.status();
      if (
        pending ||
        owner !== null ||
        before.kind === "anonymous" ||
        before.kind === "signed_in" ||
        before.kind === "pending"
      )
        return;
      const request = { id: ++serial, candidate: null as string | null };
      pending = request;
      try {
        const receipt = await identity.signInAnonymously();
        reconcile();
        const after = identity.status();
        if (
          pending !== request ||
          !receipt ||
          after.kind !== "anonymous" ||
          receipt.createdUserId !== after.user.id ||
          progress.syncState().userId !== after.user.id
        )
          return;
        // The local-import receipt, not the eventual cloud response, releases
        // the celebration. A slow or offline remote must not freeze the chest.
        if (!progress.importGuestProgress) return;
        await progress.importGuestProgress((appliedTo) => {
          reconcile();
          if (
            pending !== request ||
            appliedTo !== receipt.createdUserId ||
            progress.syncState().userId !== appliedTo
          )
            return;
          owner = appliedTo;
          pending = null;
          publish();
        });
      } catch {
        // Optional account provisioning cannot interrupt an offline lesson.
      } finally {
        if (pending === request) {
          pending = null;
          if (progress.syncState().userId !== owner) reset();
          else publish();
        }
      }
    },
  };
}
export type GuestAdoption = ReturnType<typeof createGuestAdoption>;
