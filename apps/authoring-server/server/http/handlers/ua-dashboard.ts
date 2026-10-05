import { sendJson } from "../wire.js";
import { UaDashboardError, type UaDashboardManager } from "../../ua/dashboard.js";
import type { Handler } from "./types.js";

const ROUTE = /^\/api\/studies\/([^/]+)\/ua-dashboard$/;

/**
 * Starts (or reuses) the official Understand Anything Dashboard for one
 * study. The dashboard remains its own app so its graph interactions, source
 * preview, and future UA updates stay owned by UA; UniversityLocal only hands
 * the learner a tokenized loopback URL.
 */
export function createUaDashboardHandler(manager: UaDashboardManager): Handler {
  return async (ctx, request, response, url) => {
    const match = ROUTE.exec(url.pathname);
    if (!match) return false;
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return true;
    }

    const studyId = decodeURIComponent(match[1]!);
    const nodeId = url.searchParams.get("node");
    try {
      sendJson(response, 200, await manager.open(studyId, nodeId));
    } catch (error) {
      if (error instanceof UaDashboardError) {
        sendJson(response, error.status, { error: error.message });
        return true;
      }
      throw error;
    }
    return true;
  };
}
