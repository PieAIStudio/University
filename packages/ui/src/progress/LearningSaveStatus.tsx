import { useState, useSyncExternalStore } from "react";
import { GameButton, GameCallout } from "@pieai/swimmer-ui-kit";
import type { ProgressPort } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

export function saveMessageKey(progress: ProgressPort) {
  const local = progress.localSaveState?.() ?? "unconfirmed";
  const sync = progress.syncState();
  if (local === "failed") return "product.save.failed";
  if (local !== "saved") return "product.save.initial";
  if (sync.remoteAvailable && sync.status === "offline") return "product.save.offline";
  if (sync.remoteAvailable && (sync.status === "syncing" || sync.dirty))
    return "product.save.syncing";
  if (sync.remoteAvailable && sync.lastSyncedAt) return "product.save.synced";
  return "product.save.local";
}

export function LearningSaveStatus({
  progress,
  allowGuestImport = false,
}: {
  readonly progress: ProgressPort;
  readonly allowGuestImport?: boolean;
}) {
  const value = useSyncExternalStore(
    progress.subscribe,
    () =>
      `${saveMessageKey(progress)}|${Boolean(allowGuestImport && progress.hasGuestProgress?.())}`,
    () => `${saveMessageKey(progress)}|false`,
  );
  const [message, hasGuest] = value.split("|");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const failed = message === "product.save.failed";
  const shortKey = {
    "product.save.initial": "product.save.shortInitial",
    "product.save.local": "product.save.shortLocal",
    "product.save.syncing": "product.save.shortSyncing",
    "product.save.synced": "product.save.shortSynced",
    "product.save.offline": "product.save.shortOffline",
    "product.save.failed": "product.save.heading",
  } as const;
  async function importGuest() {
    if (busy || !progress.importGuestProgress) return;
    setBusy(true);
    setError(false);
    try {
      await progress.importGuestProgress();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="learning-save-state" data-learning-save-state={message}>
      {failed ? (
        <GameCallout tone="warning" heading={translate("product.save.heading")} role="alert">
          <p>{translate("product.save.failedBrief")}</p>
          {progress.retryLocalSave ? (
            <GameButton static variant="secondary" onClick={() => progress.retryLocalSave?.()}>
              {translate("product.save.retry")}
            </GameButton>
          ) : null}
        </GameCallout>
      ) : (
        <details className="product-details learning-save-state__details">
          <summary>
            <span className="learning-save-state__dot" aria-hidden="true" />
            <span role="status">
              {translate(shortKey[message as ReturnType<typeof saveMessageKey>])}
            </span>
          </summary>
          <p>{translate(message as ReturnType<typeof saveMessageKey>)}</p>
        </details>
      )}
      {hasGuest === "true" ? (
        <div>
          <GameButton static variant="secondary" disabled={busy} onClick={() => void importGuest()}>
            {translate("product.save.import")}
          </GameButton>
          <details className="product-details">
            <summary>{translate("product.save.importDetails")}</summary>
            <p>{translate("product.save.importHint")}</p>
          </details>
        </div>
      ) : null}
      {error ? <p role="alert">{translate("product.save.importFailed")}</p> : null}
    </div>
  );
}
