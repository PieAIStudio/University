import { useMemo } from "react";

import type { BootstrapData, StudySummary } from "../view/lesson-view.js";

/**
 * How many projects the shortcut row carries. Three is the point where a
 * shortcut stops being one: past that it is just the full list again, in an
 * order that changes under you.
 */
const RECENT_STUDY_LIMIT = 3;

/**
 * The projects actually being worked through, most recent first.
 *
 * Ordered by real learning events rather than by a pin the learner has to
 * maintain — the answer to "what am I in the middle of" is already written in
 * the review and completion log, and asking someone to also keep a pin list
 * current is asking them to restate what the system watched them do.
 *
 * The full list below stays alphabetical on purpose. A shelf that reorders
 * itself is a shelf you have to re-read; the shortcut row absorbs the movement
 * so the list underneath can stay somewhere you can point at from memory.
 */
export function recentStudies(studies: readonly StudySummary[]): readonly StudySummary[] {
  return studies
    .filter((study) => study.lastActivityAt !== null)
    .toSorted((left, right) => Date.parse(right.lastActivityAt!) - Date.parse(left.lastActivityAt!))
    .slice(0, RECENT_STUDY_LIMIT);
}

/** "3 小时前" — the unit a learner thinks in, not a timestamp they have to subtract. */
export function relativeTimeLabel(iso: string, now = Date.now()): string {
  const elapsedMs = now - Date.parse(iso);
  const format = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const scale: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
    ["year", 365 * 24 * 3_600_000],
    ["month", 30 * 24 * 3_600_000],
    ["day", 24 * 3_600_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of scale) {
    const value = Math.trunc(elapsedMs / ms);
    if (value >= 1) return format.format(-value, unit);
  }
  return "刚刚";
}

export function StudyShelf({
  data,
  selectedStudyId,
  onSelect,
}: {
  readonly data: BootstrapData;
  readonly selectedStudyId: string | null;
  readonly onSelect: (studyId: string) => void;
}) {
  const recent = useMemo(() => recentStudies(data.studies), [data.studies]);
  return (
    <aside className="study-shelf" aria-label="学习项目列表">
      {recent.length > 0 ? (
        <nav className="study-shelf__recent" aria-label="正在学习中">
          <p className="eyebrow">正在学习中</p>
          {recent.map((study) => (
            <button
              key={study.id}
              type="button"
              className="study-shelf__recent-item"
              data-active={selectedStudyId === study.id}
              aria-current={selectedStudyId === study.id ? "true" : undefined}
              onClick={() => onSelect(study.id)}
            >
              <span>{study.title}</span>
              <small>{relativeTimeLabel(study.lastActivityAt!)}</small>
            </button>
          ))}
        </nav>
      ) : null}
      <p className="eyebrow">YOUR STUDIES</p>
      {data.studies.map((study) => (
        <button
          key={study.id}
          type="button"
          className="study-shelf__item"
          data-active={selectedStudyId === study.id}
          // `data-active` only reaches CSS. Screen-reader users need the
          // selected project announced, not just tinted.
          aria-current={selectedStudyId === study.id ? "true" : undefined}
          onClick={() => onSelect(study.id)}
        >
          <span>{study.title}</span>
          <small>
            {study.activeCourseCount > 0 ? `${study.activeCourseCount} 门课可学习` : "准备中"}
          </small>
        </button>
      ))}
    </aside>
  );
}
