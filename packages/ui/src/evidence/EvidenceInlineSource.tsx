import { translate } from "../i18n/index.js";
import { useEffect, useId, useState } from "react";

import type { EvidenceSnippetView, EvidenceToken, EvidenceUaView } from "../view/lesson-view.js";
import { EvidenceUaPlace } from "./EvidenceUaPlace.js";
import { EvidenceCode } from "./EvidenceCode.js";
import { EvidenceLocatorOnly } from "./EvidenceLocatorOnly.js";
import { loadEvidenceSnippet, type EvidenceSource } from "./load-evidence-snippet.js";

function formatLineRange(start: number, end: number): string {
  return start === end ? `L${start}` : `L${start}–${end}`;
}

function parseLineRange(lines: string): { readonly start: number; readonly end: number } {
  const match = /^(\d+)(?:-(\d+))?$/.exec(lines.trim());
  if (!match) return { start: 1, end: 1 };
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    return { start: 1, end: 1 };
  }
  return { start, end };
}

/**
 * Renders a resolved `[[evidence:…]]` token as a source affordance. The
 * lesson body keeps the source bytes out of the first screen; the shared
 * source sheet loads the real pinned file only after the reader asks for it.
 * The rail keeps its own chip/expand behaviour.
 */
export function EvidenceInlineSource({
  index,
  basePath,
  sourcePath,
  lines,
  ua,
  sourceCommit,
  loadOnMount = false,
  onOpenEvidence,
}: {
  readonly index: number;
  readonly basePath?: EvidenceSource;
  readonly sourcePath: string;
  readonly lines: string;
  readonly ua?: EvidenceUaView | null;
  /** The manifest pin is visible before the reader requests the snippet. */
  readonly sourceCommit?: string;
  /** Long citations load after the reader has opened their reference panel. */
  readonly loadOnMount?: boolean;
  readonly onOpenEvidence?: (index: number, trigger: HTMLElement) => void;
}) {
  const triggerId = useId();
  const cited = parseLineRange(lines);
  const [status, setStatus] = useState<"deferred" | "loading" | "ready" | "locator-only" | "error">(
    loadOnMount ? "loading" : "deferred",
  );
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokens, setTokens] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loadOnMount || !basePath) return;
    let cancelled = false;
    setStatus("loading");
    setSnippet(null);
    setTokens([]);
    setErrorMessage(null);
    void loadEvidenceSnippet(basePath, index).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        if (result.kind === "locator-only") {
          setStatus("locator-only");
          return;
        }
        setSnippet(result.snippet);
        setTokens(result.tokens);
        setStatus("ready");
        return;
      }
      setErrorMessage(result.message);
      setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [basePath, index, loadOnMount]);

  const displayStart = snippet?.highlightStartLine ?? snippet?.startLine ?? cited.start;
  const displayEnd = snippet?.highlightEndLine ?? snippet?.endLine ?? cited.end;
  const lineLabel = formatLineRange(displayStart, displayEnd);
  const pathLabel =
    sourcePath || snippet?.sourcePath || translate("ui.evidence.evidenceInlineSource.copy.源码");
  const commit = sourceCommit ?? snippet?.sourceCommit;
  const estimatedLines = Math.max(1, cited.end - cited.start + 1);
  const loadingMinHeight = `calc(2.4rem + ${estimatedLines + 4} * 1.55em)`;

  return (
    <div
      className="evidence-inline-source"
      role="group"
      aria-label={translate("ui.evidence.evidenceInlineSource.copy.固定源码-value0-value1", {
        value0: pathLabel,
        value1: lineLabel,
      })}
      aria-busy={status === "loading"}
    >
      <div className="evidence-inline-source__header">
        <span className="evidence-inline-source__meta">
          <code className="evidence-inline-source__path">{pathLabel}</code>
          <span className="evidence-inline-source__lines" aria-hidden="true">
            · {lineLabel}
          </span>
          {snippet?.language ? (
            <span className="evidence-inline-source__language">· {snippet.language}</span>
          ) : null}
          {commit ? (
            <span
              className="evidence-inline-source__commit"
              title={translate("ui.evidence.evidenceInlineSource.copy.固定提交-value0", {
                value0: commit,
              })}
              data-source-commit={commit}
            >
              {translate("ui.evidence.evidenceInlineSource.copy.固定提交")}{" "}
              <code>{commit.slice(0, 8)}</code>
            </span>
          ) : null}
        </span>
        {onOpenEvidence ? (
          <button
            type="button"
            className="evidence-inline-source__open"
            data-evidence-index={index}
            data-evidence-trigger="inline"
            data-evidence-trigger-id={triggerId}
            onClick={(event) => onOpenEvidence(index, event.currentTarget)}
          >
            {translate("ui.evidence.evidenceInlineSource.copy.看完整文件")}
          </button>
        ) : null}
      </div>
      {ua ? <EvidenceUaPlace ua={ua} compact /> : null}
      {status === "loading" ? (
        <div
          className="evidence-inline-source__loading"
          style={{ minHeight: loadingMinHeight }}
          aria-hidden="true"
        >
          <span className="evidence-inline-source__loading-bar" />
          <span className="evidence-inline-source__loading-bar" />
          <span className="evidence-inline-source__loading-bar evidence-inline-source__loading-bar--short" />
        </div>
      ) : null}

      {status === "deferred" && onOpenEvidence ? (
        <div className="evidence-inline-source__deferred" role="status">
          {translate("ui.evidence.evidenceInlineSource.copy.点击查看固定源码")}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="evidence-inline-source__error" role="status">
          {translate("ui.evidence.evidenceInlineSource.copy.无法读取固定源码")}{" "}
          <code>{pathLabel}</code> · {lineLabel}
          {errorMessage ? (
            <span className="evidence-inline-source__error-detail">（{errorMessage}）</span>
          ) : null}
        </p>
      ) : null}

      {status === "locator-only" ? (
        <EvidenceLocatorOnly sourcePath={pathLabel} lineStart={cited.start} lineEnd={cited.end} />
      ) : null}

      {status === "ready" && snippet ? (
        <>
          <EvidenceCode snippet={snippet} lines={tokens} />
          {snippet.attribution ? (
            <p className="evidence-inline-source__attribution">{snippet.attribution}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
