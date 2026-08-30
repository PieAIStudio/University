import { translate } from "@pieai/university-ui/i18n.js";
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
      setError(
        reason instanceof Error
          ? reason.message
          : translate("app.learner.uaDashboardButton.copy.项目地图暂时打不开"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ua-dashboard-entry">
      <GameButton
        variant="ghost"
        className="ua-dashboard-entry__button"
        data-parity-control="ua-dashboard"
        onClick={() => void openDashboard()}
        disabled={pending}
      >
        {pending
          ? translate("app.learner.uaDashboardButton.copy.正在打开项目地图")
          : translate("app.learner.uaDashboardButton.copy.打开项目地图")}
      </GameButton>
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
