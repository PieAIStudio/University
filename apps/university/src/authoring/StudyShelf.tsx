import { translate } from "@pieai/university-ui/i18n.js";
import { useMemo } from "react";

import type { BootstrapData, StudySummary } from "@pieai/university-ui/view/lesson-view.js";

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
  return translate("app.authoring.studyShelf.copy.刚刚");
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
  /*
    One list, not a shortcut row above the same list again.

    The shortcut earns its space by being shorter than what it shortcuts. On a
    shelf of four projects it named three of them, so TuringPact and SupaLuv
    each appeared twice, a few centimetres apart, under two different headings —
    which reads as a bug whatever the reasoning behind it. The information the
    row carried was never the ordering anyway, it was "when did I last touch
    this", and that can simply be written on the entry.

    So the list keeps the alphabetical order that makes it pointable from
    memory, and says both things at once. `recentStudies` stays exported: which
    project to open on is a different question, and still the right one to
    answer by recency.
  */
  const liveIds = useMemo(
    () => new Set(recentStudies(data.studies).map((study) => study.id)),
    [data.studies],
  );
  return (
    <aside
      className="study-shelf"
      aria-label={translate("app.authoring.studyShelf.copy.学习项目列表")}
    >
      <p className="eyebrow">{translate("app.authoring.studyShelf.copy.你的学习项目")}</p>
      {data.studies.map((study) => (
        <button
          key={study.id}
          type="button"
          className="study-shelf__item"
          data-active={selectedStudyId === study.id}
          data-live={study.lastActivityAt !== null && liveIds.has(study.id)}
          // `data-active` only reaches CSS. Screen-reader users need the
          // selected project announced, not just tinted.
          aria-current={selectedStudyId === study.id ? "true" : undefined}
          onClick={() => onSelect(study.id)}
        >
          <span>{study.title}</span>
          <small>
            {study.activeCourseCount > 0
              ? translate("app.authoring.studyShelf.copy.value0-门课可学习", {
                  value0: study.activeCourseCount,
                })
              : translate("app.authoring.studyShelf.copy.准备中")}
            {study.lastActivityAt ? ` · ${relativeTimeLabel(study.lastActivityAt)}` : null}
          </small>
        </button>
      ))}
    </aside>
  );
}
