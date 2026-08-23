import { useRef, useState } from "react";

import { Tip } from "../Tip.js";
import { readJson } from "../api/client.js";
import type { EvidenceSnippetView, EvidenceToken, EvidenceView } from "../view/lesson-view.js";
import { evidenceHost, highlightEvidenceCode, isUrlEvidenceView } from "../view/lesson-view.js";
import { CopyLocatorButton } from "./CopyLocatorButton.js";
import { EvidenceCode } from "./EvidenceCode.js";

export function EvidenceRail({
  basePath,
  evidence,
  panelIdPrefix,
  ariaLabel = "证据",
  onOpenSource,
}: {
  readonly basePath: string;
  readonly evidence: readonly EvidenceView[];
  readonly panelIdPrefix: string;
  readonly ariaLabel?: string;
  /** @deprecated Prefer the quiet single-line header; kept so callers keep compiling. */
  readonly title?: string;
  readonly onOpenSource?: (index: number, trigger: HTMLElement) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokenLines, setTokenLines] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  if (evidence.length === 0) return null;

  async function toggleEvidence(index: number) {
    if (expandedIndex === index) {
      requestSequence.current += 1;
      setExpandedIndex(null);
      setSnippet(null);
      setTokenLines([]);
      setLoading(false);
      setError(null);
      return;
    }

    const sequence = ++requestSequence.current;
    setExpandedIndex(index);
    setSnippet(null);
    setTokenLines([]);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${basePath}/evidence/${index}`);
      const nextSnippet = await readJson<EvidenceSnippetView>(response);
      const nextTokens = await highlightEvidenceCode(nextSnippet.code, nextSnippet.language);
      if (requestSequence.current !== sequence) return;
      setSnippet(nextSnippet);
      setTokenLines(nextTokens);
    } catch (reason) {
      if (requestSequence.current !== sequence) return;
      setError(reason instanceof Error ? reason.message : "无法读取这条源码证据");
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }

  return (
    <aside className="evidence-rail" aria-label={ariaLabel}>
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">证据</h3>
        <Tip term="evidence" className="rail-panel__help">
          <span aria-label="关于证据">?</span>
        </Tip>
      </div>
      <ol className="evidence-list">
        {evidence.map((reference, index) => {
          const expanded = expandedIndex === index;
          const panelId = `evidence-snippet-${panelIdPrefix}-${index}`;
          if (isUrlEvidenceView(reference)) {
            /*
              A public page is the citation, not a pointer to one. There is no
              commit to shorten, no file to name and nothing to expand inline —
              rendering the repository furniture with the fields blank would
              claim this course is pinned to code it has never seen.
            */
            return (
              <li className="evidence-item" key={`${index}:${reference.sourceUrl}`}>
                <a
                  className="evidence-item__link"
                  href={reference.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{reference.sourceTitle}</strong>
                  <small>{evidenceHost(reference)}</small>
                </a>
                {reference.note ? <p className="evidence-item__note">{reference.note}</p> : null}
              </li>
            );
          }
          return (
            <li
              className="evidence-item"
              key={`${index}:${reference.sourcePath}:${reference.lineStart}`}
            >
              <button
                type="button"
                className="evidence-item__trigger"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => void toggleEvidence(index)}
              >
                <code>{reference.sourcePath}</code>
                <span>
                  {reference.lineStart
                    ? `L${reference.lineStart}${reference.lineEnd ? `–${reference.lineEnd}` : ""}`
                    : "完整文件"}
                </span>
                <small>{reference.sourceCommit.slice(0, 8)}</small>
                <strong aria-hidden="true">{expanded ? "收起" : "查看"}</strong>
              </button>
              {reference.note ? <p className="evidence-item__note">{reference.note}</p> : null}
              <CopyLocatorButton reference={reference} />
              {expanded ? (
                <div className="evidence-snippet" id={panelId} aria-live="polite">
                  {loading ? <p>正在从固定提交读取源码…</p> : null}
                  {error ? (
                    <p className="inline-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  {snippet ? (
                    <>
                      <div className="evidence-snippet__meta">
                        <span>{snippet.language}</span>
                        <span>
                          L{snippet.startLine}–{snippet.endLine}
                        </span>
                        <span>{snippet.sourceCommit.slice(0, 12)}</span>
                      </div>
                      <EvidenceCode snippet={snippet} lines={tokenLines} />
                      {onOpenSource ? (
                        <button
                          type="button"
                          className="evidence-source-open"
                          data-evidence-index={index}
                          data-evidence-trigger="rail"
                          data-evidence-trigger-id={`rail-${index}`}
                          onClick={(event) => onOpenSource(index, event.currentTarget)}
                        >
                          在源码查看器中打开完整固定提交
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
