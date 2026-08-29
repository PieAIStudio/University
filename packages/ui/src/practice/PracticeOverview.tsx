import { GameBadge, GameButton, GamePanel } from "@pieai/swimmer-ui-kit";

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

const PRACTICE_OVERVIEW_TITLE = "今天适合练吗？";

function scheduleSummary({
  dueTodayCount,
  dueTomorrowCount,
  questionCount,
}: Pick<PracticeOverviewProps, "dueTodayCount" | "dueTomorrowCount" | "questionCount">): string {
  if (questionCount === 0) {
    return "图鉴里还没有带判断题的概念。先去翻翻词条，等题目准备好。";
  }
  if (dueTodayCount > 0) {
    return `今天有 ${dueTodayCount} 张复习卡到期，先复习它们最有价值；也可以练一道概念判断。`;
  }
  if (dueTomorrowCount > 0) {
    return `今天没有到期复习卡，明天有 ${dueTomorrowCount} 张回来。想巩固，就练一道概念判断。`;
  }
  return "今天没有到期复习卡。想巩固，可以练一道判断；答对后会打开完整词条。";
}

export function PracticeOverview({
  categories,
  dueTodayCount,
  dueTomorrowCount,
  onOpenReview,
  questionCount,
  recentCount,
}: PracticeOverviewProps) {
  const dueLabel = dueTodayCount > 0 ? `${dueTodayCount} 张到期` : "今天无到期";
  const dueTone = dueTodayCount > 0 ? "warning" : "neutral";

  return (
    <GamePanel
      aria-labelledby="practice-overview-title"
      className="practice-overview"
      tone="strong"
    >
      <div className="practice-overview__head">
        <div>
          <p className="practice-overview__eyebrow">学习 / 练习 / 概念图鉴</p>
          <h1 id="practice-overview-title">{PRACTICE_OVERVIEW_TITLE}</h1>
        </div>
        <GameBadge tone={dueTone}>{dueLabel}</GameBadge>
      </div>

      <p className="practice-overview__summary">
        {scheduleSummary({ dueTodayCount, dueTomorrowCount, questionCount })}
      </p>

      <dl className="practice-overview__facts">
        <div>
          <dt>今天复习</dt>
          <dd>{dueTodayCount > 0 ? `${dueTodayCount} 张` : "没有"}</dd>
        </div>
        <div>
          <dt>明天复习</dt>
          <dd>{dueTomorrowCount > 0 ? `${dueTomorrowCount} 张` : "没有"}</dd>
        </div>
        <div>
          <dt>最近练过</dt>
          <dd>{recentCount} 个概念</dd>
        </div>
      </dl>

      <div className="practice-overview__scope">
        <div className="practice-overview__scope-head">
          <span>题流来自概念图鉴</span>
          <strong>{questionCount} 个概念题</strong>
        </div>
        <p aria-label="概念题分类" className="practice-overview__categories">
          {categories.map((category) => (
            <span key={category.id}>
              <span>{category.label}</span>
              <strong>{category.count}</strong>
            </span>
          ))}
        </p>
      </div>

      <p className="practice-overview__availability">
        <span>掌握度</span> 暂未记录。这里只记最近练过，不把一次答对伪装成「已掌握」。
      </p>

      {dueTodayCount > 0 && onOpenReview ? (
        <div className="practice-overview__actions">
          <GameButton variant="secondary" type="button" onClick={onOpenReview}>
            先去复习
          </GameButton>
        </div>
      ) : null}
    </GamePanel>
  );
}
