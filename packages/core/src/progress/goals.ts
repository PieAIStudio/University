/**
 * Daily quests and badges, derived from the progress document — never stored.
 *
 * The obvious build is a second table: an `xpLog`, a `badges` array, a
 * `questState` per day. Every one of those is a copy of something the document
 * already knows, and a copy that two devices can disagree about. A learner who
 * finished a lesson on their phone and opened the laptop would see the lesson
 * complete and the quest unfinished, and there is no honest way to explain that
 * to them.
 *
 * So nothing here is persisted. A quest is a question asked of the document,
 * and a badge is the same. They cannot drift from the progress they describe,
 * they need no merge rules, and deleting this file would lose no learner data.
 *
 * The cost is real and worth naming: history the document does not keep cannot
 * be reconstructed. `last_review` on a card is the *most recent* review, so
 * "cards reviewed today" is exact and "cards reviewed last Tuesday" is
 * unanswerable. Every number below is chosen to be one the document can
 * actually answer.
 */

import type { ProgressDocument } from "../ports/progress.js";

/** Local calendar day, `YYYY-MM-DD`. The streak counts days, so this does too. */
export function calendarDay(at: number): string {
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface Quest {
  readonly id: string;
  readonly title: string;
  /** Why this one is worth doing, in the learner's terms. */
  readonly detail: string;
  readonly done: number;
  readonly goal: number;
  /**
   * True when the scheduler has nothing for this quest today.
   *
   * A review quest with nothing due is satisfied the moment the day starts,
   * and counting it would hand a learner "1/3 done" before they had touched
   * anything. It is still shown — "today has nothing due" is a fact worth
   * telling someone, and it is how the product teaches that reviewing early
   * is the one thing that breaks spaced repetition — but it is not scored.
   */
  readonly informational?: boolean;
}

export const questProgress = (quest: Quest) => Math.min(1, quest.done / Math.max(quest.goal, 1));
export const questComplete = (quest: Quest) => quest.done >= quest.goal;
/** The quests that today actually asks something of you. */
export const scoredQuests = (quests: readonly Quest[]) =>
  quests.filter((quest) => quest.informational !== true);

/**
 * Today's three, and only three.
 *
 * Duolingo shows a wall of daily, weekly and monthly quests, and the wall is
 * the problem: a list long enough to always have something unfinished on it
 * stops being a list of things to do and becomes a list of things you are
 * behind on. Three fit on a phone without scrolling and can all be finished.
 *
 * They are also deliberately the same three every day. A rotating quest is a
 * reason to open the app; a fixed one is a habit, and a habit is what spaced
 * repetition needs from a person.
 */
export function questsForToday(document: ProgressDocument, now: number): Quest[] {
  const today = calendarDay(now);

  const lessonsToday = Object.values(document.lessons).filter(
    (lesson) => lesson.completedAt !== null && calendarDay(lesson.completedAt) === today,
  ).length;

  const cards = Object.values(document.cards);
  const dueNow = cards.filter((card) => card.dueAt <= now).length;
  const reviewedToday = cards.filter(
    (card) =>
      card.fsrs.last_review !== undefined &&
      calendarDay(Date.parse(card.fsrs.last_review)) === today,
  ).length;

  return [
    {
      id: "lesson",
      title: "学一节新课",
      detail: "一节就够。今天读完的那节，明天会掉两张卡回来找你。",
      done: Math.min(lessonsToday, 1),
      goal: 1,
    },
    {
      id: "review",
      /*
        The goal is what is actually due, not a round number. A fixed "review 10
        cards" is unfinishable on a day with three due and pointless on a day
        with forty — and worse, it teaches people to review cards that are not
        due, which is the one thing that makes spaced repetition stop working.
      */
      title: dueNow + reviewedToday === 0 ? "今天没有到期的卡片" : "清掉今天到期的卡片",
      detail:
        dueNow + reviewedToday === 0
          ? "这不是偷懒，是排程本来就没安排。学一节新课，明天就有事做了。"
          : "到期才复习。没到期的卡片提前看，等于把还记得的东西又背一遍，间隔就白算了。",
      done: reviewedToday,
      goal: Math.max(dueNow + reviewedToday, reviewedToday),
      informational: dueNow + reviewedToday === 0,
    },
    {
      id: "streak",
      title: "把连击接上",
      detail: "连击 7 天起，当天所有得分 ×1.2；30 天起 ×1.5。",
      done: document.streak.lastDay === today ? 1 : 0,
      goal: 1,
    },
  ];
}

export interface Badge {
  readonly id: string;
  readonly name: string;
  /** The sentence on the back of the badge: what it takes. */
  readonly how: string;
  readonly earned: boolean;
  /** How far along, for the ones still locked. 0 to 1. */
  readonly progress: number;
}

/**
 * How many cards this person has actually got into long-term memory.
 *
 * Stability is FSRS's own estimate, in days, of how long until recall falls to
 * 90%. Twenty-one days is the usual line between "learning" and "learned", and
 * using the scheduler's number rather than a review count is the point: you
 * cannot earn this by clicking through cards quickly, only by still knowing
 * them three weeks later.
 */
export const LONG_TERM_STABILITY_DAYS = 21;

export function longTermCards(document: ProgressDocument): number {
  return Object.values(document.cards).filter(
    (card) => card.fsrs.stability >= LONG_TERM_STABILITY_DAYS,
  ).length;
}

export function completedLessons(document: ProgressDocument): number {
  return Object.values(document.lessons).filter((lesson) => lesson.completedAt !== null).length;
}

/**
 * The badge wall.
 *
 * Every one of these is earned by doing the thing the product is for, and none
 * of them can be earned by volume alone: the two that look like counting
 * (10 and 50 lessons) sit next to three that require elapsed calendar time and
 * one that requires the scheduler to agree you remember something. That mix is
 * deliberate — a wall you can clear in an afternoon is a wall that says nothing
 * about you a week later.
 *
 * Locked badges show their rule and their progress rather than a question mark.
 * A hidden badge is a puzzle, and this is not a game about guessing what the
 * game wants.
 */
export function badgesFor(document: ProgressDocument, coursesFinished = 0): Badge[] {
  const lessons = completedLessons(document);
  const longTerm = longTermCards(document);
  const streak = document.streak.days;
  const reviewed = Object.values(document.cards).filter(
    (card) => card.fsrs.last_review !== undefined,
  ).length;

  const step = (id: string, name: string, how: string, done: number, goal: number): Badge => ({
    id,
    name,
    how,
    earned: done >= goal,
    progress: Math.min(1, done / goal),
  });

  return [
    step("first-lesson", "上路", "读完第一节课文", lessons, 1),
    step("first-review", "回头看", "复习第一张卡片", reviewed, 1),
    step("ten-lessons", "十节", "读完 10 节课文", lessons, 10),
    step("fifty-lessons", "五十节", "读完 50 节课文", lessons, 50),
    step("hundred-lessons", "一百节", "读完 100 节课文", lessons, 100),
    step("streak-7", "一周", "连续 7 天来学", streak, 7),
    step("streak-30", "一个月", "连续 30 天来学", streak, 30),
    step("streak-100", "一百天", "连续 100 天来学", streak, 100),
    step(
      "long-term-50",
      "记住了",
      `50 张卡片的记忆间隔超过 ${LONG_TERM_STABILITY_DAYS} 天`,
      longTerm,
      50,
    ),
    step("first-course", "走完一门", "把一门课的每一节都读完", coursesFinished, 1),
  ];
}

/**
 * The league, and why it is not ranked against other people yet.
 *
 * Duolingo's league is thirty strangers and a weekly XP race, and its known
 * cost is grinding: the top of a Diamond league needs 1,500–3,000 XP a week, so
 * people farm the easiest lesson they can find. Copying that here would fight
 * the scheduler directly — the whole product is built on *not* reviewing things
 * before they are due.
 *
 * So the tier is cut on long-term cards: how much this person can still recall
 * after the interval has stretched past three weeks. It is the one number in
 * the document that cannot be moved by working harder today. It moves when
 * time passes and you were still right.
 *
 * Ranking against other people needs accounts, and accounts are not live. The
 * screen says so rather than inventing thirty plausible strangers, because a
 * leaderboard the learner later discovers was fictional discredits every real
 * number next to it.
 */
export interface LeagueTier {
  readonly id: string;
  readonly name: string;
  /** Long-term cards needed to enter. */
  readonly at: number;
}

export const LEAGUE_TIERS: readonly LeagueTier[] = [
  { id: "stone", name: "石阶", at: 0 },
  { id: "bronze", name: "铜阶", at: 10 },
  { id: "silver", name: "银阶", at: 50 },
  { id: "gold", name: "金阶", at: 150 },
  { id: "obsidian", name: "黑曜阶", at: 400 },
];

export interface LeagueStanding {
  readonly tier: LeagueTier;
  readonly next: LeagueTier | null;
  readonly cards: number;
  /** 0 to 1 toward the next tier; 1 at the top tier. */
  readonly progress: number;
  readonly lessonsThisWeek: number;
}

/** Monday-start week, matching how a person talks about "this week". */
export function startOfWeek(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  const weekday = (date.getDay() + 6) % 7;
  return date.getTime() - weekday * 86_400_000;
}

export function leagueStanding(document: ProgressDocument, now: number): LeagueStanding {
  const cards = longTermCards(document);
  let index = 0;
  for (let step = 0; step < LEAGUE_TIERS.length; step += 1) {
    if (cards >= LEAGUE_TIERS[step]!.at) index = step;
  }
  const tier = LEAGUE_TIERS[index]!;
  const next = LEAGUE_TIERS[index + 1] ?? null;
  const weekStart = startOfWeek(now);
  const lessonsThisWeek = Object.values(document.lessons).filter(
    (lesson) => lesson.completedAt !== null && lesson.completedAt >= weekStart,
  ).length;

  return {
    tier,
    next,
    cards,
    progress: next === null ? 1 : (cards - tier.at) / (next.at - tier.at),
    lessonsThisWeek,
  };
}
