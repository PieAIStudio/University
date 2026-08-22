import { GameButton } from "@pieai/swimmer-ui-kit";

/**
 * Compact 「今天」 card for the right column: next lesson plus the due-card
 * line the old top bar used to carry.
 */
export function TodayCard({
  nextTitle,
  nextMeta,
  continueLabel,
  onContinue,
  dueCount,
  dueTomorrow,
}: {
  readonly nextTitle: string | null;
  readonly nextMeta: string | null;
  readonly continueLabel: string;
  readonly onContinue: () => void;
  readonly dueCount: number;
  readonly dueTomorrow: number;
}) {
  return (
    <section className="today-card" aria-label="今天">
      <h2>今天</h2>
      {nextTitle ? (
        <>
          <p className="today-card__title">{nextTitle}</p>
          {nextMeta ? <p className="today-card__meta">{nextMeta}</p> : null}
          <GameButton variant="primary" type="button" onClick={onContinue}>
            {continueLabel}
          </GameButton>
        </>
      ) : (
        <p className="today-card__title">课程这边暂时没有待办。</p>
      )}
      <a className="today-card__review" href="#/review">
        {dueCount > 0 ? `复习 · ${dueCount} 张到期` : `复习 · 明天 ${dueTomorrow} 张`}
      </a>
    </section>
  );
}
