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
import {
  GameBadge,
  GameButton,
  GamePanel,
  GameProgress,
  GameStatList,
} from "@pieai/swimmer-ui-kit";
import { useEffect, useId, useMemo } from "react";

import { PlanetStage } from "./PlanetScene.js";
import {
  STUDY_STAGE_LABEL,
  studyCounts,
  studyCourseList,
  studyPercent,
  studyStage,
  type PlanetStudy,
} from "./planet-copy.js";
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

/**
 * The list, on its own, for the shell's aside slot.
 *
 * The picker used to be a page: its own header, its own two-column grid, its
 * own scroll box, laid inside the content area while the shell's rail and
 * counter capsule floated *over* everything else. So going from a series map
 * to the planet did not read as pulling back from one world to see them all —
 * it read as leaving the world for a settings screen, because the frame around
 * the 3D changed shape at the same moment the 3D did.
 *
 * The map's answer was already right and already built: the canvas fills the
 * frame, and every panel floats on top of it. The planet uses the same two
 * slots — this list goes where 「今天」 goes, and the globe goes where the
 * islands go. Same shell, same positions, only the world underneath changes.
 */
export function PlanetRail({
  studies: given,
  selectedId,
  onSelect,
  onEnter,
  onClose,
}: PlanetPageProps) {
  /*
    One order, both shells.

    Each shell hands this list over in whatever order its own source produced —
    the authoring shell reads directories from disk, the delivery shell reads
    an imported bundle — so the same five series arrived in two different
    orders on the same page. Nobody chose either one, which is the tell: an
    order that falls out of a file system is not a decision, and the reader has
    to relearn the list when they change campus.

    By title, zh collation, so a Chinese name sorts by pronunciation rather
    than by code point. Not by progress: a list that rearranges itself as you
    learn is a list you cannot build a habit of scanning.
  */
  const studies = useMemo(
    () => [...given].sort((left, right) => left.title.localeCompare(right.title, "zh")),
    [given],
  );

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
      className="planet-rail"
      data-planet-page="true"
      data-selected={selectedId ?? ""}
      aria-labelledby={titleId}
    >
      <header className="planet-rail__head">
        <h2 id={titleId} className="planet-rail__title">
          选课
        </h2>
        <GameButton variant="ghost" type="button" onClick={onClose} aria-label="关闭">
          关闭
        </GameButton>
      </header>

      <div className="planet-page__rail">
        <nav className="planet-page__list" aria-label="项目">
          {studies.map((study) => {
            const active = study.id === selectedId;
            const stage = studyStage(study);
            return (
              <button
                key={study.id}
                type="button"
                className="planet-page__row"
                data-study-id={study.id}
                aria-pressed={active}
                onClick={() => onSelect(study.id)}
              >
                <span className="planet-page__row-head">
                  <span className="planet-page__row-name">{study.title}</span>
                  {/*
                    The one fact that decides which row you pick. Five rows of
                    「N 门课 · M 节」 are five rows of the same shape; whether you
                    are already inside one of them is what makes it yours.
                  */}
                  <GameBadge tone={stage === "learning" ? "warning" : "neutral"}>
                    {STUDY_STAGE_LABEL[stage]}
                  </GameBadge>
                </span>
                <span className="planet-page__row-meta">{studyCounts(study)}</span>
                {study.lessonCount > 0 ? (
                  <GameProgress
                    label={`${study.title} 进度`}
                    value={study.lessonsDone}
                    max={study.lessonCount}
                    valueLabel={`${studyPercent(study)}%`}
                  />
                ) : null}
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

/**
 * The whole picker in one element, for a caller that has no aside slot.
 *
 * `PlanetRail` and `PlanetStage` are what the shells mount, into the same two
 * places the map uses. This keeps the composed form for tests and for any
 * surface that wants the picker without the shell around it.
 */
export function PlanetPage(props: PlanetPageProps) {
  return (
    <div className="planet-page" role="dialog" aria-modal="true" aria-label="选课">
      <div className="planet-page__globe" data-planet-globe="true">
        <PlanetStage
          studies={props.studies}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
        />
      </div>
      <PlanetRail {...props} />
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
      {/*
        The three numbers a reader wants before committing, in the kit's own
        stat strip rather than in three shapes invented here. The kit had this
        component the whole time; this page was hand-rolling a badge because
        nobody looked.
      */}
      <GameStatList
        label={`${study.title} 概况`}
        density="dense"
        facts={[
          { id: "courses", label: "门课", value: study.courseCount },
          { id: "lessons", label: "关", value: study.lessonCount },
          { id: "done", label: "已学", value: study.lessonsDone },
        ]}
      />
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
