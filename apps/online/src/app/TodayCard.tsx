import { GameButton } from "@pieai/swimmer-ui-kit";

/**
 * Compact 「今天」 card for the right column: next lesson plus the due-card
 * line the old top bar used to carry.
 *
 * Name the project you are in, not the size of the catalogue. An unstarted
 * course has no remaining-count that is useful — "41 节" is a wall. Once
 * they have started, remaining shrinks; that is progress. The total does
 * not move; that is pressure. `progress` is the same `{ done, total }` the
 * course path header already reads from `readCourseProgress`.
 */
export function todayMeta(
  studyTitle: string,
  progress: { readonly done: number; readonly total: number } | null,
): string {
  if (progress == null || progress.done === 0) return studyTitle;
  return `${studyTitle} · 还剩 ${Math.max(0, progress.total - progress.done)} 关`;
}

export function reviewLine(dueCount: number, dueTomorrow: number): string | null {
  if (dueCount > 0) return `复习 · ${dueCount} 张到期`;
  if (dueTomorrow > 0) return `复习 · 明天 ${dueTomorrow} 张`;
  return null;
}

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
  const review = reviewLine(dueCount, dueTomorrow);
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
      {review ? (
        <a className="today-card__review" href="#/review">
          {review}
        </a>
      ) : null}
    </section>
  );
}
