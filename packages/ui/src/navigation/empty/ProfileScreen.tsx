import { useI18n } from "../../i18n/index.js";
import type { ReactNode } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

/** V7's Me door: identity, saving, and the secondary places that used to
 * crowd the primary rail. The actual badge wall and detailed goals live in
 * Growth. The renderer is injected; this package never owns Three.js. */
export function ProfileScreen({
  avatar,
  account,
  saveStatus,
  passagesRead,
  lessonsCompleted,
  nextHref = "/",
  reviewCardCount = 0,
  onOpenWardrobe,
}: {
  readonly avatar?: ReactNode;
  readonly account?: ReactNode;
  readonly saveStatus?: ReactNode;
  readonly passagesRead: number;
  readonly lessonsCompleted: number;
  readonly nextHref?: string;
  readonly reviewCardCount?: number;
  readonly onOpenWardrobe?: () => void;
}) {
  const t = useI18n();
  return (
    <div className="profile-screen">
      <h1>{t.t("doors.me")}</h1>
      {saveStatus}
      <div className="profile-screen__hero">{avatar}</div>
      <nav className="learner-destinations" aria-label={t.t("doors.me")}>
        <a href="/league" data-me-door="growth">
          {t.t("doors.growth")}
        </a>
        <a href="/plans" data-me-door="membership">
          {t.t("doors.membership")}
        </a>
        <a href="#profile-account" data-me-door="account">
          {t.t("doors.account")}
        </a>
        <a href="/settings" data-me-door="settings">
          {t.t("doors.settings")}
        </a>
        <a href="#profile-help" data-me-door="help">
          {t.t("doors.help")}
        </a>
        {onOpenWardrobe ? (
          <GameButton variant="secondary" static onClick={onOpenWardrobe}>
            {t.t("doors.wardrobe")}
          </GameButton>
        ) : null}
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
        <div id="profile-feedback-host" />
      </section>
    </div>
  );
}
