import { useEffect, useRef, useState } from "react";

import { IslandIcon } from "../shell/icons.js";

export interface StudySwitchItem {
  readonly id: string;
  readonly title: string;
  readonly courseCount: number;
  readonly done: number;
  readonly total: number;
}

export function studySwitchMeta(item: StudySwitchItem): string {
  if (item.done <= 0) return `${item.courseCount} 门 · 没开始`;
  return `${item.courseCount} 门 · 学到 ${item.done}/${item.total}`;
}

/**
 * The ▾ next to the current study. One control, both shells: pick a sea or
 * pull back to all four. The list is the way you change course without
 * hunting for an island.
 */
export function StudySwitcher({
  studies,
  focusedId,
  onSelect,
}: {
  readonly studies: readonly StudySwitchItem[];
  readonly focusedId: string | null;
  readonly onSelect: (studyId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const focused = studies.find((study) => study.id === focusedId);
  const label = focused?.title ?? "四片海";

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
        aria-label={`当前项目 ${label}`}
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
        <ul className="study-switcher__menu" role="listbox" aria-label="换课">
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
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={focusedId == null}
              className="study-switcher__option"
              onClick={() => {
                setOpen(false);
                onSelect(null);
              }}
            >
              看全部四片海
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
