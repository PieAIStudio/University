import { translate } from "../i18n/index.js";
import { useEffect, useState } from "react";

import type { RepositoryEvidenceView } from "../view/lesson-view.js";
import {
  evidenceEditorLocator,
  evidenceRangeLabel,
  editorJumpShortcutLabel,
} from "../view/lesson-view.js";

/**
 * Copies a clean editor locator; shows commit pin + how-to beside the button.
 * Keeping version out of the clipboard is deliberate — paste must work in Quick Open.
 */
/* Repository citations only: a public page has no editor locator to paste. */
export function CopyLocatorButton({ reference }: { readonly reference: RepositoryEvidenceView }) {
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
        title={translate("ui.evidence.copyLocatorButton.copy.复制-value0-供编辑器-value1-跳转", {
          value0: locator,
          value1: jumpKey,
        })}
        aria-describedby={copied ? `copy-hint-${locator}` : undefined}
        onClick={() => {
          void navigator.clipboard?.writeText(locator).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied
          ? translate("ui.evidence.copyLocatorButton.copy.已复制")
          : translate("ui.evidence.copyLocatorButton.copy.复制位置")}
      </button>
      {copied ? (
        <p
          className="evidence-item__copy-hint"
          id={`copy-hint-${locator}`}
          role="status"
          aria-live="polite"
        >
          <span className="evidence-item__copy-hint-line">
            {translate("ui.evidence.copyLocatorButton.copy.已复制")} <code>{locator}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            {range
              ? translate("ui.evidence.copyLocatorButton.copy.证据范围-value0", { value0: range })
              : null}
            {translate("ui.evidence.copyLocatorButton.copy.钉在提交")} <code>{commitShort}</code>
          </span>
          <span className="evidence-item__copy-hint-line">
            {translate("ui.evidence.copyLocatorButton.copy.在被学项目工作区按")} {jumpKey}
            {translate("ui.evidence.copyLocatorButton.copy.粘贴后回车即可跳转")}
          </span>
        </p>
      ) : null}
    </div>
  );
}
