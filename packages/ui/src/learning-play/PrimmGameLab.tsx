import { useMemo, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { localizeActivity } from "@pieai/university-core";
import { translate as t, useI18n } from "../i18n/index.js";
import { SoundToggle } from "../sound/index.js";
import {
  PrimmInvestigate,
  emptyInvestigation,
  investigationComplete,
  type InvestigationDraft,
} from "./PrimmInvestigate.js";
import {
  PRIMM_GAME_KINDS,
  primmGameAssets,
  primmGameExamples,
  type PrimmGameKind,
} from "./primm-game-examples.js";

/**
 * The version-2 investigate games, one at a time, rendered by the same
 * component a lesson uses. The status line reads the same gate the lesson
 * reads, so "does a wrong answer still pass?" is answered by the product, not
 * by this page.
 */
export function PrimmGameLab() {
  const { locale } = useI18n();
  const examples = useMemo(() => primmGameExamples(), []);
  const assets = useMemo(() => primmGameAssets(locale), [locale]);
  const [kind, setKind] = useState<PrimmGameKind>(PRIMM_GAME_KINDS[0]);
  const [draft, setDraft] = useState<InvestigationDraft>(emptyInvestigation);
  const [round, setRound] = useState(0);
  const example = examples.find((item) => item.kind === kind) ?? examples[0]!;
  const activity = useMemo(() => localizeActivity(example.activity, locale), [example, locale]);
  const complete = investigationComplete(activity, draft);
  const restart = (next: PrimmGameKind) => {
    setKind(next);
    setDraft(emptyInvestigation());
    setRound((value) => value + 1);
  };
  return (
    <div className="learning-play-lab">
      <h1 className="play-visually-hidden">{t("primm.lab.title")}</h1>
      <div className="learning-play-lab__top">
        <a href="/practice">{t("play.lab.back")}</a>
        <SoundToggle />
      </div>
      <nav className="learning-play-lab__collections" aria-label={t("play.ai.collection")}>
        <a href="/play-lab/catalog">{t("gallery.title")}</a>
        <a href="/play-lab/ai">{t("play.ai.collection.ai")}</a>
        <a href="/play-lab">{t("play.ai.collection.foundations")}</a>
        <a href="/play-lab/primm" aria-current="page">
          {t("play.ai.collection.primm")}
        </a>
      </nav>
      <p className="primm-lab__note">{t("primm.lab.note")}</p>
      <nav className="learning-play-lab__modes" aria-label={t("play.lab.select")}>
        {PRIMM_GAME_KINDS.map((item) => (
          <GameButton
            sound={false}
            static
            variant={kind === item ? "primary" : "secondary"}
            type="button"
            key={item}
            className="learning-play-lab__mode"
            aria-current={kind === item ? "true" : undefined}
            data-primm-game={item}
            onClick={() => restart(item)}
          >
            <span>
              <strong>{t(`primm.lab.game.${item}`)}</strong>
            </span>
          </GameButton>
        ))}
      </nav>
      <section className="primm-lab__stage" aria-live="polite">
        <PrimmInvestigate
          key={`${kind}:${round}:${locale}`}
          activity={activity}
          assets={assets}
          draft={draft}
          onChange={setDraft}
        />
        <div className="primm-lab__status" data-complete={complete ? "true" : "false"}>
          <span>{t(complete ? "primm.lab.complete" : "primm.lab.open")}</span>
          <GameButton sound={false} variant="secondary" type="button" onClick={() => restart(kind)}>
            {t("primm.lab.restart")}
          </GameButton>
        </div>
      </section>
    </div>
  );
}
