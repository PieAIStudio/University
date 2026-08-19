import { readJson } from "./client.js";

/**
 * Starts or reuses the official Understand Anything Dashboard for one study.
 * `node` is attached to the URL for a future Dashboard that honours it; 2.9.4
 * ignores the extra query and still opens the full graph.
 */
export async function requestUaDashboardUrl(
  studyId: string,
  nodeId?: string | null,
): Promise<string> {
  const query = nodeId ? `?node=${encodeURIComponent(nodeId)}` : "";
  const body = await readJson<{ readonly url: string }>(
    await fetch(`/api/studies/${encodeURIComponent(studyId)}/ua-dashboard${query}`),
  );
  return body.url;
}

/**
 * Open the dashboard in a new tab. The blank window is created synchronously
 * so a popup blocker sees a click, not a later fetch.
 */
export function openBlankDashboardTab(): Window | null {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  popup.opener = null;
  popup.document.title = "正在打开项目地图…";
  return popup;
}
