import { useEffect, useState } from "react";

import type { EvidenceView } from "../view/lesson-view.js";
import {
  evidenceEditorLocator,
  evidenceRangeLabel,
  editorJumpShortcutLabel,
} from "../view/lesson-view.js";

/**
 * Copies a clean editor locator; shows commit pin + how-to beside the button.
 * Keeping version out of the clipboard is deliberate — paste must work in Quick Open.
 */
export function CopyLocatorButton({ reference }: { readonly reference: EvidenceView }) {
  const [copied, setCopied] = useState(false);
  const locator = evidenceEditorLocator(reference);
  const range = evidenceRangeLabel(reference);
  const commitShort = reference.sourceCommit.slice(0, 12);
  const jumpKey = editorJumpShortcutLabel();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 4500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="evidence-item__copy-wrap">
      <button
        type="button"
        className="evidence-item__copy"
        title={`复制 ${locator}，供编辑器 ${jumpKey} 跳转`}
        aria-describedby={copied ? `copy-hint-${locator}` : undefined}
        onClick={() => {
          void navigator.clipboard?.writeText(locator).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? "已复制" : "复制位置"}
      </button>
      {copied ? (
        <p
          className="evidence-item__copy-hint"
          id={`copy-hint-${locator}`}
          role="status"
          aria-live="polite"
        >
          <span className="evidence-item__copy-hint-line">
            已复制 <code>{locator}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            {range ? `证据范围 ${range} · ` : null}
            钉在提交 <code>{commitShort}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            在被学项目工作区按 {jumpKey}，粘贴后回车即可跳转
          </span>
        </p>
      ) : null}
    </div>
  );
}
