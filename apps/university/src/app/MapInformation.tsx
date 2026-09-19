import { GameBadge } from "@pieai/swimmer-ui-kit";
import { translate as t } from "@pieai/university-ui/i18n.js";
import type { CourseView, UnitView } from "@pieai/university-ui/view/lesson-view.js";
import "./map-navigation.css";

export interface MapInformationData {
  readonly id: string;
  readonly title: string;
  readonly kind: "domain" | "study" | "course" | "lesson" | "none";
  readonly description?: string;
  readonly facts?: readonly string[];
  readonly sections?: readonly { readonly title: string; readonly lines: readonly string[] }[];
}

/** The title is rendered by the shared frame. This body never owns an entry action. */
export function MapInformation({ data }: { readonly data: MapInformationData }) {
  return (
    <div className="map-information" data-map-information={data.id}>
      <p className="map-information__kind">
        {t(data.kind === "none" ? "map.noSelection" : `map.${data.kind}`)}
      </p>
      {data.description ? <p>{data.description}</p> : null}
      {data.facts?.length ? (
        <div className="map-information__facts">
          {data.facts.map((fact) => (
            <GameBadge key={fact} tone="neutral">
              {fact}
            </GameBadge>
          ))}
        </div>
      ) : null}
      {data.sections?.map((section) =>
        section.lines.length ? (
          <section key={section.title}>
            <h3>{section.title}</h3>
            {section.lines.length === 1 ? (
              <p>{section.lines[0]}</p>
            ) : (
              <ul>
                {section.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>
        ) : null,
      )}
    </div>
  );
}

export function courseInformation(
  course: CourseView,
  done: number,
  assumptions: readonly { title: string }[] = [],
): MapInformationData {
  const total = course.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  return {
    id: `course:${course.id}`,
    title: course.title,
    kind: "course",
    description: course.description,
    facts: [t("map.completedCount", { done, total })],
    sections: [
      { title: t("map.objectives"), lines: course.objectives },
      { title: t("map.audience"), lines: course.audience ? [course.audience] : [] },
      {
        title: t("map.prerequisites"),
        lines: assumptions.length
          ? [...assumptions.map((item) => item.title), t("map.prerequisiteNote")]
          : [],
      },
    ],
  };
}

export function lessonInformation(
  unit: UnitView,
  lesson: UnitView["lessons"][number],
): MapInformationData {
  return {
    id: `lesson:${lesson.id}`,
    title: lesson.title,
    kind: "lesson",
    description: unit.objective,
    facts: [
      t("map.exerciseCount", { count: lesson.exerciseCount }),
      t("map.cardCount", { count: lesson.cardCount }),
    ],
    sections: [
      { title: t("map.unit"), lines: [unit.title] },
      { title: t("map.information"), lines: [t("map.sources")] },
    ],
  };
}
