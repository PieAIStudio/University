/**
 * Glue: when identity changes, tell the progress port.
 *
 * The product-specific remote is injected by the progress store when the
 * public SwimmerBackend configuration is present. Tests still inject a fake.
 * Without that public configuration, sign-in remains usable as identity and
 * progress intentionally stays on the machine; the merge path is unchanged.
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
