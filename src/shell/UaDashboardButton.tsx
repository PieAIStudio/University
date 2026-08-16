import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

import { openBlankDashboardTab, requestUaDashboardUrl } from "../api/ua-dashboard.js";

/**
 * Open the official UA graph in a browser tab after the local bridge has
 * started it. Opening a blank tab synchronously keeps the action usable under
 * popup blockers; the tokenized URL arrives a moment later.
 */
export function UaDashboardButton({
  studyId,
  available = true,
}: {
  readonly studyId: string;
  readonly available?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) return null;

  async function openDashboard() {
    const popup = openBlankDashboardTab();
    if (!popup) {
      setError("浏览器拦截了新标签页，请允许本地学习站点打开标签页后再试。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      popup.location.href = await requestUaDashboardUrl(studyId);
    } catch (reason: unknown) {
      popup.close();
      setError(reason instanceof Error ? reason.message : "UA 项目地图暂时打不开");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ua-dashboard-entry">
      <GameButton variant="secondary" onClick={() => void openDashboard()} disabled={pending}>
        {pending ? "正在启动 UA…" : "打开 UA 项目地图"}
      </GameButton>
      <p className="ua-dashboard-entry__hint">
        在新标签页查看完整的 Understand Anything 图谱；学习进度仍留在这里。
      </p>
      {error ? (
        <p className="ua-dashboard-entry__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
