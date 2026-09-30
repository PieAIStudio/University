import { useId, useState, useSyncExternalStore } from "react";
import { GameButton, GameInput, GameToggle } from "@pieai/swimmer-ui-kit";
import { domainInterestEmail, setDomainInterest, type ProgressPort } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";

/** This is an explicitly consented interest record, not a live mailing list.
 * The parent remounts on identity/domain changes; no email enters a URL,
 * analytics event, fixture, log, or publication artifact. */
export function DomainInterest({
  domainId,
  progress,
}: {
  readonly domainId: string;
  readonly progress: ProgressPort;
}) {
  const t = useI18n();
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const owner = progress.syncState().userId;
  const existing = document.account.preferences.domainInterests?.[domainId];
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(() => existing?.email ?? "");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<"saved" | "failed" | "withdrawn" | null>(null);
  const id = useId();
  const save = (enabled: boolean) => {
    if (progress.syncState().userId !== owner || (enabled && !consent)) return;
    const preferences = progress.accountData().preferences;
    const next = setDomainInterest(
      preferences.domainInterests,
      domainId,
      enabled,
      email,
      Date.now(),
    );
    if (!next) return;
    progress.setAccountPreferences({ ...preferences, domainInterests: next });
    if (!enabled) {
      setEmail("");
      setConsent(false);
    }
    setNotice(
      progress.localSaveState?.() === "saved" ? (enabled ? "saved" : "withdrawn") : "failed",
    );
  };
  return (
    <section className="domain-interest" data-domain-interest={domainId}>
      <p>{t.t("doors.comingSoon")}</p>
      {!open ? (
        <GameButton variant="secondary" static onClick={() => setOpen(true)}>
          {t.t("doors.notify")}
        </GameButton>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(true);
          }}
        >
          <h3>{t.t("doors.notify.title")}</h3>
          <label htmlFor={id}>{t.t("doors.notify.email")}</label>
          <GameInput
            id={id}
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setNotice(null);
            }}
          />
          <GameToggle
            checked={consent}
            label={t.t("doors.notify.consent")}
            onClick={() => setConsent(!consent)}
          />
          <p>{t.t("doors.notify.boundary")}</p>
          <p>{t.t("doors.notify.storage")}</p>
          <div className="learner-destinations">
            <GameButton type="submit" static disabled={!consent || !domainInterestEmail(email)}>
              {t.t("doors.notify.submit")}
            </GameButton>
            <GameButton type="button" variant="ghost" static onClick={() => setOpen(false)}>
              {t.t("doors.notify.close")}
            </GameButton>
          </div>
        </form>
      )}
      {existing?.enabled ? (
        <GameButton type="button" variant="ghost" static onClick={() => save(false)}>
          {t.t("doors.notify.withdraw")}
        </GameButton>
      ) : null}
      {notice ? (
        <p role={notice === "failed" ? "alert" : "status"}>{t.t(`doors.notify.${notice}`)}</p>
      ) : null}
    </section>
  );
}
