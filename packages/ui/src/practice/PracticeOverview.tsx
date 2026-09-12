import { translate } from "../i18n/index.js";
import { GameBadge, GameButton } from "@pieai/swimmer-ui-kit";

export interface PracticeOverviewCategory {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface PracticeOverviewProps {
  readonly questionCount: number;
  readonly dueTodayCount: number;
  readonly dueTomorrowCount: number;
  readonly recentCount: number;
  readonly categories: readonly PracticeOverviewCategory[];
  readonly onOpenReview?: () => void;
}

const PRACTICE_OVERVIEW_TITLE = translate("product.practice.heading");

function scheduleSummary({
  dueTodayCount,
  dueTomorrowCount,
  questionCount,
}: Pick<PracticeOverviewProps, "dueTodayCount" | "dueTomorrowCount" | "questionCount">): string {
  if (questionCount === 0) {
    return translate("product.practice.emptyBrief");
  }
  if (dueTodayCount > 0) {
    return translate("product.practice.dueBrief", { value0: dueTodayCount });
  }
  if (dueTomorrowCount > 0) {
    return translate("product.practice.tomorrowBrief", { value0: dueTomorrowCount });
  }
  return translate("product.practice.readyBrief");
}

export function PracticeOverview({
  categories,
  dueTodayCount,
  dueTomorrowCount,
  onOpenReview,
  questionCount,
  recentCount,
}: PracticeOverviewProps) {
  const dueLabel =
    dueTodayCount > 0
      ? translate("ui.practice.practiceOverview.copy.value0-张到期", { value0: dueTodayCount })
      : translate("ui.practice.practiceOverview.copy.今天无到期");
  const dueTone = dueTodayCount > 0 ? "warning" : "neutral";

  return (
    <section aria-labelledby="practice-overview-title" className="practice-overview">
      <div className="practice-overview__head">
        <div>
          <h1 id="practice-overview-title">{PRACTICE_OVERVIEW_TITLE}</h1>
        </div>
        {dueTodayCount > 0 ? <GameBadge tone={dueTone}>{dueLabel}</GameBadge> : null}
      </div>

      <p className="practice-overview__summary">
        {scheduleSummary({ dueTodayCount, dueTomorrowCount, questionCount })}
      </p>

      <details className="product-details" data-practice-details>
        <summary>{translate("product.practice.details")}</summary>
        <dl className="practice-overview__facts">
          <div>
            <dt>{translate("ui.practice.practiceOverview.copy.今天复习")}</dt>
            <dd>
              {dueTodayCount > 0
                ? translate("ui.practice.practiceOverview.copy.value0-张", {
                    value0: dueTodayCount,
                  })
                : translate("ui.practice.practiceOverview.copy.没有")}
            </dd>
          </div>
          <div>
            <dt>{translate("ui.practice.practiceOverview.copy.明天复习")}</dt>
            <dd>
              {dueTomorrowCount > 0
                ? translate("ui.practice.practiceOverview.copy.value0-张", {
                    value0: dueTomorrowCount,
                  })
                : translate("ui.practice.practiceOverview.copy.没有")}
            </dd>
          </div>
          <div>
            <dt>{translate("ui.practice.practiceOverview.copy.最近练过")}</dt>
            <dd>
              {recentCount} {translate("ui.practice.practiceOverview.copy.个概念")}
            </dd>
          </div>
        </dl>

        <div className="practice-overview__scope">
          <div className="practice-overview__scope-head">
            <span>{translate("ui.practice.practiceOverview.copy.题流来自概念图鉴")}</span>
            <strong>
              {questionCount} {translate("ui.practice.practiceOverview.copy.个概念题")}
            </strong>
          </div>
          <p
            aria-label={translate("ui.practice.practiceOverview.copy.概念题分类")}
            className="practice-overview__categories"
          >
            {categories.map((category) => (
              <span key={category.id}>
                <span>{category.label}</span>
                <strong>{category.count}</strong>
              </span>
            ))}
          </p>
        </div>

        <p className="practice-overview__availability">
          {translate("product.practice.memoryNote")}
        </p>
      </details>

      {dueTodayCount > 0 && onOpenReview ? (
        <div className="practice-overview__actions">
          <GameButton variant="secondary" type="button" onClick={onOpenReview}>
            {translate("ui.practice.practiceOverview.copy.先去复习")}
          </GameButton>
        </div>
      ) : null}
    </section>
  );
}
