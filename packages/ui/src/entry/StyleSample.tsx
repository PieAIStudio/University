import { useState } from "react";
import { STYLE_SAMPLE_PAGE, type PayloadOf, type StyleSkinId } from "@pieai/university-core";

type StyleSampleProps = Pick<
  PayloadOf<"style-sample">,
  "alt" | "caption" | "skin" | "contrastSkin"
>;

const SKIN_LABELS: Partial<Record<StyleSkinId, string>> = {
  apple: "苹果风",
  brutalism: "新粗野",
};

function skinLabel(skin: StyleSkinId): string {
  return SKIN_LABELS[skin] ?? skin;
}

/*
  This fixed markup / swappable CSS contract follows CSS Zen Garden (2003):
  one HTML document, many stylesheets. The product copy and structure stay
  constant, so a learner can see which changes belong to the visual skin.
*/
export function StyleSample({ alt, caption, skin, contrastSkin }: StyleSampleProps) {
  const [activeSkin, setActiveSkin] = useState<StyleSkinId>(skin);

  return (
    <figure className="stylesample">
      {contrastSkin ? (
        <div className="stylesample__switch">
          <button
            className="stylesample__switch-button"
            type="button"
            aria-pressed={activeSkin === skin}
            onClick={() => setActiveSkin(skin)}
          >
            {skinLabel(skin)}
          </button>
          <button
            className="stylesample__switch-button"
            type="button"
            aria-pressed={activeSkin === contrastSkin}
            onClick={() => setActiveSkin(contrastSkin)}
          >
            {skinLabel(contrastSkin)}
          </button>
        </div>
      ) : null}
      <div className={`stylesample__frame stylesample--${activeSkin}`} role="img" aria-label={alt}>
        <header className="stylesample__nav">
          <span className="stylesample__brand">{STYLE_SAMPLE_PAGE.brand}</span>
          <nav className="stylesample__links" aria-label="示意导航">
            {STYLE_SAMPLE_PAGE.navLinks.map((link) => (
              <span className="stylesample__link" key={link}>
                {link}
              </span>
            ))}
          </nav>
          <span className="stylesample__nav-action">{STYLE_SAMPLE_PAGE.navAction}</span>
        </header>
        <section className="stylesample__hero">
          <h4 className="stylesample__headline">{STYLE_SAMPLE_PAGE.headline}</h4>
          <p className="stylesample__sub">{STYLE_SAMPLE_PAGE.sub}</p>
          <div className="stylesample__actions">
            <span className="stylesample__cta">{STYLE_SAMPLE_PAGE.primary}</span>
            <span className="stylesample__cta2">{STYLE_SAMPLE_PAGE.secondary}</span>
          </div>
        </section>
        {/*
          This media area is CSS art rather than an image. The comparison must
          have only one variable — the skin; changing a photo would add another
          variable and make the lesson about the asset instead of the style.
        */}
        <div className="stylesample__media" aria-hidden="true" />
        <ul className="stylesample__cards">
          {STYLE_SAMPLE_PAGE.cards.map((card) => (
            <li className="stylesample__card" key={card.title}>
              <span className="stylesample__card-title">{card.title}</span>
              <span className="stylesample__card-note">{card.note}</span>
            </li>
          ))}
        </ul>
        <footer className="stylesample__foot">{STYLE_SAMPLE_PAGE.footnote}</footer>
      </div>
      {caption ? <p className="stylesample__note">{caption}</p> : null}
      <figcaption className="stylesample__caption">{STYLE_SAMPLE_PAGE.footnote}</figcaption>
    </figure>
  );
}
