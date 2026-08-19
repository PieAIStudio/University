import { useState } from "react";

import { openBlankDashboardTab, requestUaDashboardUrl } from "../api/ua-dashboard.js";
import { Tip } from "../Tip.js";
import { evidenceUaLayers, type EvidenceUaView, type EvidenceView } from "../view/lesson-view.js";

export function LessonUaLayers({ evidence }: { readonly evidence: readonly EvidenceView[] }) {
  const layers = evidenceUaLayers(evidence);
  if (layers.length === 0) return null;
  const label =
    layers.length === 1
      ? `这节课的文件落在「${layers[0]}」`
      : `这节课的文件落在：${layers.join("、")}`;
  return (
    <div className="lesson-ua-layers">
      <span>{label}</span>
      <Tip term="ua-place" className="rail-panel__help">
        <span aria-label="关于项目位置">?</span>
      </Tip>
    </div>
  );
}

/**
 * Where this cited file sits in the studied project.
 *
 * The official graph explorer answers "show me everything". A lesson only
 * needs the smaller fact: this file belongs to that layer. Opening the full
 * map stays one click away and stays UA's own page.
 */
export function EvidenceUaPlace({
  studyId,
  ua,
  compact = false,
}: {
  readonly studyId?: string;
  readonly ua: EvidenceUaView;
  readonly compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ua.layerName && !ua.summary) return null;

  async function openMap() {
    if (!studyId) return;
    const popup = openBlankDashboardTab();
    if (!popup) {
      setError("浏览器拦截了新标签页，请允许后再试。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      popup.location.href = await requestUaDashboardUrl(studyId, ua.nodeId);
    } catch (reason: unknown) {
      popup.close();
      setError(reason instanceof Error ? reason.message : "项目地图暂时打不开");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="evidence-ua-place">
      {ua.layerName ? (
        <p className="evidence-ua-place__layer">项目里的位置 · {ua.layerName}</p>
      ) : null}
      {!compact && ua.summary ? <p className="evidence-ua-place__summary">{ua.summary}</p> : null}
      {!compact && studyId ? (
        <button
          type="button"
          className="evidence-ua-place__open"
          onClick={() => void openMap()}
          disabled={pending}
        >
          {pending ? "正在打开项目地图…" : "在完整项目地图里看"}
        </button>
      ) : null}
      {error ? (
        <p className="evidence-ua-place__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
