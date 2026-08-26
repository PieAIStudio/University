import {
  readEntitlements,
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
): () => void {
  let tail = Promise.resolve();
  const sync = () => {
    const status = identity.status();
    const entitlements = readEntitlements({
      identity: status,
      remoteAvailable: remote !== null,
    });
    const syncRemote = entitlements.sync.available ? remote : null;
    tail = tail
      .catch(() => undefined)
      .then(() =>
        status.kind === "signed_in"
          ? progress.bindAccount(status.user.id, syncRemote)
          : progress.bindAccount(null, null),
      );
  };

  const unsubscribe = identity.subscribe(sync);
  sync();

  const onOnline = () => {
    void progress.flush();
  };
  if (typeof addEventListener === "function") addEventListener("online", onOnline);

  return () => {
    unsubscribe();
    if (typeof removeEventListener === "function") removeEventListener("online", onOnline);
  };
}
