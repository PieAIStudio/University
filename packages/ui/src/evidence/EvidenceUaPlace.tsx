import { translate } from "../i18n/index.js";
import { useState } from "react";

import type { SourceAccessExplanation, SourceAccessPort } from "@pieai/university-core";

import { CapabilityExplanation } from "../capability/CapabilityExplanation.js";
import type { EvidenceUaView } from "../view/lesson-view.js";

type EvidenceUaPlaceProps =
  | {
      readonly studyId?: string;
      readonly ua: EvidenceUaView;
      readonly compact: true;
      readonly sourceAccess?: never;
    }
  | {
      readonly studyId?: string;
      readonly ua: EvidenceUaView;
      readonly compact?: false;
      readonly sourceAccess: SourceAccessPort;
    };

/**
 * Where this cited file sits in the studied project.
 *
 * The official graph explorer answers "show me everything". A lesson only
 * needs the smaller fact: this file belongs to that layer. Opening the full
 * map stays one click away and stays UA's own page.
 */
export function EvidenceUaPlace(props: EvidenceUaPlaceProps) {
  const { studyId, ua, compact = false } = props;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<SourceAccessExplanation | null>(null);

  // The delivery package deliberately omits the private graph metadata. The
  // full source sheet still needs the same learner control, so it may pass an
  // empty place and let the port explain the boundary. Compact inline prose
  // keeps its old quiet shape when no place metadata exists.
  if (!ua.layerName && !ua.summary && compact) return null;

  async function openMap() {
    if (!studyId || !("sourceAccess" in props) || !props.sourceAccess) return;
    const access = props.sourceAccess.uaDashboard({ studyId, nodeId: ua.nodeId });
    if (access.kind === "explanation") {
      setExplanation(access);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await access.run();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate("ui.evidence.evidenceUaPlace.copy.项目地图暂时打不开"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="evidence-ua-place">
      {!compact ? (
        <p className="evidence-ua-place__layer">
          {translate("ui.evidence.evidenceUaPlace.copy.项目里的位置-这份课程引用的源码")}
        </p>
      ) : ua.layerName ? (
        <p className="evidence-ua-place__layer">
          {translate("ui.evidence.evidenceUaPlace.copy.项目里的位置")} {ua.layerName}
        </p>
      ) : null}
      {!compact && ua.summary ? <p className="evidence-ua-place__summary">{ua.summary}</p> : null}
      {!compact && studyId ? (
        <button
          type="button"
          className="evidence-ua-place__open"
          data-parity-control="evidence-ua-dashboard"
          onClick={() => void openMap()}
          disabled={pending}
        >
          {pending
            ? translate("ui.evidence.evidenceUaPlace.copy.正在打开项目地图")
            : translate("ui.evidence.evidenceUaPlace.copy.在完整项目地图里看")}
        </button>
      ) : null}
      {error ? (
        <p className="evidence-ua-place__error" role="alert">
          {error}
        </p>
      ) : null}
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </div>
  );
}
