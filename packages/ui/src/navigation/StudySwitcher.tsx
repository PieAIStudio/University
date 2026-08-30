import { translate } from "../i18n/index.js";
import { useEffect, useRef, useState } from "react";

import { IslandIcon } from "../shell/icons.js";

export { focusedStudyId, type LearnerNavigationFocus } from "./focused-study.js";

export interface StudySwitchItem {
  readonly id: string;
  readonly title: string;
  readonly courseCount: number;
  readonly done: number;
  readonly total: number;
}

export function studySwitchMeta(item: StudySwitchItem): string {
  if (item.done <= 0)
    return translate("ui.navigation.studySwitcher.copy.value0-门-没开始", {
      value0: item.courseCount,
    });
  return translate("ui.navigation.studySwitcher.copy.value0-门-学到-value1-value2", {
    value0: item.courseCount,
    value1: item.done,
    value2: item.total,
  });
}

/**
 * The ▾ next to the current project. One control, both shells: this is the way
 * you change project without hunting for an island.
 *
 * It used to end with 「看全部四片海」, which pulled the camera back to show all
 * four archipelagos in one ocean. That view no longer exists — a series is its
 * own scene now — so what replaces it is a page: the planet, where every series
 * is a point and the list beside it is the control.
 */
export function StudySwitcher({
  studies,
  focusedId,
  onSelect,
  onOpenPlanet,
}: {
  readonly studies: readonly StudySwitchItem[];
  /**
   * The series being shown, already resolved — never the shell's raw pick.
   *
   * Not `string | null`. Null used to mean 「看全部四片海」 and, when that view
   * was retired, quietly went on meaning 「选一个项目」 instead: the authoring
   * shell passed its unresolved state and the capsule announced that no project
   * was chosen while the map behind it was drawing one. Resolve with
   * `focusedStudyId` and the mismatch cannot be written.
   */
  readonly focusedId: string;
  readonly onSelect: (studyId: string) => void;
  /**
   * Opens the planet. Separate from `onSelect` rather than `onSelect(null)`,
   * because they are different verbs: one changes which series you are in, the
   * other leaves the map to go looking. Passing null for "go somewhere else" is
   * how the old four-seas option got away with doing nothing for a while.
   */
  readonly onOpenPlanet?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const focused = studies.find((study) => study.id === focusedId);
  // Only reachable when the id names a study the catalogue no longer has;
  // `focusedStudyId` already rejects those, so this is a seatbelt.
  const label = focused?.title ?? translate("ui.navigation.studySwitcher.copy.选一个项目");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onPointer);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="study-switcher" ref={rootRef}>
      <button
        type="button"
        className="study-switcher__trigger counter-row__item"
        aria-label={translate("ui.navigation.studySwitcher.copy.当前系列-value0", {
          value0: label,
        })}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="counter-row__icon">
          <IslandIcon />
        </span>
        <span className="counter-row__value">{label}</span>
        <span className="study-switcher__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          className="study-switcher__menu"
          role="listbox"
          aria-label={translate("ui.navigation.studySwitcher.copy.换系列")}
        >
          {studies.map((study) => (
            <li key={study.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={study.id === focusedId}
                className="study-switcher__option"
                onClick={() => {
                  setOpen(false);
                  onSelect(study.id);
                }}
              >
                <span className="study-switcher__name">{study.title}</span>{" "}
                <span className="study-switcher__meta">{studySwitchMeta(study)}</span>
              </button>
            </li>
          ))}
          {onOpenPlanet ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="study-switcher__option study-switcher__option--all"
                onClick={() => {
                  setOpen(false);
                  onOpenPlanet();
                }}
              >
                {translate("ui.navigation.studySwitcher.copy.看所有课程系列")}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
