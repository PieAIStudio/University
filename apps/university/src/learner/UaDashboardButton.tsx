import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { SourceAccessExplanation, SourceAccessPort } from "@pieai/university-core";

import { CapabilityExplanation } from "@pieai/university-ui/capability/CapabilityExplanation.js";

/**
 * The learner-facing way into the studied project's full graph.
 *
 * It is shared by both builds. Local source access opens the graph; delivery
 * source access explains the boundary and its future desktop/web/mobile path.
 * Keeping the button here, instead of under `authoring/`, preserves the future
 * landing place even while one shell cannot execute the underlying process.
 */
export function UaDashboardButton({
  studyId,
  sourceAccess,
}: {
  readonly studyId: string;
  readonly sourceAccess: SourceAccessPort;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<SourceAccessExplanation | null>(null);

  async function openDashboard() {
    const access = sourceAccess.uaDashboard({ studyId });
    setError(null);
    if (access.kind === "explanation") {
      setExplanation(access);
      return;
    }
    setPending(true);
    try {
      await access.run();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "UA 项目地图暂时打不开");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ua-dashboard-entry">
      <GameButton
        variant="secondary"
        data-parity-control="ua-dashboard"
        onClick={() => void openDashboard()}
        disabled={pending}
      >
        {pending ? "正在启动 UA…" : "打开 UA 项目地图"}
      </GameButton>
      <p className="ua-dashboard-entry__hint">
        这里会打开完整的 Understand Anything 图谱；当前环境不具备时会说明原因。
      </p>
      {error ? (
        <p className="ua-dashboard-entry__error" role="alert">
          {error}
        </p>
      ) : null}
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </div>
  );
}
