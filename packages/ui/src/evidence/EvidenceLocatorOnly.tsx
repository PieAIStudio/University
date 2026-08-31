import { translate } from "../i18n/index.js";

function formatLineRange(start: number | null | undefined, end: number | null | undefined): string {
  if (!start || start < 1) return translate("ui.evidence.evidenceLocatorOnly.copy.未提供行号");
  const last = end && end >= start ? end : start;
  return start === last ? `L${start}` : `L${start}–${last}`;
}

/** A truthful evidence state when the citation survived but its source bytes did not. */
export function EvidenceLocatorOnly({
  sourcePath,
  lineStart,
  lineEnd,
}: {
  readonly sourcePath: string;
  readonly lineStart?: number | null;
  readonly lineEnd?: number | null;
}) {
  const lineLabel = formatLineRange(lineStart, lineEnd);

  return (
    <div className="evidence-locator-only" data-evidence-state="locator-only" role="status">
      <strong className="evidence-locator-only__title">
        {translate("ui.evidence.evidenceLocatorOnly.copy.源码没有随这份课程发布")}
      </strong>
      <p className="evidence-locator-only__copy">
        {translate(
          "ui.evidence.evidenceLocatorOnly.copy.仍保留固定提交文件和行号-复制定位可跳到本地项目-打开完整文件可查看项目地图",
        )}
      </p>
      <div className="evidence-locator-only__location" aria-label={`${sourcePath} · ${lineLabel}`}>
        <code>{sourcePath}</code>
        <span aria-hidden="true">·</span>
        <code>{lineLabel}</code>
      </div>
    </div>
  );
}
