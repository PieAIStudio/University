/**
 * Delivery's source-access port.
 *
 * A published course may explain a private repository, but this build does
 * not receive that repository or a process host. Every learner entry remains
 * visible and returns a useful explanation instead of pretending the feature
 * does not exist.
 */
import type { SourceAccessExplanation, SourceAccessPort } from "@pieai/university-core";

function explanation(
  title: string,
  whatItDoes: string,
  futureSupport: string,
): SourceAccessExplanation {
  return {
    kind: "explanation",
    title,
    whatItDoes,
    whyUnavailable:
      "交付端拿到的是已发布的课程包，不携带被学习项目的本地仓库，也不能替项目启动本地进程；这样才能在浏览器里安全地阅读课程。",
    futureSupport,
  };
}

const DESKTOP_WEB_MOBILE =
  "以后会在桌面端提供项目检出与启动；浏览器端会提供克隆、切换到固定提交和启动的手动步骤，移动端也会保留同一份说明。";

export function createOnlineSourceAccessPort(): SourceAccessPort {
  return {
    lessonVersion() {
      return explanation(
        "打开正在学习的 App",
        "它会取出这节课钉住的源码版本，并给出启动步骤，让你把课文中的代码和真实 App 对上。",
        DESKTOP_WEB_MOBILE,
      );
    },

    closeLessonVersion() {
      return explanation(
        "删除正在学习的 App 版本",
        "它会删除为这节课准备的临时项目检出，避免一份用完的源码继续占用空间。",
        DESKTOP_WEB_MOBILE,
      );
    },

    uaDashboard() {
      return explanation(
        "打开 UA 项目地图",
        "它会打开完整的 Understand Anything 图谱，让你从这节课引用的文件继续看整个项目的结构。",
        "以后会在桌面端启动已授权的项目图谱；浏览器端会提供图谱地址或手动打开步骤，移动端会提供同一份说明。",
      );
    },

    async layerCoverage() {
      return explanation(
        "查看项目分层",
        "它会按 Understand Anything 的项目分层，列出这门课已经引用和还没有走到的文件。",
        "以后会在桌面端提供已授权的分析快照；浏览器端和移动端会提供同一份分层说明，不会把私有仓库偷偷塞进课程包。",
      );
    },
  };
}
