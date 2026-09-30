import { useI18n } from "@pieai/university-ui/i18n.js";

/** Owner-approved V7 L1 exception: discovery is author-only; old tool URLs
 * and their parameterized experiments remain intact. */
export function SettingsLab() {
  const t = useI18n();
  const links = [
    ["/avatar-lab", t.t("doors.lab.avatar")],
    ["/play-lab", t.t("doors.lab.basic")],
    ["/play-lab/ai", t.t("doors.lab.ai")],
    ["/play-lab/primm", t.t("doors.lab.primm")],
    ["/play-lab/toy-3d", t.t("doors.lab.arcade")],
    ["/play-lab/prop-finish", t.t("doors.lab.appearance")],
    ["/studio/map", t.t("doors.lab.map")],
    ["/studio", t.t("doors.lab.studio")],
  ] as const;
  return (
    <details id="settings-laboratory" className="product-details" data-settings-lab>
      <summary>{t.t("doors.settings.laboratory")}</summary>
      <p>{t.t("doors.settings.labBoundary")}</p>
      <nav className="learner-destinations" aria-label={t.t("doors.settings.laboratory")}>
        {links.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </details>
  );
}
