import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";

export interface WelcomePath {
  readonly id: string;
  readonly kind: "basics" | "build";
  readonly firstLessonTitle: string;
  readonly lessonCount: number;
}

/** Product cards inside 涟, never another welcome modal. */
export function WelcomeCards({
  choices,
  assessment = false,
  onChoose,
  onHelp,
  onAssess,
  onBrowse,
  onSignIn,
}: {
  readonly choices: readonly WelcomePath[];
  readonly assessment?: boolean;
  readonly onChoose: (id: string) => void;
  readonly onHelp: () => void;
  readonly onAssess: () => void;
  readonly onBrowse: () => void;
  readonly onSignIn: () => void;
}) {
  const t = useI18n();
  return (
    <div
      className="welcome-cards"
      data-welcome="true"
      data-welcome-page={assessment ? "assessment" : "1"}
    >
      <div className="welcome-cards__paths">
        {choices.map((choice) => (
          <article key={choice.id} className="welcome-cards__path" data-welcome-choice={choice.id}>
            <h2>{t.t(`product.welcome.path.${choice.kind}`)}</h2>
            <p className="welcome-cards__detail">
              {t.t(`product.welcome.path.${choice.kind}.detail`)}
            </p>
            <p className="welcome-cards__first">
              {t.locale === "en" && /\p{Script=Han}/u.test(choice.firstLessonTitle)
                ? t.t("product.welcome.path.sourcePreview")
                : t.t("product.welcome.path.first", { title: choice.firstLessonTitle })}
            </p>
            <span className="welcome-cards__count">
              {t.t("product.welcome.path.count", { count: choice.lessonCount })}
            </span>
            <GameButton
              variant="primary"
              static
              data-welcome-start={choice.id}
              onClick={() => onChoose(choice.id)}
            >
              {t.t(assessment ? "product.welcome.assess.start" : "product.welcome.path.start")}
            </GameButton>
          </article>
        ))}
      </div>
      {!choices.length ? <p role="status">{t.t("product.welcome.loading")}</p> : null}
      <div className="welcome-cards__links">
        {!assessment ? (
          <>
            <GameButton variant="ghost" static onClick={onHelp} data-welcome-help>
              {t.t("product.welcome.help")}
            </GameButton>
            <GameButton variant="ghost" static onClick={onAssess} data-welcome-assess>
              {t.t("product.welcome.assess")}
            </GameButton>
          </>
        ) : null}
        <div className="welcome-cards__footer">
          <GameButton variant="ghost" static data-welcome-signin onClick={onSignIn}>
            {t.t("product.welcome.signIn")}
          </GameButton>
          <GameButton variant="ghost" static data-welcome-browse onClick={onBrowse}>
            {t.t("product.welcome.browse")}
          </GameButton>
        </div>
      </div>
    </div>
  );
}

export function recommendedWelcomePath(
  choices: readonly WelcomePath[],
  goal: "work" | "build" | "browse",
): WelcomePath | null {
  return (
    choices.find((choice) => choice.kind === (goal === "build" ? "build" : "basics")) ??
    choices[0] ??
    null
  );
}

/** Two declared preferences, not a model call, placement test or automatic difficulty change. */
export function WelcomeQuestions({
  choices,
  onChoose,
  onBack,
}: {
  readonly choices: readonly WelcomePath[];
  readonly onChoose: (id: string) => void;
  readonly onBack: () => void;
}) {
  const t = useI18n();
  const [experience, setExperience] = useState<"never" | "sometimes" | "often" | null>(null);
  const [goal, setGoal] = useState<"work" | "build" | "browse" | null>(null);
  const recommendation = experience && goal ? recommendedWelcomePath(choices, goal) : null;
  return (
    <div className="welcome-questions" data-welcome="true" data-welcome-page="2">
      <fieldset>
        <legend>{t.t("product.welcome.help.experience")}</legend>
        <div className="welcome-questions__answers">
          {(["never", "sometimes", "often"] as const).map((value) => (
            <GameButton
              key={value}
              variant="secondary"
              static
              aria-pressed={experience === value}
              data-welcome-experience={value}
              onClick={() => setExperience(value)}
            >
              {t.t(`product.welcome.help.${value}`)}
            </GameButton>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t.t("product.welcome.help.goal")}</legend>
        <div className="welcome-questions__answers">
          {(["work", "build", "browse"] as const).map((value) => (
            <GameButton
              key={value}
              variant="secondary"
              static
              aria-pressed={goal === value}
              data-welcome-goal={value}
              onClick={() => setGoal(value)}
            >
              {t.t(`product.welcome.help.${value}`)}
            </GameButton>
          ))}
        </div>
      </fieldset>
      <div aria-live="polite" className="welcome-questions__recommendation">
        {recommendation ? (
          <>
            <p>
              {t.t("product.welcome.help.recommend", {
                title: t.t(`product.welcome.path.${recommendation.kind}`),
              })}{" "}
              {t.t("product.welcome.path.count", { count: recommendation.lessonCount })}
            </p>
            <GameButton
              variant="primary"
              static
              data-welcome-recommended
              onClick={() => onChoose(recommendation.id)}
            >
              {t.t("product.welcome.help.start")}
            </GameButton>
          </>
        ) : null}
      </div>
      <GameButton variant="ghost" static onClick={onBack}>
        {t.t("product.welcome.back")}
      </GameButton>
    </div>
  );
}
