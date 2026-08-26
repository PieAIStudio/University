/**
 * Authoring's source-access port.
 *
 * The local server owns the private repository, its disposable checkout and
 * the UA analysis. The shared reader never learns these routes: this adapter
 * is the only place that turns a learner action into a loopback request.
 */
import type {
  SourceAccess,
  SourceAccessExplanation,
  SourceAccessPort,
  SourceCheckout,
  SourceLayerCoverage,
  SourceVersionInput,
} from "@pieai/university-core";
import { readJson } from "@pieai/university-ui/api/client.js";

function checkoutEndpoint(input: SourceVersionInput): string {
  return `/api/studies/${encodeURIComponent(input.studyId)}/checkout?sourceCommit=${encodeURIComponent(input.sourceCommit)}`;
}

function checkoutOpenAction(input: SourceVersionInput): SourceAccess<SourceCheckout> {
  return {
    kind: "action",
    async run() {
      return readJson<SourceCheckout>(await fetch(checkoutEndpoint(input), { method: "POST" }));
    },
  };
}

function checkoutCloseAction(input: SourceVersionInput): SourceAccess<void> {
  return {
    kind: "action",
    async run() {
      await readJson<unknown>(await fetch(checkoutEndpoint(input), { method: "DELETE" }));
    },
  };
}

function openBlankDashboardTab(): Window | null {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  popup.opener = null;
  popup.document.title = "正在打开项目地图…";
  return popup;
}

function dashboardAction(input: {
  readonly studyId: string;
  readonly nodeId?: string | null;
}): SourceAccess<void> {
  return {
    kind: "action",
    async run() {
      // This must stay before the first await; otherwise a normal browser
      // treats the dashboard as an unsolicited popup and blocks it.
      const popup = openBlankDashboardTab();
      if (!popup) throw new Error("浏览器拦截了新标签页，请允许本地学习站点打开标签页后再试。");
      try {
        const query = input.nodeId ? `?node=${encodeURIComponent(input.nodeId)}` : "";
        const body = await readJson<{ readonly url: string }>(
          await fetch(`/api/studies/${encodeURIComponent(input.studyId)}/ua-dashboard${query}`),
        );
        popup.location.href = body.url;
      } catch (reason: unknown) {
        popup.close();
        throw reason;
      }
    },
  };
}

function noLayerCoverageExplanation(detail?: string): SourceAccessExplanation {
  return {
    kind: "explanation",
    title: "查看项目分层",
    whatItDoes: "它会按 Understand Anything 的项目分层，列出这门课已经引用和还没有走到的文件。",
    whyUnavailable: detail
      ? `作者端现在也读不到这份项目分析：${detail}`
      : "这个项目还没有可用的 Understand Anything 分析，所以现在没有可信的分层可以展示。",
    futureSupport:
      "完成一次项目分析后，作者端会在这里直接显示；交付端以后会在桌面端提供已授权的分析快照，浏览器和移动端则提供同一份手动查看说明。",
  };
}

export function createLocalSourceAccessPort(): SourceAccessPort {
  return {
    lessonVersion(input) {
      return checkoutOpenAction(input);
    },

    closeLessonVersion(input) {
      return checkoutCloseAction(input);
    },

    uaDashboard(input) {
      return dashboardAction(input);
    },

    async layerCoverage({ studyId }) {
      try {
        const body = await readJson<{ readonly map: SourceLayerCoverage | null }>(
          await fetch(`/api/studies/${encodeURIComponent(studyId)}/map`),
        );
        if (!body.map) return noLayerCoverageExplanation();
        const map = body.map;
        return {
          kind: "action",
          run: async () => map,
        };
      } catch (reason: unknown) {
        return noLayerCoverageExplanation(
          reason instanceof Error ? reason.message : String(reason),
        );
      }
    },
  };
}
