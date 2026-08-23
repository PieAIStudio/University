/**
 * Study picker: globe is the map, the list is the control.
 *
 * Props are the whole contract. This file does not import the library, a
 * progress store, or a shell route — those are the parent's job, and two
 * shells would otherwise grow two different ideas of what a study is.
 *
 * Why GameButton / GamePanel / GameProgress and not a local set that looks
 * like them: brand-kit-first. Why not GameDialog: it is a titled <section>
 * with no layout API, and this page is a two-pane grid the dialog skin
 * would fight. Why the list rows are not GameButton: a row is a choice,
 * not an action; the kit's button is the enter/close pair.
 */
import { GameBadge, GameButton, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import { useEffect, useId } from "react";

import { PlanetStage } from "./PlanetScene.js";
import { studyCounts, studyCourseList, type PlanetStudy } from "./planet-copy.js";
import "./planet-page.css";

export type { PlanetStudy };

export interface PlanetPageProps {
  readonly studies: readonly PlanetStudy[];
  readonly selectedId: string | null;
  readonly onSelect: (studyId: string) => void;
  /** 「进入 <名字>」 */
  readonly onEnter: (studyId: string) => void;
  readonly onClose: () => void;
}

export function PlanetPage({ studies, selectedId, onSelect, onEnter, onClose }: PlanetPageProps) {
  const titleId = useId();
  const selected = studies.find((study) => study.id === selectedId) ?? null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="planet-page"
      data-planet-page="true"
      data-selected={selectedId ?? ""}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="planet-page__head">
        <h1 id={titleId} className="planet-page__title">
          选课
        </h1>
        <GameButton variant="ghost" type="button" onClick={onClose} aria-label="关闭">
          关闭
        </GameButton>
      </header>

      <div className="planet-page__globe" data-planet-globe="true">
        <PlanetStage studies={studies} selectedId={selectedId} onSelect={onSelect} />
      </div>

      <div className="planet-page__rail">
        <nav className="planet-page__list" aria-label="项目">
          {studies.map((study) => {
            const active = study.id === selectedId;
            return (
              <button
                key={study.id}
                type="button"
                className="planet-page__row"
                data-study-id={study.id}
                aria-pressed={active}
                onClick={() => onSelect(study.id)}
              >
                <span className="planet-page__row-name">{study.title}</span>
                <span className="planet-page__row-meta">{studyCounts(study)}</span>
              </button>
            );
          })}
        </nav>

        <div className="planet-page__detail">
          {selected ? (
            <StudyDetail study={selected} onEnter={onEnter} />
          ) : (
            <p className="planet-page__hint">从列表里选一个项目</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StudyDetail({
  study,
  onEnter,
}: {
  readonly study: PlanetStudy;
  readonly onEnter: (studyId: string) => void;
}) {
  const listed = studyCourseList(study);
  return (
    <GamePanel tone="strong" className="planet-page__card" title={study.title}>
      <p className="planet-page__counts">{studyCounts(study)}</p>
      {study.lessonCount > 0 ? (
        <GameProgress
          label="进度"
          value={study.lessonsDone}
          max={study.lessonCount}
          valueLabel={`${study.lessonsDone} / ${study.lessonCount}`}
        />
      ) : null}
      <GameBadge tone={study.lessonsDone > 0 ? "success" : "neutral"}>
        {study.courseCount} 门课
      </GameBadge>
      {listed.shown.length > 0 ? (
        <ul className="planet-page__courses">
          {listed.shown.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      ) : null}
      {listed.restLabel ? <p className="planet-page__rest">{listed.restLabel}</p> : null}
      <GameButton
        variant="primary"
        type="button"
        className="planet-page__enter"
        onClick={() => onEnter(study.id)}
      >
        {/*
          The button names where it goes, the same way the way back out of a
          course does. 「进入这个项目」 was two problems in five characters: a
          category word the reader has to resolve against the card they are
          looking at, and the wrong category word — 通用课 is nobody's project.
        */}
        进入 {study.title}
      </GameButton>
    </GamePanel>
  );
}
