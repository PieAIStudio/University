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
import { translate } from "@pieai/university-ui/i18n.js";

import { PlanetStage } from "./PlanetScene.js";
import { buildDomainPlan, type DomainPlanGroup } from "./domain-plan.js";
import {
  STUDY_STAGE_LABEL,
  studyCounts,
  studyCourseList,
  studyMarkerColor,
  studyPercent,
  studyStage,
  type PlanetCourse,
  type PlanetStudy,
  type PlanetStudyDomain,
} from "./planet-copy.js";
import "./planet-page.css";

export type { DomainPlanGroup, PlanetCourse, PlanetStudy, PlanetStudyDomain };

export interface PlanetPageProps {
  readonly studies: readonly PlanetStudy[];
  /** Explicit metadata can include a domain with no series; never invent a study for it. */
  readonly domainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedId: string | null;
  readonly selectedDomainId?: string | null;
  readonly onSelectDomain?: (domainId: string) => void;
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
  domainCatalog,
  selectedId,
  selectedDomainId,
  onSelectDomain,
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

    Domain and study IDs define one stable order shared with the sphere.
    Progress and translated titles cannot rearrange the navigation list.
  */
  const domainPlan = useMemo(() => buildDomainPlan(given, domainCatalog), [given, domainCatalog]);

  const titleId = useId();
  const selected = useMemo(() => {
    for (const domain of domainPlan) {
      if (selectedDomainId && domain.id !== selectedDomainId) continue;
      const found = domain.studies.find((study) => study.id === selectedId);
      if (found) return found;
    }
    return null;
  }, [domainPlan, selectedId, selectedDomainId]);

  const activeDomain = useMemo(() => {
    const explicit = domainPlan.find((domain) => domain.id === selectedDomainId);
    if (explicit) return explicit;
    if (selected) {
      return domainPlan.find((domain) => domain.studies.some((s) => s.id === selected.id)) ?? null;
    }
    return domainPlan[0] ?? null;
  }, [domainPlan, selected, selectedDomainId]);

  const returnDomain =
    domainPlan.find((domain) => domain.studies.some((study) => study.id === selectedId)) ??
    domainPlan.find((domain) => domain.studies.length > 0);
  const selectDomain = (domain: DomainPlanGroup) => {
    if (onSelectDomain) {
      // The shell owns remembered selections, including a visit to an empty
      // planet. An unconditional first-row callback would overwrite its restore.
      onSelectDomain(domain.id);
    } else {
      const restored = domain.studies.find((study) => study.id === selectedId) ?? domain.studies[0];
      if (restored && restored.id !== selectedId) onSelect(restored.id);
    }
  };

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
      data-domain-empty={activeDomain?.studies.length ? undefined : "true"}
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

      {domainPlan.length > 0 ? (
        <div className="planet-rail__domains" role="toolbar" aria-label="领域列表">
          {domainPlan.map((domain) => {
            const isActive = activeDomain?.id === domain.id;
            return (
              <button
                key={domain.id}
                type="button"
                className={`planet-rail__domain-button${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                data-domain-id={domain.id}
                data-domain-state={domain.studies.length === 0 ? "unpublished" : "published"}
                onClick={() => selectDomain(domain)}
              >
                {domain.title}
                {domain.studies.length === 0 ? (
                  <span className="planet-rail__domain-state">
                    {translate("ui.world.domain.unpublished")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="planet-page__rail">
        <nav className="planet-page__list" aria-label="项目">
          {(activeDomain ? [activeDomain] : domainPlan).map((domain) => (
            <div key={domain.id} className="planet-page__domain-group" data-domain-id={domain.id}>
              <div className="planet-page__domain-title">{domain.title}</div>
              {domain.studies.length > 0 && domain.description ? (
                <p className="planet-page__domain-description">{domain.description}</p>
              ) : null}
              {domain.studies.map((study) => {
                const active = study.id === selectedId;
                const stage = studyStage(study);
                return (
                  <button
                    key={study.id}
                    type="button"
                    className="planet-page__row"
                    data-study-id={study.id}
                    aria-pressed={active}
                    onClick={() => {
                      onSelectDomain?.(domain.id);
                      onSelect(study.id);
                    }}
                  >
                    <span className="planet-page__row-head">
                      <span className="planet-page__row-name-wrap">
                        <span
                          className="planet-page__row-swatch"
                          aria-hidden="true"
                          style={{ backgroundColor: studyMarkerColor(study.id).css }}
                        />
                        <span className="planet-page__row-name">{study.title}</span>
                      </span>
                      {/*
                        The one fact that decides which row you pick. Five rows of
                        「N 门课 · M节」 are five rows of the same shape; whether you
                        are already inside one of them is what makes it yours.
                      */}
                      <GameBadge tone={stage === "learning" ? "warning" : "neutral"}>
                        {STUDY_STAGE_LABEL[stage]}
                      </GameBadge>
                    </span>
                    <span className="planet-page__row-meta">
                      <span>{studyCounts(study)}</span>
                      {study.lessonCount > 0 ? <span>完成 {studyPercent(study)}%</span> : null}
                    </span>
                    {/* The selected detail owns the kit's animated progress.
                        Thirty independent liquid bars exhaust its animation
                        budget; list rows need the readable fact, not 30 effects. */}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="planet-page__detail">
          {selected ? (
            <StudyDetail study={selected} />
          ) : activeDomain?.studies.length === 0 ? (
            <div className="planet-page__empty" data-domain-empty={activeDomain.id}>
              <div role="status">
                <GameBadge tone="neutral">{translate("ui.world.domain.unpublished")}</GameBadge>
                {activeDomain.description ? (
                  <p className="planet-page__domain-description">{activeDomain.description}</p>
                ) : null}
                <p className="planet-page__hint">{translate("ui.world.domain.empty")}</p>
              </div>
              {returnDomain ? (
                <GameButton
                  type="button"
                  variant="ghost"
                  className="planet-page__return"
                  onClick={() => selectDomain(returnDomain)}
                >
                  {translate("ui.world.domain.return", { title: returnDomain.title })}
                </GameButton>
              ) : null}
            </div>
          ) : (
            <p className="planet-page__hint" role="status">
              {domainPlan.length === 0 ? "还没有可选的课程系列。" : "从列表里选一个项目"}
            </p>
          )}
        </div>
        {selected ? (
          <GameButton
            variant="primary"
            type="button"
            className="planet-page__enter"
            onClick={() => onEnter(selected.id)}
          >
            {/*
              The button names where it goes, the same way the way back out of a
              course does. 「进入这个项目」 was two problems in five characters: a
              category word the reader has to resolve against the card they are
              looking at, and the wrong category word — 通用课 is nobody's project.
            */}
            <span className="planet-page__enter-label">进入 {selected.title}</span>
          </GameButton>
        ) : null}
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
          domainCatalog={props.domainCatalog}
          selectedId={props.selectedId}
          selectedDomainId={props.selectedDomainId}
          onSelectDomain={props.onSelectDomain}
          onSelect={props.onSelect}
        />
      </div>
      <PlanetRail {...props} />
    </div>
  );
}

function StudyDetail({ study }: { readonly study: PlanetStudy }) {
  const listed = studyCourseList(study);
  return (
    <GamePanel tone="strong" className="planet-page__card" title={study.title}>
      {study.description ? (
        <p className="planet-page__domain-description" data-study-description>
          {study.description}
        </p>
      ) : null}
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
    </GamePanel>
  );
}
