import { useRef, useState } from "react";

import { readJson } from "../api/client.js";
import type { EvidenceSnippetView, EvidenceToken, EvidenceView } from "../view/lesson-view.js";
import { highlightEvidenceCode } from "../view/lesson-view.js";
import { CopyLocatorButton } from "./CopyLocatorButton.js";
import { EvidenceCode } from "./EvidenceCode.js";

export function EvidenceRail({
  basePath,
  evidence,
  panelIdPrefix,
  ariaLabel = "课程证据",
  title = "这节课依据什么",
}: {
  readonly basePath: string;
  readonly evidence: readonly EvidenceView[];
  readonly panelIdPrefix: string;
  readonly ariaLabel?: string;
  readonly title?: string;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokenLines, setTokenLines] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

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
      <p className="eyebrow">EVIDENCE</p>
      <h3>{title}</h3>
      <ol className="evidence-list">
        {evidence.map((reference, index) => {
          const expanded = expandedIndex === index;
          const panelId = `evidence-snippet-${panelIdPrefix}-${index}`;
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
