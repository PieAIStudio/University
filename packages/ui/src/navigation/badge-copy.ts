import { LONG_TERM_STABILITY_DAYS, type Badge } from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

const BADGE_COPY = {
  "first-lesson": "firstLesson",
  "first-review": "firstReview",
  "ten-lessons": "tenLessons",
  "fifty-lessons": "fiftyLessons",
  "hundred-lessons": "hundredLessons",
  "streak-7": "streak7",
  "streak-30": "streak30",
  "streak-100": "streak100",
  "long-term-50": "longTerm50",
  "first-course": "firstCourse",
  "mistakes-cleared": "mistakesCleared",
  "own-words": "ownWords",
  "three-courses": "threeCourses",
  "both-paths": "bothPaths",
  "perfect-lesson": "perfectLesson",
  challenger: "challenger",
  "skip-test": "skipTest",
} as const;

/** The display adapter translates, never re-derives a badge or its progress. */
export function badgeCopy(badge: Badge, language = interfaceTranslator): Badge {
  if (!Object.hasOwn(BADGE_COPY, badge.id)) return badge;
  const key = BADGE_COPY[badge.id as keyof typeof BADGE_COPY];
  return {
    ...badge,
    name: language.t(`album.badge.${key}.name`),
    how:
      key === "longTerm50"
        ? language.t("album.badge.longTerm50.how", { days: LONG_TERM_STABILITY_DAYS })
        : language.t(`album.badge.${key}.how`),
  };
}
