import { useI18n } from "@pieai/university-ui/i18n.js";
import "./prop-finish.css";

/** Keep old bookmarks understandable without mounting the rejected experiment. */
export default function RetiredAppearanceRoute() {
  const { t, locale } = useI18n();
  return (
    <section className="prop-finish" data-testid="appearance-retired">
      <h1>{t("finish.title")}</h1>
      <p>{t("finish.retired")}</p>
      <a href={`/play-lab/prop-finish?lang=${locale}`}>{t("finish.open")}</a>
    </section>
  );
}
