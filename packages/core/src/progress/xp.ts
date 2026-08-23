/**
 * 分数是给谁的：给「时间过去了，而你还记得」，不是给「今天翻了多少页」。
 *
 * 多邻国那套排行榜的已知代价是刷分——高段位一周要 1,500–3,000 XP，
 * 于是人挑最容易的课反复做。分数最后奖励的是耐心和手速，不是学会。
 *
 * 公开的研究给了一个很干净的修法：**最大的加分不给「第一次学会」，
 * 给「7 天后、30 天后还想得起来」**。把游戏机制接进间隔重复的循环里，
 * 完成率从 18% 升到 72%；而单纯发积分和勋章常常失效，因为人会去追奖励而不是去理解。
 *
 * 这里正好占便宜：FSRS 已经在替我们算每张卡的间隔了。按间隔发分，
 * 「刷」在结构上就做不到——最大的那笔分要求时间真的过去，而时间买不到。
 *
 * 一天猛学 10 节的上限是 10 × (READ + FIRST_TRY) = 400。
 * 学了两个月的人，光当天到期的卡片就能拿几千分——
 * 但他也**只能拿到期的那些**，因为没到期的卡片根本不出现。
 */

/** 读完一节新课文。消费也要有回报，否则第一周毫无进展感。 */
export const XP_READ_LESSON = 15;
/** 重读同一节。防刷的第一道闸，也是唯一一个写成 0 的数。 */
export const XP_REREAD_LESSON = 0;
/** 课末练习一次答对。 */
export const XP_EXERCISE_FIRST_TRY = 25;
/** 重试之后答对。仍然算，但不如一次对。 */
export const XP_EXERCISE_RETRY = 10;

/**
 * 「没想起来」也给分，而且这条比它看起来重要得多。
 *
 * 答错扣分或不给分，会教人在没想起来的时候点「想起来了」——
 * 而那会污染 FSRS 的输入，把他自己的复习安排搞坏。
 * 来了就该有分。忘记是学习的一部分，不是失误。
 */
export const XP_REVIEW_FORGOT = 5;

/**
 * 记起来了，按**上次见到它到现在过了多久**发分。
 *
 * 边界是天，不是小时：一个人对「昨天」和「上个月」的感觉是按天数的，
 * 而 FSRS 的间隔本身也是按天排的。
 */
const RECALL_LADDER: readonly { readonly upToDays: number; readonly xp: number }[] = [
  { upToDays: 1, xp: 3 }, // 还没来得及忘，不值钱
  { upToDays: 3, xp: 10 },
  { upToDays: 14, xp: 30 },
  { upToDays: 60, xp: 70 },
  { upToDays: Number.POSITIVE_INFINITY, xp: 150 }, // 两个月还记得，给最多
];

/** 连击 7 天起，全部得分 ×1.2。7 天以上连击的人完成全程的概率高 4.2 倍。 */
export const STREAK_BONUS_DAYS = 7;
export const STREAK_BONUS = 1.2;
/** 连击 30 天起 ×1.5。 */
export const STREAK_LONG_DAYS = 30;
export const STREAK_LONG_BONUS = 1.5;

const DAY = 86_400_000;

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewScoreInput {
  readonly rating: ReviewRating;
  /** 上一次复习这张卡的时间戳。第一次复习传 null。 */
  readonly lastReviewedAt: number | null;
  /** 现在。 */
  readonly now: number;
}

/**
 * 一次复习值多少分。
 *
 * `hard` / `good` / `easy` **同分**，这是故意的：
 * 如果「很轻松」给得多，人就会乱点难度刷分，而难度是 FSRS 唯一的输入。
 * 让评分只影响下次什么时候再见，不影响这次拿多少分，
 * 人就没有理由对它撒谎。
 */
export function reviewXp({ rating, lastReviewedAt, now }: ReviewScoreInput): number {
  if (rating === "again") return XP_REVIEW_FORGOT;
  const elapsedDays = lastReviewedAt === null ? 0 : Math.max(0, (now - lastReviewedAt) / DAY);
  for (const step of RECALL_LADDER) {
    if (elapsedDays <= step.upToDays) return step.xp;
  }
  return RECALL_LADDER[RECALL_LADDER.length - 1]!.xp;
}

/** 连击倍率。取整在最外层做一次，避免每一笔都各自取整后越差越多。 */
export function streakMultiplier(streakDays: number): number {
  if (streakDays >= STREAK_LONG_DAYS) return STREAK_LONG_BONUS;
  if (streakDays >= STREAK_BONUS_DAYS) return STREAK_BONUS;
  return 1;
}

export type XpEvent =
  | { readonly kind: "read-lesson"; readonly firstTime: boolean }
  | { readonly kind: "exercise"; readonly firstTry: boolean }
  | {
      readonly kind: "review";
      readonly rating: ReviewRating;
      readonly lastReviewedAt: number | null;
    };

/**
 * 一批事件一共多少分。
 *
 * 倍率在**总分**上乘一次，不是每一笔各乘一次再相加——
 * 后者会因为每笔取整而少给，而且少的量随事件条数变化，
 * 于是同样的一天在不同的拆分方式下得分不同。
 */
export function xpFor(
  events: readonly XpEvent[],
  context: { readonly streakDays: number; readonly now: number },
): number {
  let raw = 0;
  for (const event of events) {
    switch (event.kind) {
      case "read-lesson":
        raw += event.firstTime ? XP_READ_LESSON : XP_REREAD_LESSON;
        break;
      case "exercise":
        raw += event.firstTry ? XP_EXERCISE_FIRST_TRY : XP_EXERCISE_RETRY;
        break;
      case "review":
        raw += reviewXp({
          rating: event.rating,
          lastReviewedAt: event.lastReviewedAt,
          now: context.now,
        });
        break;
    }
  }
  return Math.round(raw * streakMultiplier(context.streakDays));
}

/**
 * 免费用户的 AI 额度：每天 1 点保底，每学完一节再挣 1 点，当天最多 4 点。
 *
 * 白送的额度会被当成理所当然，而且引来只薅不学的人。
 * 挣来的额度让「想多问 AI」和「多学一节」变成同一个动作——
 * 那正是我们希望他做的事，也顺手把成本封了顶。
 */
export const FREE_DAILY_BASE = 1;
export const FREE_EARNED_PER_LESSON = 1;
export const FREE_DAILY_CAP = 4;

/** 今天学完 `lessonsToday` 节之后，免费用户今天一共有几点。过午夜清零，不累积。 */
export function freeCreditsToday(lessonsToday: number): number {
  const earned = Math.max(0, lessonsToday) * FREE_EARNED_PER_LESSON;
  return Math.min(FREE_DAILY_CAP, FREE_DAILY_BASE + earned);
}
