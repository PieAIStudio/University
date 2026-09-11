import {
  readEntitlements as readLocalEntitlements,
  type EntitlementReadModel,
  type IdentityPort,
  type ProgressPort,
  type ProgressRemoteStore,
} from "@pieai/university-core";

/**
 * Account-to-data binding shared by the local and online shells.
 *
 * Identity changes are the same event in both products. The only thing the
 * shells may choose is the grading port; cloud data must not depend on which
 * shell happened to render the lesson.
 */
export function bindProgressToIdentity(
  progress: ProgressPort,
  identity: IdentityPort,
  remote: ProgressRemoteStore | null,
  readRemoteEntitlements?: () => Promise<EntitlementReadModel | null>,
): () => void {
  let tail = Promise.resolve();
  let generation = 0;
  let active = true;
  let previous = identity.status();
  const sync = () => {
    const status = identity.status();
    // An in-progress login is not a logout. Preserve the identity scope while
    // its form waits; the learner surface already shows the pending state.
    if (status.kind === "pending") return;
    const adoptAnonymousId =
      previous.kind === "anonymous" && status.kind === "signed_in" ? previous.user.id : undefined;
    previous = status;
    const version = ++generation;
    const nextUser =
      status.kind === "anonymous" || status.kind === "signed_in" ? status.user.id : null;
    // Scope the rendered cache immediately, not after an old entitlement request.
    const localBinding =
      progress.syncState().userId !== nextUser
        ? progress.bindAccount(nextUser, null, { adoptAnonymousId })
        : Promise.resolve();
    tail = tail
      .catch(() => undefined)
      .then(async () => {
        await localBinding;
        if (!active || version !== generation) return;
        let entitlements = readLocalEntitlements({
          identity: status,
          remoteAvailable: remote !== null,
        });
        if (status.kind === "signed_in" && readRemoteEntitlements) {
          try {
            entitlements = (await readRemoteEntitlements()) ?? entitlements;
          } catch {
            // A missing entitlement read fails closed to the free, local-only
            // baseline; it must never accidentally turn on cloud sync.
          }
        }
        if (!active || version !== generation) return;
        const syncRemote = entitlements.sync.available ? remote : null;
        return status.kind === "anonymous" || status.kind === "signed_in"
          ? progress.bindAccount(status.user.id, syncRemote)
          : progress.bindAccount(null, null);
      })
      .catch(() => undefined);
  };

  const unsubscribe = identity.subscribe(sync);
  sync();

  const onOnline = () => {
    void progress.flush();
  };
  if (typeof addEventListener === "function") addEventListener("online", onOnline);

  return () => {
    active = false;
    generation += 1;
    unsubscribe();
    if (typeof removeEventListener === "function") removeEventListener("online", onOnline);
  };
}
