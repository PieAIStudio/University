/** Readable domain names stay outside Canvas; the scene only projects anchors. */
import { useMemo } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "@pieai/university-ui/i18n.js";
import type { DomainResourceStatus } from "./use-domain-resources.js";
import { buildDomainPlan } from "./domain-plan.js";
import type { PlanetStudy, PlanetStudyDomain } from "./planet-copy.js";
import "./planet-page.css";
import "./planet-actions.css";

export function PlanetDomainLabels({
  studies,
  nodes,
  domainCatalog,
  selectedId,
  selectedDomainId,
  onSelectDomain,
  onSelectStudy,
  onEnterStudy,
}: {
  readonly studies: readonly PlanetStudy[];
  readonly nodes: Map<string, HTMLElement>;
  readonly domainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedId: string | null;
  readonly selectedDomainId?: string | null;
  readonly onSelectDomain?: (id: string) => void;
  readonly onSelectStudy?: (id: string) => void;
  readonly onEnterStudy?: (id: string) => void;
}) {
  const domains = useMemo(() => buildDomainPlan(studies, domainCatalog), [studies, domainCatalog]);
  const active =
    selectedDomainId ??
    domains.find((domain) => domain.studies.some((study) => study.id === selectedId))?.id;
  if (domains.length < 2 && !onSelectDomain) return null;
  return (
    <div
      className="planet-domain-labels"
      aria-hidden={onSelectDomain ? undefined : true}
      data-interactive={onSelectDomain ? "true" : undefined}
    >
      {domains.map((domain) => (
        <div
          key={domain.id}
          className="planet-domain-label"
          title={domain.title}
          data-planet-domain-label={domain.id}
          data-active={domain.id === active ? "true" : undefined}
          ref={(node) => {
            if (node) nodes.set(domain.id, node);
            else nodes.delete(domain.id);
          }}
        >
          {onSelectDomain ? (
            <button
              type="button"
              className="planet-domain-label__pick"
              data-domain-id={domain.id}
              aria-pressed={domain.id === active}
              onClick={() => onSelectDomain(domain.id)}
            >
              {domain.title}
            </button>
          ) : (
            domain.title
          )}
          {domain.id === active ? (
            <span className="planet-domain-label__selected">
              {translate("ui.world.domain.selected")}
            </span>
          ) : null}
          {domain.studies.length === 0 ? (
            <span className="planet-domain-label__state">
              {translate("ui.world.domain.unpublished")}
            </span>
          ) : null}
          {onEnterStudy && domain.id === active && domain.studies.length > 0 ? (
            <div className="planet-domain-label__actions">
              {domain.studies.length > 1 ? (
                <details>
                  <summary>{translate("map.chooseStudy")}</summary>
                  <div className="planet-domain-label__study-list">
                    {domain.studies.map((study) => (
                      <GameButton
                        key={study.id}
                        variant="ghost"
                        type="button"
                        data-study-id={study.id}
                        aria-pressed={selectedId === study.id}
                        onClick={() => onSelectStudy?.(study.id)}
                      >
                        {study.title}
                      </GameButton>
                    ))}
                  </div>
                </details>
              ) : null}
              {domain.studies.length === 1 ||
              domain.studies.some((study) => study.id === selectedId) ? (
                <GameButton
                  type="button"
                  variant="primary"
                  surface="liquid"
                  liquidFinish="glossy"
                  data-map-entry="true"
                  aria-label={translate("map.enterNamed", {
                    title:
                      domain.studies.length === 1
                        ? domain.studies[0]!.title
                        : domain.studies.find((study) => study.id === selectedId)!.title,
                  })}
                  onClick={() =>
                    onEnterStudy(domain.studies.length === 1 ? domain.studies[0]!.id : selectedId!)
                  }
                >
                  {translate("map.enter")}
                </GameButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PlanetResourceStatus({
  domainIds,
  states,
  onRetry,
}: {
  readonly domainIds: readonly string[];
  readonly states: Readonly<Record<string, DomainResourceStatus["state"]>>;
  readonly onRetry: () => void;
}) {
  const failed = domainIds.some((id) => states[id] === "error");
  const pending = domainIds.filter((id) => states[id] !== "ready").length;
  if (pending === 0) return null;
  return (
    <div className="planet-resource-status" data-planet-resources={failed ? "error" : "loading"}>
      <p role="status">
        {failed
          ? translate("world.resources.error")
          : translate(
              pending === 1 ? "world.resources.pending.one" : "world.resources.pending.other",
              { count: pending },
            )}
      </p>
      {failed ? (
        <GameButton onClick={onRetry}>{translate("world.resources.retry")}</GameButton>
      ) : null}
    </div>
  );
}
