import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";

import { readJson } from "../api/client.js";
import type { EvidenceSnippetView, EvidenceToken, EvidenceView } from "../view/lesson-view.js";
import { highlightEvidenceCode } from "../view/lesson-view.js";
import { EvidenceCode } from "./EvidenceCode.js";

export function EvidenceSourceSheet({
  basePath,
  evidence,
  index,
  onClose,
  onSelectIndex,
}: {
  readonly basePath: string;
  readonly evidence: readonly EvidenceView[];
  readonly index: number | null;
  readonly onClose: () => void;
  readonly onSelectIndex: (index: number) => void;
}) {
  const [snippet, setSnippet] = useState<EvidenceSnippetView | null>(null);
  const [tokenLines, setTokenLines] = useState<readonly (readonly EvidenceToken[])[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findText, setFindText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "code" | "locator">("idle");
  const findRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);

  const reference = index === null ? null : (evidence[index] ?? null);
  const fullUrl = index === null ? null : `${basePath}/evidence/${index}?view=full`;

  useEffect(() => {
    if (index === null || !fullUrl) return;
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    setSnippet(null);
    setTokenLines([]);
    setFindText("");
    setCopyState("idle");
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const nextSnippet = await readJson<EvidenceSnippetView>(
          await fetch(fullUrl, { signal: controller.signal }),
        );
        const nextTokens = await highlightEvidenceCode(nextSnippet.code, nextSnippet.language);
        if (requestSequence.current !== sequence) return;
        setSnippet(nextSnippet);
        setTokenLines(nextTokens);
        window.setTimeout(() => findRef.current?.focus(), 0);
      } catch (reason) {
        if (controller.signal.aborted || requestSequence.current !== sequence) return;
        setError(reason instanceof Error ? reason.message : "无法打开固定提交的源码");
      } finally {
        if (requestSequence.current === sequence) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [fullUrl, index]);

  const matchCount = useMemo(() => {
    if (!snippet || !findText.trim()) return 0;
    const needle = findText.trim().toLocaleLowerCase();
    return snippet.code.split("\n").filter((line) => line.toLocaleLowerCase().includes(needle))
      .length;
  }, [findText, snippet]);

  if (index === null || !reference) return null;

  const citedStart = reference.lineStart ?? snippet?.highlightStartLine ?? snippet?.startLine ?? 1;
  const citedEnd = reference.lineEnd ?? snippet?.highlightEndLine ?? snippet?.endLine ?? citedStart;

  async function copy(value: string, state: "code" | "locator") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("当前浏览器不提供复制功能");
      await navigator.clipboard.writeText(value);
      setCopyState(state);
      window.setTimeout(() => setCopyState("idle"), 2_500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "复制失败");
    }
  }

  return (
    <GameModal
      open
      title={`源码证据 · ${reference.sourcePath}`}
      size="lg"
      closeLabel="关闭源码证据"
      closeOnBackdrop
      onClose={onClose}
      footer={
        <div className="source-sheet__footer">
          <div className="source-sheet__navigation">
            <GameButton
              variant="ghost"
              onClick={() => onSelectIndex(index - 1)}
              disabled={index <= 0}
            >
              ← 上一条证据
            </GameButton>
            <span>
              {index + 1} / {evidence.length}
            </span>
            <GameButton
              variant="ghost"
              onClick={() => onSelectIndex(index + 1)}
              disabled={index >= evidence.length - 1}
            >
              下一条证据 →
            </GameButton>
          </div>
          <GameButton variant="secondary" onClick={onClose}>
            关闭
          </GameButton>
        </div>
      }
    >
      <div className="source-sheet">
        <div className="source-sheet__meta" aria-label="源码证据定位">
          <span>
            <strong>固定提交</strong> <code>{reference.sourceCommit}</code>
          </span>
          <span>
            <strong>引用范围</strong>{" "}
            <code>
              L{citedStart}–{citedEnd}
            </code>
          </span>
        </div>
        <div className="source-sheet__tools">
          <label>
            <span>在这份源码中查找</span>
            <input
              ref={findRef}
              type="search"
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              placeholder="例如 dist、outDir"
            />
          </label>
          <span className="source-sheet__find-status" aria-live="polite">
            {findText.trim() ? `命中 ${matchCount} 行` : "只显示已批准的本课证据"}
          </span>
          <div className="source-sheet__copy-actions">
            <GameButton
              variant="ghost"
              onClick={() => void copy(snippet?.code ?? "", "code")}
              disabled={!snippet}
            >
              {copyState === "code" ? "已复制源码" : "复制源码"}
            </GameButton>
            <GameButton
              variant="ghost"
              onClick={() =>
                void copy(
                  `${reference.sourcePath}:${citedStart}-${citedEnd} @ ${reference.sourceCommit}`,
                  "locator",
                )
              }
            >
              {copyState === "locator" ? "已复制定位" : "复制定位"}
            </GameButton>
          </div>
        </div>
        {loading ? <p className="loading-copy">正在从不可变提交读取完整源码…</p> : null}
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        {snippet ? (
          <>
            {snippet.truncatedBefore || snippet.truncatedAfter ? (
              <p className="source-sheet__truncation" role="status">
                文件超过阅读器上限，仅显示受控范围；引用行仍以真实行号标出。
              </p>
            ) : null}
            <EvidenceCode snippet={snippet} lines={tokenLines} findText={findText} />
          </>
        ) : null}
      </div>
    </GameModal>
  );
}
