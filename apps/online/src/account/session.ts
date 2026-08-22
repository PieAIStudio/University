/**
 * Glue: when identity changes, tell the progress port.
 *
 * There is no University schema in SwimmerBackend yet, so the remote is not
 * constructed here. Tests inject a fake. Until the boss registers the
 * product, sign-in still works as identity; progress stays on the machine
 * and the merge path is already tested against the replaceable store.
 */
import type { IdentityPort, ProgressPort, ProgressRemoteStore } from "@pieai/university-core";

export function bindProgressToIdentity(
  progress: ProgressPort,
  identity: IdentityPort,
  remote: ProgressRemoteStore | null,
): () => void {
  let tail = Promise.resolve();
  const sync = () => {
    const status = identity.status();
    tail = tail
      .catch(() => undefined)
      .then(() =>
        status.kind === "signed_in"
          ? progress.bindAccount(status.user.id, remote)
          : progress.bindAccount(null, null),
      );
  };

  const unsubscribe = identity.subscribe(sync);
  sync();

  const onOnline = () => {
    void progress.flush();
  };
  if (typeof addEventListener === "function") {
    addEventListener("online", onOnline);
  }

  return () => {
    unsubscribe();
    if (typeof removeEventListener === "function") {
      removeEventListener("online", onOnline);
    }
  };
}
