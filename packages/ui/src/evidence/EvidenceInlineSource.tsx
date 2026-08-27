import { useEffect, useId, useState } from "react";

import type { EvidenceSnippetView, EvidenceToken, EvidenceUaView } from "../view/lesson-view.js";
import { EvidenceCode } from "./EvidenceCode.js";
import { EvidenceUaPlace } from "./EvidenceUaPlace.js";
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
 * Renders a resolved `[[evidence:…]]` token as the real pinned source. The
 * lesson body uses it for short citations; the reference panel also reuses it
 * after a reader opens a longer citation. The rail keeps its own chip/expand
 * behaviour.
 */
export function EvidenceInlineSource({
  index,
  basePath,
  sourcePath,
  lines,
  ua,
  sourceCommit,
  onOpenEvidence,
}: {
  readonly index: number;
  readonly basePath: EvidenceSource;
  readonly sourcePath: string;
  readonly lines: string;
  readonly ua?: EvidenceUaView | null;
  /** The manifest pin is visible before the snippet request resolves. */
  readonly sourceCommit?: string;
  readonly onOpenEvidence?: (index: number, trigger: HTMLElement) => void;
}) {
  const triggerId = useId();
  const cited = parseLineRange(lines);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokens, setTokens] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setSnippet(null);
    setTokens([]);
    setErrorMessage(null);
    void loadEvidenceSnippet(basePath, index).then((result) => {
      if (cancelled) return;
      if (result.ok) {
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
  }, [basePath, index]);

  const displayStart = snippet?.highlightStartLine ?? snippet?.startLine ?? cited.start;
  const displayEnd = snippet?.highlightEndLine ?? snippet?.endLine ?? cited.end;
  const lineLabel = formatLineRange(displayStart, displayEnd);
  const pathLabel = sourcePath || snippet?.sourcePath || "源码";
  const commit = sourceCommit ?? snippet?.sourceCommit;
  const estimatedLines = Math.max(1, cited.end - cited.start + 1);
  // Reserve roughly cited-line height plus a little context so arrival does not
  // shove the rest of the lesson. Context is approximate; the real snippet may
  // be a few lines taller or shorter.
  const loadingMinHeight = `calc(2.4rem + ${estimatedLines + 4} * 1.55em)`;

  return (
    <div
      className="evidence-inline-source"
      role="group"
      aria-label={`固定源码 ${pathLabel} ${lineLabel}`}
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
              title={`固定提交 ${commit}`}
              data-source-commit={commit}
            >
              · 固定提交 <code>{commit.slice(0, 8)}</code>
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
            看完整文件
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

      {status === "error" ? (
        <p className="evidence-inline-source__error" role="status">
          无法读取固定源码 · <code>{pathLabel}</code> · {lineLabel}
          {errorMessage ? (
            <span className="evidence-inline-source__error-detail">（{errorMessage}）</span>
          ) : null}
        </p>
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
