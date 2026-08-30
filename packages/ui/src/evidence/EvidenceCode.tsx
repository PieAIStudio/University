import { translate } from "../i18n/index.js";
import type { EvidenceSnippetView, EvidenceToken } from "../view/lesson-view.js";

function trustedThemeColor(color: string | undefined): string | undefined {
  return color && /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color) ? color : undefined;
}

export function EvidenceCode({
  snippet,
  lines,
  findText = "",
}: {
  readonly snippet: EvidenceSnippetView;
  readonly lines: readonly (readonly EvidenceToken[])[];
  readonly findText?: string;
}) {
  return (
    <pre
      className="evidence-code"
      tabIndex={0}
      aria-label={translate("ui.evidence.evidenceCode.copy.value0-第-value1-到-value2-行", {
        value0: snippet.sourcePath,
        value1: snippet.startLine,
        value2: snippet.endLine,
      })}
    >
      <code>
        {lines.map((tokens, index) => {
          const lineNumber = snippet.startLine + index;
          const highlighted =
            snippet.highlightStartLine !== null &&
            snippet.highlightEndLine !== null &&
            lineNumber >= snippet.highlightStartLine &&
            lineNumber <= snippet.highlightEndLine;
          const found =
            findText.trim().length > 0 &&
            tokens
              .map((token) => token.content)
              .join("")
              .toLocaleLowerCase()
              .includes(findText.trim().toLocaleLowerCase());
          return (
            <span
              className={`evidence-code__line${highlighted ? " evidence-code__line--highlighted" : ""}${found ? " evidence-code__line--found" : ""}`}
              key={lineNumber}
            >
              <span className="evidence-code__line-number" aria-hidden="true">
                {lineNumber}
              </span>
              <span className="evidence-code__line-content">
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={`${tokenIndex}:${token.content.length}`}
                    style={{ color: trustedThemeColor(token.color) }}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}
