import type { ReactNode } from "react";
import { GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import { toPath, type SupportPage, type View } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";

const POLICIES = ["privacy", "terms", "refunds"] as const;
const QUESTIONS = ["save", "finish", "review", "grading", "cancel", "reminders"] as const;

/** Product help is not a substitute for Owner-approved legal documents. */
export function SupportScreen({
  page,
  saveStatus,
}: {
  readonly page: SupportPage;
  readonly saveStatus?: ReactNode;
}) {
  const t = useI18n();
  const href = (view: View) => `${toPath(view)}?lang=${encodeURIComponent(t.locale)}`;
  const policy = page === "privacy" || page === "terms" || page === "refunds" ? page : null;
  return (
    <section className="shell-screen support-screen" data-support-page={page}>
      <header className="shell-screen__head">
        <h1>{t.t(`support.${page}.title`)}</h1>
        {page === "help" || page === "about" ? (
          <p className="shell-screen__lede">{t.t(`support.${page}.lede`)}</p>
        ) : null}
      </header>
      {page === "help" ? (
        <>
          {saveStatus}
          {QUESTIONS.map((question) => (
            <details className="product-details" key={question} data-faq={question}>
              <summary>{t.t(`support.faq.${question}.q`)}</summary>
              <p>{t.t(`support.faq.${question}.a`)}</p>
            </details>
          ))}
          <nav className="learner-destinations" aria-label={t.t("support.actions")}>
            <a href={`${href({ kind: "me" })}#profile-help`} data-support-feedback>
              {t.t("support.feedback")}
            </a>
            <a href={href({ kind: "plans" })}>{t.t("doors.membership")}</a>
          </nav>
        </>
      ) : null}
      {page === "about" ? (
        <GamePanel>
          <nav className="learner-destinations" aria-label={t.t("support.documents")}>
            {POLICIES.map((kind) => (
              <a key={kind} data-policy-link={kind} href={href({ kind: "support", page: kind })}>
                {t.t(`support.${kind}.title`)}
              </a>
            ))}
          </nav>
          <p>{t.t("support.unpublished")}</p>
        </GamePanel>
      ) : null}
      {policy ? (
        <GameCallout tone="info" heading={t.t("support.unpublished")}>
          <p data-policy-status="unpublished">{t.t(`support.${policy}.note`)}</p>
        </GameCallout>
      ) : null}
      <nav className="learner-destinations" aria-label={t.t("support.navigation")}>
        <a href={href({ kind: "me" })}>{t.t("support.back")}</a>
        {page !== "help" ? (
          <a href={href({ kind: "support", page: "help" })}>{t.t("support.help.title")}</a>
        ) : null}
        {page !== "about" ? (
          <a href={href({ kind: "support", page: "about" })}>{t.t("support.about.title")}</a>
        ) : null}
      </nav>
    </section>
  );
}
