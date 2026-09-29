import type { ReactNode } from "react";
import type { StudyWeekDay } from "@pieai/university-core";

import { useI18n } from "../i18n/index.js";

/** The letter under each dot, and the name a screen reader says for it: "T" is two days. */
const WEEKDAYS = [
  ["avatarPanel.weekday.mon", "avatarPanel.dayName.mon"],
  ["avatarPanel.weekday.tue", "avatarPanel.dayName.tue"],
  ["avatarPanel.weekday.wed", "avatarPanel.dayName.wed"],
  ["avatarPanel.weekday.thu", "avatarPanel.dayName.thu"],
  ["avatarPanel.weekday.fri", "avatarPanel.dayName.fri"],
  ["avatarPanel.weekday.sat", "avatarPanel.dayName.sat"],
  ["avatarPanel.weekday.sun", "avatarPanel.dayName.sun"],
] as const;

/**
 * The avatar panel at the foot of the rail (V7 station 6): who you are and
 * whether today counts. The two numbers people look at most sit on the face —
 * the ring round the avatar is today's goal and closes gold when it is met,
 * the flame at its lower right is the streak — and below them the rank, the
 * level, the week's seven days and one quiet way to membership.
 *
 * The avatar and the emblems are pictures other packages draw; this component
 * only places them, so it stays free of three. When the rail folds to the
 * avatar alone (and on phones), the face keeps its ring and flame.
 */
export function AvatarPanel({
  avatar,
  todayProgress,
  streakDays,
  rank,
  level,
  week,
  today,
  membership,
  rest,
}: {
  readonly avatar: ReactNode;
  /** 0 to 1: today's goal; the ring turns gold at 1. */
  readonly todayProgress: number;
  readonly streakDays: number;
  readonly rank: { readonly name: string; readonly emblem?: ReactNode };
  readonly level: ReactNode;
  readonly week: readonly StudyWeekDay[];
  readonly today: { readonly done: number; readonly goal: number };
  readonly membership?: { readonly href: string };
  readonly rest?: { readonly balance: number; readonly covered: number };
}) {
  const interfaceTranslator = useI18n();
  const t = interfaceTranslator.t;
  const progress = Math.max(0, Math.min(1, Number.isFinite(todayProgress) ? todayProgress : 0));
  const met = progress >= 1;
  const circumference = 2 * Math.PI * 46;
  return (
    <div className="avatar-panel" data-goal-met={met || undefined}>
      <div className="avatar-panel__face">
        {avatar}
        <svg className="avatar-panel__ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="avatar-panel__ring-track" cx="50" cy="50" r="46" />
          <circle
            className="avatar-panel__ring-fill"
            cx="50"
            cy="50"
            r="46"
            strokeDasharray={`${progress * circumference} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        {/* A zero stays, greyed: it is a true fact about a system that exists. */}
        <span
          className="avatar-panel__flame"
          role="img"
          aria-label={t("avatarPanel.streak", { days: streakDays })}
          data-muted={streakDays === 0 || undefined}
        >
          <svg viewBox="0 0 14 16" aria-hidden="true">
            <path d="M7 0C9 4 13 6 13 10.5 13 13.5 10.3 16 7 16S1 13.5 1 10.5C1 8 2.6 6.4 4 5.2 4 7 5 8 6 8.2 5.6 5.6 6 2.6 7 0z" />
          </svg>
          <span aria-hidden="true">{streakDays}</span>
        </span>
      </div>
      <p className="avatar-panel__rank">
        {rank.emblem ? (
          <span className="avatar-panel__rank-emblem" aria-hidden="true">
            {rank.emblem}
          </span>
        ) : null}
        <span>{rank.name}</span>
      </p>
      {level}
      <ol className="avatar-panel__week" aria-label={t("avatarPanel.week")}>
        {week.map((day, index) => {
          const [letter, name] = WEEKDAYS[index]!;
          return (
            <li
              key={day.day}
              className="avatar-panel__day"
              data-studied={day.studied || undefined}
              data-rested={(!day.studied && day.rested) || undefined}
              data-today={day.today || undefined}
              aria-label={
                day.studied
                  ? t("avatarPanel.dayStudied", { day: t(name) })
                  : day.rested
                    ? t("avatarPanel.dayRested", { day: t(name) })
                    : t(name)
              }
            >
              <i aria-hidden="true" />
              <span aria-hidden="true">{t(letter)}</span>
            </li>
          );
        })}
      </ol>
      <p className="avatar-panel__today">
        <span>{t("avatarPanel.today")}</span>
        <b>{t("avatarPanel.todayLessons", { done: today.done, goal: today.goal })}</b>
      </p>
      {rest ? (
        <details className="avatar-panel__rest" data-rest-tickets={rest.balance}>
          <summary>{t("journey.rest.balance", { count: rest.balance })}</summary>
          <p>{t("journey.rest.rules")}</p>
          <p>{t("journey.rest.covered", { count: rest.covered })}</p>
        </details>
      ) : null}
      {membership ? (
        <a className="avatar-panel__membership" href={membership.href}>
          {t("avatarPanel.membership")}
        </a>
      ) : null}
    </div>
  );
}
