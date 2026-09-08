/** Readable domain names stay outside Canvas; the scene only projects anchors. */
import { useMemo } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "@pieai/university-ui/i18n.js";
import type { DomainResourceStatus } from "./use-domain-resources.js";
import { buildDomainPlan } from "./domain-plan.js";
import type { PlanetStudy, PlanetStudyDomain } from "./planet-copy.js";
import "./planet-page.css";

export function PlanetDomainLabels({
  studies,
  nodes,
  domainCatalog,
  selectedId,
  selectedDomainId,
}: {
  readonly studies: readonly PlanetStudy[];
  readonly nodes: Map<string, HTMLElement>;
  readonly domainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedId: string | null;
  readonly selectedDomainId?: string | null;
}) {
  const domains = useMemo(() => buildDomainPlan(studies, domainCatalog), [studies, domainCatalog]);
  const active =
    selectedDomainId ??
    domains.find((domain) => domain.studies.some((study) => study.id === selectedId))?.id;
  if (domains.length < 2) return null;
  return (
    <div className="planet-domain-labels" aria-hidden="true">
      {domains.map((domain) => (
        <span
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
          {domain.title}
          {domain.studies.length === 0 ? (
            <span className="planet-domain-label__state">
              {translate("ui.world.domain.unpublished")}
            </span>
          ) : null}
        </span>
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
          ? "部分地图细节暂未准备好，课程列表仍可使用。"
          : `正在准备 ${pending} 个领域的地图细节，课程列表可直接使用。`}
      </p>
      {failed ? <GameButton onClick={onRetry}>重试地图准备</GameButton> : null}
    </div>
  );
}
