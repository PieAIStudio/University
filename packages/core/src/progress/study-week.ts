/**
 * The avatar panel's week (V7 station 6): which of this week's seven days the
 * learner studied, and how far today's goal has come. Both are questions asked
 * of the record — lessons finished, answers given, cards recalled, days a
 * rest-day ticket covered — never a stored calendar.
 *
 * `last_review` on a card is only the most recent review, so a card reviewed
 * Monday and again Wednesday counts for Wednesday alone; the recall attempts
 * and the lesson and exercise timestamps fill in the rest. A day with any of
 * them lights.
 */
import type { ProgressDocument } from "../ports/progress.js";
import { calendarDay, questsForToday, questProgress, scoredQuests, startOfWeek } from "./goals.js";

export interface StudyWeekDay {
  /** `YYYY-MM-DD`, Monday first. */
  readonly day: string;
  readonly studied: boolean;
  /** Missed, but a rest-day ticket kept the streak. */
  readonly rested: boolean;
  readonly today: boolean;
}

export function studyWeek(document: ProgressDocument, now: number): readonly StudyWeekDay[] {
  const active = new Set<string>();
  const add = (at: number | string | null | undefined) => {
    const time = typeof at === "string" ? Date.parse(at) : at;
    if (typeof time === "number" && Number.isFinite(time)) active.add(calendarDay(time));
  };
  for (const lesson of Object.values(document.lessons)) add(lesson.completedAt);
  for (const attempt of Object.values(document.exerciseAttempts)) add(attempt.occurredAt);
  for (const attempt of Object.values(document.retrievalAttempts)) add(attempt.revealedAt);
  for (const card of Object.values(document.cards)) add(card.fsrs.last_review);
  const rested = new Set(document.streak.rest?.covered ?? []);
  const today = calendarDay(now);
  const monday = new Date(startOfWeek(now));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const day = calendarDay(date.getTime());
    return { day, studied: active.has(day), rested: rested.has(day), today: day === today };
  });
}

/** Today's goal as 0–1: the scored daily quests, on average; 1 means the ring turns gold. */
export function todayGoalProgress(document: ProgressDocument, now: number): number {
  const quests = scoredQuests(questsForToday(document, now));
  if (quests.length === 0) return 0;
  return quests.reduce((sum, quest) => sum + questProgress(quest), 0) / quests.length;
}
