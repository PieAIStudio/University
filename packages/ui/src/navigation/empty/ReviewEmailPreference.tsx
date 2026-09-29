import { useSyncExternalStore } from "react";
import { GameToggle } from "@pieai/swimmer-ui-kit";
import type { ProgressPort } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";

/** This is consent/schedule intent, not the unrelated Web Push permission. */
export function ReviewEmailPreference({ progress }: { readonly progress: ProgressPort }) {
  const t = useI18n();
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const owner = progress.syncState().userId;
  return (
    <section className="settings-screen__block" data-review-email-preference>
      <h2 className="settings-screen__heading">{t.t("journey.email.heading")}</h2>
      <GameToggle
        checked={document.account.preferences.reviewEmail?.enabled === true}
        label={t.t("journey.email.toggle")}
        onClick={() => {
          if (progress.syncState().userId !== owner) return;
          const preferences = progress.accountData().preferences;
          progress.setAccountPreferences({
            ...preferences,
            reviewEmail: {
              enabled: preferences.reviewEmail?.enabled !== true,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              schedule: "cards-due",
            },
          });
        }}
      />
      <p>{t.t("journey.wrap.emailBoundary")}</p>
      {progress.localSaveState?.() === "failed" ? (
        <p role="alert">{t.t("journey.email.unsaved")}</p>
      ) : null}
    </section>
  );
}
