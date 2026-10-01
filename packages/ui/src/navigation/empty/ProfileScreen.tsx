import { useI18n } from "../../i18n/index.js";
import type { ReactNode } from "react";
import { toPath, type View } from "@pieai/university-core";

/** V7's Me door: identity, saving, and the secondary places that used to
 * crowd the primary rail. The actual badge wall and detailed goals live in
 * Growth. The renderer is injected; this package never owns Three.js. */
export function ProfileScreen({
  avatar,
  account,
  saveStatus,
  accountEmail,
  passagesRead,
  lessonsCompleted,
  nextHref = "/",
  reviewCardCount = 0,
  onOpenHouse,
  keepsakeCount = 0,
}: {
  readonly avatar?: ReactNode;
  readonly account?: ReactNode;
  readonly saveStatus?: ReactNode;
  readonly accountEmail?: string | null;
  readonly passagesRead: number;
  readonly lessonsCompleted: number;
  readonly nextHref?: string;
  readonly reviewCardCount?: number;
  /** The house card at the top of Me (Owner H1, 2026-10-01). */
  readonly onOpenHouse?: () => void;
  readonly keepsakeCount?: number;
}) {
  const t = useI18n();
  const href = (view: View) => `${toPath(view)}?lang=${encodeURIComponent(t.locale)}`;
  return (
    <div className="profile-screen">
      <h1>{t.t("doors.me")}</h1>
      {onOpenHouse ? (
        <button type="button" className="profile-house" data-me-house onClick={onOpenHouse}>
          <strong>{t.t("house.title")}</strong>
          <span>
            {keepsakeCount
              ? t.t("house.card.count", { count: keepsakeCount })
              : t.t("house.card.empty")}
          </span>
          <span className="profile-house__go" aria-hidden="true">
            →
          </span>
        </button>
      ) : null}
      {accountEmail ? (
        <p className="profile-screen__email" data-profile-email>
          {t.t("support.account.email", { email: accountEmail })}
        </p>
      ) : null}
      {saveStatus}
      <div className="profile-screen__hero">{avatar}</div>
      <nav className="learner-destinations" aria-label={t.t("doors.me")}>
        <a href={href({ kind: "league" })} data-me-door="growth">
          {t.t("doors.growth")}
        </a>
        <a href={href({ kind: "plans" })} data-me-door="membership">
          {t.t("doors.membership")}
        </a>
        <a href="#profile-account" data-me-door="account">
          {t.t("doors.account")}
        </a>
        <a href={href({ kind: "settings" })} data-me-door="settings">
          {t.t("doors.settings")}
        </a>
        <a href="#profile-help" data-me-door="help">
          {t.t("doors.help")}
        </a>
        <a href={href({ kind: "support", page: "about" })} data-me-door="about">
          {t.t("support.about.title")}
        </a>
      </nav>
      <dl className="profile-screen__stats">
        <div>
          <dt>{t.t("product.profile.cards")}</dt>
          <dd>
            {reviewCardCount} {t.t("product.profile.cardsUnit")}
          </dd>
        </div>
        <div>
          <dt>{t.t("ui.navigation.empty.profileScreen.copy.学完")}</dt>
          <dd>
            {lessonsCompleted} {t.t("ui.navigation.empty.profileScreen.copy.节")}
          </dd>
        </div>
      </dl>
      {lessonsCompleted === 0 ? (
        <a href={nextHref}>
          {t.t("ui.navigation.empty.profileScreen.copy.还没学完一节-从这里开始")}
        </a>
      ) : null}
      {passagesRead > 0 ? (
        <p>
          {t.t("ui.navigation.empty.profileScreen.copy.读过真实代码")} · {passagesRead}{" "}
          {t.t("ui.navigation.empty.profileScreen.copy.段")}
        </p>
      ) : null}
      <section id="profile-account" className="profile-screen__account">
        <h2>{t.t("doors.account")}</h2>
        {account}
      </section>
      <section id="profile-help" className="profile-screen__help">
        <h2>{t.t("doors.help")}</h2>
        <nav className="learner-destinations" aria-label={t.t("doors.help")}>
          <a href={href({ kind: "support", page: "help" })} data-help-faq>
            {t.t("support.help.title")}
          </a>
        </nav>
        <div id="profile-feedback-host" />
      </section>
    </div>
  );
}
