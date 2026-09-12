import { GameAssetIcon, GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import { translate } from "../i18n/index.js";

export interface WelcomeChoice {
  readonly id: string;
  readonly title: string;
}

export interface WelcomeLesson {
  readonly title: string;
  readonly exerciseCount: number;
}

/** One invitation over the existing world, not another course, renderer or tutorial. */
export function WelcomeExperience({
  choices,
  selectedId,
  lesson,
  onSelect,
  onStart,
  onBrowse,
  onSignIn,
  onDismiss,
}: {
  readonly choices: readonly WelcomeChoice[];
  readonly selectedId: string | null;
  readonly lesson: WelcomeLesson | null;
  readonly onSelect: (studyId: string) => void;
  readonly onStart: () => void;
  readonly onBrowse: () => void;
  readonly onSignIn: () => void;
  readonly onDismiss?: () => void;
}) {
  return (
    <GameModal
      open
      title="University"
      className="welcome-experience"
      closeLabel={translate("product.welcome.dismiss")}
      closeOnBackdrop={false}
      onClose={onDismiss ?? onBrowse}
    >
      <div className="welcome-experience__body" data-welcome="true">
        <div className="welcome-experience__intro">
          <h2>
            {translate("product.welcome.heading")}
            <br />
            {translate("product.welcome.headingNext")}
          </h2>
        </div>
        <ol className="welcome-experience__path" aria-label={translate("product.welcome.method")}>
          <li>
            <GameAssetIcon icon="scroll" size="md" />
            {translate("product.welcome.understand")}
          </li>
          <li>
            <GameAssetIcon icon="compass" size="md" />
            {translate("product.welcome.try")}
          </li>
          <li>
            <GameAssetIcon icon="card" size="md" />
            {translate("product.welcome.remember")}
          </li>
        </ol>
        <div className="welcome-experience__next" aria-live="polite" aria-atomic="true">
          <p>{translate("product.welcome.firstStep")}</p>
          <h3>{lesson?.title ?? translate("product.welcome.loading")}</h3>
          {lesson ? (
            <p className="welcome-experience__scope">
              {translate("product.welcome.scope", { exercises: lesson.exerciseCount })}
            </p>
          ) : null}
        </div>
        <div className="welcome-experience__actions">
          <GameButton
            variant="primary"
            static
            data-welcome-start
            disabled={!lesson}
            onClick={onStart}
          >
            {translate("product.welcome.start")}
          </GameButton>
          <GameButton variant="ghost" static data-welcome-browse onClick={onBrowse}>
            {translate("product.welcome.browse")}
          </GameButton>
        </div>
        {choices.length > 1 ? (
          <details className="welcome-experience__choices">
            <summary>{translate("product.welcome.choose")}</summary>
            <div className="welcome-experience__options">
              {choices.map((choice) => (
                <GameButton
                  key={choice.id}
                  variant="secondary"
                  static
                  data-welcome-choice={choice.id}
                  aria-pressed={choice.id === selectedId}
                  onClick={() => onSelect(choice.id)}
                >
                  {choice.title}
                </GameButton>
              ))}
            </div>
          </details>
        ) : null}
        <footer className="welcome-experience__footer">
          <p>{translate("product.welcome.reassurance")}</p>
          <GameButton variant="ghost" static data-welcome-signin onClick={onSignIn}>
            {translate("product.welcome.signIn")}
          </GameButton>
        </footer>
      </div>
    </GameModal>
  );
}
