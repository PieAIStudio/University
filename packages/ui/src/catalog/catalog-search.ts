import type { LessonRef } from "@pieai/university-core";
import type { CatalogLesson, CatalogListing } from "./CatalogSurface.js";

export interface CatalogMatch {
  readonly locator: LessonRef;
  readonly studyTitle: string;
  readonly courseTitle: string;
  readonly unitTitle: string;
  readonly lesson: CatalogLesson;
}

const normalize = (text: string) => text.normalize("NFKC").toLowerCase();

/** Search the same published read model; never mutate or build another catalog. */
export function searchCatalogLessons(listing: CatalogListing, query: string): CatalogMatch[] {
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  const matches: CatalogMatch[] = [];
  for (const study of listing.studies)
    for (const course of study.courses) {
      for (const unit of course.units)
        for (const lesson of unit.lessons) {
          const text = normalize(
            [study.title, course.title, course.searchText ?? "", unit.title, lesson.title].join(
              "\n",
            ),
          );
          if (terms.every((term) => text.includes(term)))
            matches.push({
              locator: {
                studyId: study.id,
                courseId: course.id,
                unitId: unit.id,
                lessonId: lesson.id,
              },
              studyTitle: study.title,
              courseTitle: course.title,
              unitTitle: unit.title,
              lesson,
            });
        }
    }
  return matches;
}
